import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it, vi } from 'vitest';
import { DockerRunner } from '../../src/runner/docker-runner.js';

const execFileAsync = promisify(execFile);

// Nombres de los contenedores del runner (prefijo `yaqa-`) que siguen existiendo, parados o no.
async function leftoverContainers(): Promise<string[]> {
  const { stdout } = await execFileAsync('docker', [
    'ps',
    '-a',
    '--filter',
    'name=yaqa-',
    '--format',
    '{{.Names}}',
  ]);
  return stdout.split('\n').filter(Boolean);
}

// Estos tests usan Docker de verdad: Docker Desktop tiene que estar encendido.
const baseOptions = {
  image: 'marketsquare/robotframework-browser:20.6.0',
  memory: '1g',
  cpus: '1',
  pidsLimit: 256,
};
const runner = new DockerRunner(baseOptions);

const passingTest = `*** Test Cases ***
Passes
    Log    hello
`;

const failingTest = `*** Test Cases ***
Fails
    Should Be Equal    expected-value    other-value
`;

// Robot sale con código 0 si el test se omite, así que el runner debe mirar el resumen.
const skippedTest = `*** Test Cases ***
Gets Skipped
    Skip    nothing to verify here
`;

const sleepingTest = `*** Test Cases ***
Sleeps Too Long
    Sleep    60s
`;

const browserTest = `*** Settings ***
Library    Browser

*** Test Cases ***
Opens A Page In Chromium
    New Browser    chromium    headless=True
    New Page    data:text/html,<title>Hello</title>
    Get Title    ==    Hello
`;

const secretsTest = `*** Settings ***
Library    OperatingSystem

*** Test Cases ***
Sees No Secrets
    \${value}=    Get Environment Variable    OPENAI_API_KEY    NOT_SET
    Should Be Equal    \${value}    NOT_SET
`;

// Gasta CPU sin parar (a diferencia de `Sleep`, que no consume): nunca termina por sí solo.
const cpuBurnTest = `*** Test Cases ***
Burns CPU
    Evaluate    sum(i * i for i in range(10**10))
`;

// Pide ~1 GB de memoria: con un contenedor de 256 MB, Docker debe matar el proceso (OOM-kill).
const memoryHogTest = `*** Test Cases ***
Eats Memory
    \${blob}=    Evaluate    'x' * 1_000_000_000
    Log    allocated
`;

// Para probar el aislamiento (US-06.5): cada test deja su marca en /work, espera 3 s para solaparse
// con el otro job y comprueba que la marca del OTRO no existe. Si compartieran carpeta, fallaría.
const isolationTest = (own: string, other: string): string => `*** Settings ***
Library    OperatingSystem

*** Test Cases ***
Does Not See The Other Job
    Create File    /work/marker-${own}.txt    ${own}
    Sleep    3s
    Should Not Exist    /work/marker-${other}.txt
`;

// Contenedor + arranque de Robot: cada test puede tardar varios segundos.
describe('DockerRunner (integración, necesita Docker)', { timeout: 120_000 }, () => {
  it('devuelve PASS y los logs cuando el test pasa (US-06.1)', async () => {
    const result = await runner.run(passingTest, 60);

    expect(result.result).toBe('PASS');
    expect(result.timedOut).toBe(false);
    expect(result.logs).toContain('1 test, 1 passed, 0 failed');
  });

  it('devuelve FAIL con el motivo en los logs cuando el test falla (US-06.1)', async () => {
    const result = await runner.run(failingTest, 60);

    expect(result.result).toBe('FAIL');
    expect(result.timedOut).toBe(false);
    expect(result.logs).toContain('expected-value != other-value');
  });

  it('un test omitido (Skip) NO cuenta como PASS aunque Robot salga con código 0', async () => {
    const result = await runner.run(skippedTest, 60);

    expect(result.result).toBe('FAIL');
    expect(result.logs).toContain('1 skipped');
  });

  it('corta la ejecución al pasar el timeout y la cuenta como fallo (US-06.2, RNF-2)', async () => {
    const started = Date.now();
    const result = await runner.run(sleepingTest, 5);
    const seconds = (Date.now() - started) / 1000;

    expect(result.result).toBe('FAIL');
    expect(result.timedOut).toBe(true);
    expect(seconds).toBeLessThan(40); // no esperó los 60 s del Sleep
  });

  it('el test no puede ver las claves de la máquina anfitriona (US-06.3)', async () => {
    process.env['OPENAI_API_KEY'] = 'sk-fake-secret-for-test';
    try {
      const result = await runner.run(secretsTest, 60);
      expect(result.result).toBe('PASS'); // PASS = la variable NO existía dentro
    } finally {
      delete process.env['OPENAI_API_KEY'];
    }
  });

  it('dos jobs a la vez no comparten archivos ni resultados (US-06.5)', async () => {
    const timed = async (code: string) => {
      const started = Date.now();
      const result = await runner.run(code, 60);
      return { result, ms: Date.now() - started };
    };

    const started = Date.now();
    const [a, b] = await Promise.all([
      timed(isolationTest('a', 'b')),
      timed(isolationTest('b', 'a')),
    ]);
    const total = Date.now() - started;

    expect(a.result.result).toBe('PASS'); // PASS = no vio la marca del otro job
    expect(b.result.result).toBe('PASS');
    // Se solaparon de verdad: en paralelo el total es ~lo que tarda UNO, no la suma de los dos.
    expect(total).toBeLessThan(a.ms + b.ms - 2000);
  });

  it('un test que pide más memoria que su límite se corta sin colgar al backend (US-06.4)', async () => {
    const smallRunner = new DockerRunner({ ...baseOptions, memory: '256m' });
    const started = Date.now();

    const result = await smallRunner.run(memoryHogTest, 60);
    const seconds = (Date.now() - started) / 1000;

    expect(result.result).toBe('FAIL'); // nunca PASS: no pudo reservar el GB
    expect(result.timedOut).toBe(false); // lo cortó la memoria, no el reloj
    expect(seconds).toBeLessThan(40); // y rápido: el backend recibió el resultado y siguió
  });

  it('un bucle que gasta CPU se mata con el timeout y no deja contenedores huérfanos (US-06.4)', async () => {
    const started = Date.now();

    const result = await runner.run(cpuBurnTest, 5);
    const seconds = (Date.now() - started) / 1000;

    expect(result.result).toBe('FAIL');
    expect(result.timedOut).toBe(true);
    expect(seconds).toBeLessThan(40);
    // `docker kill` es asíncrono y --rm borra el contenedor después: damos unos segundos.
    await vi.waitFor(async () => expect(await leftoverContainers()).toEqual([]), {
      timeout: 15_000,
    });
  });

  it('puede abrir Chromium dentro del contenedor con los límites aplicados (US-06.4)', async () => {
    const result = await runner.run(browserTest, 90);

    expect(result.result).toBe('PASS');
  });
});
