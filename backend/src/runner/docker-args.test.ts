import { describe, expect, it } from 'vitest';
import { buildDockerRunArgs, type DockerRunOptions } from './docker-args.js';

const options: DockerRunOptions = {
  image: 'marketsquare/robotframework-browser:20.6.0',
  memory: '1g',
  cpus: '1',
  pidsLimit: 256,
  baseUrl: 'https://app.example.com',
};
const args = buildDockerRunArgs(options, 'yaqa-job-1', 'C:/tmp/yaqa-job-1');

// Devuelve el valor que sigue a una opción (p. ej. valueOf('--memory') -> '1g').
const valueOf = (flag: string): string | undefined => args[args.indexOf(flag) + 1];

// US-06: ejecución aislada. TS-01.2: el código generado por el LLM no es de fiar.
describe('buildDockerRunArgs', () => {
  it('empieza por `run` y usa la imagen con versión fija, no `latest`', () => {
    expect(args[0]).toBe('run');
    expect(args).toContain(options.image);
    expect(options.image).not.toContain('latest');
  });

  it('corre sin privilegios y sin nuevos privilegios (US-06.3)', () => {
    expect(valueOf('--user')).toBe('pwuser');
    expect(args).toContain('--security-opt=no-new-privileges');
  });

  it('limita memoria, CPU y número de procesos (US-06.4)', () => {
    expect(valueOf('--memory')).toBe('1g');
    expect(valueOf('--cpus')).toBe('1');
    expect(valueOf('--pids-limit')).toBe('256');
  });

  it('no pasa variables de entorno al contenedor, así no hay secretos dentro (US-06.3)', () => {
    expect(args).not.toContain('-e');
    expect(args).not.toContain('--env');
    expect(args).not.toContain('--env-file');
  });

  it('se borra al terminar y tiene nombre, para poder matarlo por timeout (US-06.2)', () => {
    expect(args).toContain('--rm');
    expect(valueOf('--name')).toBe('yaqa-job-1');
  });

  it('monta únicamente su carpeta de trabajo, para que dos jobs no compartan archivos (US-06.5)', () => {
    const mounts = args.filter((_, i) => args[i - 1] === '-v');
    expect(mounts).toEqual(['C:/tmp/yaqa-job-1:/work']);
  });

  it('pasa la URL de la aplicación bajo test como un único argumento (US-06.6)', () => {
    const i = args.indexOf('--variable');
    expect(args[i + 1]).toBe('BASE_URL:https://app.example.com');
  });

  it('no añade la variable BASE_URL si no hay URL configurada', () => {
    const withoutUrl = buildDockerRunArgs({ ...options, baseUrl: undefined }, 'n', 'd');
    expect(withoutUrl).not.toContain('--variable');
  });

  it('termina ejecutando robot sobre el test, sin pasar por una shell', () => {
    expect(args.slice(-3)).toEqual(['--outputdir', '/work/results', '/work/test.robot']);
    expect(args).not.toContain('bash');
    expect(args).not.toContain('-c');
  });
});
