// Construye los argumentos de `docker run` para ejecutar un .robot en una "celda" aislada.
// Función pura: no ejecuta nada, solo devuelve la lista. Por eso se testea sin Docker.
// El código lo genera un LLM, así que cada argumento de seguridad es una pared (US-06, TS-01.2).

export interface DockerRunOptions {
  /** Imagen con versión fija (D-35), nunca `latest`. */
  image: string;
  /** Límite de memoria, p. ej. '1g'. */
  memory: string;
  /** Límite de CPU, p. ej. '1'. */
  cpus: string;
  /** Máximo de procesos dentro del contenedor (frena las "fork bombs"). */
  pidsLimit: number;
  /** URL de la aplicación bajo test (RNF-6). Si no hay, no se pasa. */
  baseUrl?: string;
}

export function buildDockerRunArgs(
  options: DockerRunOptions,
  containerName: string,
  workDir: string,
): string[] {
  // La URL va como UN argumento: nunca se concatena en un texto que pase por una shell.
  const baseUrlVariable = options.baseUrl ? ['--variable', `BASE_URL:${options.baseUrl}`] : [];

  return [
    'run',
    '--rm', // se destruye al terminar
    '--name',
    containerName, // para poder hacer `docker kill` si se pasa del timeout
    '--user',
    'pwuser', // sin privilegios de administrador
    '--security-opt=no-new-privileges', // no puede ganar privilegios después
    '--memory',
    options.memory,
    '--cpus',
    options.cpus,
    '--pids-limit',
    String(options.pidsLimit),
    '--shm-size=512m', // memoria compartida que Chromium necesita para no crashear
    '-v',
    `${workDir}:/work`, // única carpeta visible: la de este job
    // Ningún `-e` / `--env-file`: el contenedor no recibe secretos (US-06.3).
    options.image,
    'robot',
    ...baseUrlVariable,
    '--outputdir',
    '/work/results',
    '/work/test.robot',
  ];
}
