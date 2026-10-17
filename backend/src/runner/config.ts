import type { DockerRunOptions } from './docker-args.js';

// Valores seguros si no se definen: así un .env incompleto nunca deja el runner sin límites.
const DEFAULTS = { memory: '1g', cpus: '1', pidsLimit: 256 } as const;

// Lee una variable. Vacía o solo con espacios cuenta como "no definida".
function read(env: Record<string, string | undefined>, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

// Recibe el entorno por parámetro (en producción, `process.env`) para poder probarlo sin tocar
// variables globales. Devuelve justo el objeto que DockerRunner ya espera.
export function loadRunnerConfig(env: Record<string, string | undefined>): DockerRunOptions {
  // La imagen es obligatoria (D-35): su versión no debe cambiar sin que lo decidamos.
  const image = read(env, 'RF_RUNNER_IMAGE');
  if (!image) throw new Error('Missing required environment variable: RF_RUNNER_IMAGE');

  const memory = read(env, 'RF_RUNNER_MEMORY') ?? DEFAULTS.memory;
  if (!/^\d+[bkmg]?$/i.test(memory)) {
    throw new Error('RF_RUNNER_MEMORY must look like 512m or 1g');
  }

  const cpus = read(env, 'RF_RUNNER_CPUS') ?? DEFAULTS.cpus;
  if (!(Number(cpus) > 0)) throw new Error('RF_RUNNER_CPUS must be a positive number');

  const rawPids = read(env, 'RF_RUNNER_PIDS_LIMIT');
  const pidsLimit = rawPids === undefined ? DEFAULTS.pidsLimit : Number(rawPids);
  if (!Number.isInteger(pidsLimit) || pidsLimit <= 0) {
    throw new Error('RF_RUNNER_PIDS_LIMIT must be a positive integer');
  }

  const baseUrl = read(env, 'AUT_BASE_URL');
  return { image, memory, cpus, pidsLimit, ...(baseUrl ? { baseUrl } : {}) };
}
