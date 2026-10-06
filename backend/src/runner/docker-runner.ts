import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RunnerPort, RunResult } from '../agent/ports.js';
import { buildDockerRunArgs, type DockerRunOptions } from './docker-args.js';

// Los logs de un test descontrolado pueden ser enormes: nos quedamos con una parte.
const MAX_LOG_CHARS = 200_000;

// Adaptador real de RunnerPort (D-30): ejecuta el .robot dentro de un contenedor aislado.
export class DockerRunner implements RunnerPort {
  constructor(private readonly options: DockerRunOptions) {}

  async run(robotCode: string, timeoutSeconds: number): Promise<RunResult> {
    // Cada ejecución tiene su carpeta y su contenedor propios: dos jobs no comparten nada (US-06.5).
    const containerName = `yaqa-${randomUUID()}`;
    const workDir = await mkdtemp(join(tmpdir(), 'yaqa-'));
    try {
      // En Linux el usuario del contenedor (pwuser) necesita poder escribir aquí; en Windows no hace nada.
      await chmod(workDir, 0o777);
      await writeFile(join(workDir, 'test.robot'), robotCode, 'utf8');
      return await this.execute(containerName, workDir, timeoutSeconds);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  private execute(
    containerName: string,
    workDir: string,
    timeoutSeconds: number,
  ): Promise<RunResult> {
    return new Promise((resolve, reject) => {
      const child = spawn('docker', buildDockerRunArgs(this.options, containerName, workDir));

      let output = '';
      let timedOut = false;
      const collect = (chunk: Buffer): void => {
        if (output.length < MAX_LOG_CHARS) output += chunk.toString();
      };
      child.stdout.on('data', collect);
      child.stderr.on('data', collect);

      // El cronómetro: si salta, hay que matar el CONTENEDOR. Matar el proceso `docker run`
      // no basta: dejaría el contenedor corriendo por detrás.
      const timer = setTimeout(() => {
        timedOut = true;
        spawn('docker', ['kill', containerName]).on('error', () => undefined);
      }, timeoutSeconds * 1000);

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error); // p. ej. Docker no está instalado o no arranca
      });

      child.on('close', (exitCode) => {
        clearTimeout(timer);
        resolve({
          // Robot devuelve 0 si todos los tests pasan y un número distinto si alguno falla.
          result: exitCode === 0 && !timedOut ? 'PASS' : 'FAIL',
          logs: output.slice(0, MAX_LOG_CHARS),
          timedOut,
        });
      });
    });
  }
}
