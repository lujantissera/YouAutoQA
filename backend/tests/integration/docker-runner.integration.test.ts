import { describe, expect, it } from 'vitest';
import { DockerRunner } from '../../src/runner/docker-runner.js';

// Estos tests usan Docker de verdad: Docker Desktop tiene que estar encendido.
const runner = new DockerRunner({
  image: 'marketsquare/robotframework-browser:20.6.0',
  memory: '1g',
  cpus: '1',
  pidsLimit: 256,
});

const passingTest = `*** Test Cases ***
Passes
    Log    hello
`;

const failingTest = `*** Test Cases ***
Fails
    Should Be Equal    expected-value    other-value
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

  it('puede abrir Chromium dentro del contenedor con los límites aplicados (US-06.4)', async () => {
    const result = await runner.run(browserTest, 90);

    expect(result.result).toBe('PASS');
  });
});
