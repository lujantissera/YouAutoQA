import { describe, expect, it } from 'vitest';
import {
  extractFailureMessage,
  isCodeError,
  isEnvironmentFailure,
  isRepeatedError,
  normalizeError,
} from './failure.js';
import type { RunResult } from './ports.js';
import { EMPTY_TEST_LOGS } from './robot-code.js';

const failWith = (logs: string, timedOut = false): RunResult => ({
  result: 'FAIL',
  logs,
  timedOut,
});

// Un fallo de entorno (la web no carga, red caída, timeout global) no se arregla cambiando el
// test ni preguntando al usuario. Ojo: un timeout esperando un SELECTOR no es de entorno.
describe('isEnvironmentFailure', () => {
  it('es verdadero si el runner cortó por timeout global (RNF-2)', () => {
    expect(isEnvironmentFailure(failWith('', true))).toBe(true);
  });

  it('es verdadero si la navegación falla por red (net::ERR_*)', () => {
    const logs = 'page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/';
    expect(isEnvironmentFailure(failWith(logs))).toBe(true);
  });

  it('es verdadero si la página tarda demasiado en cargar (page.goto: Timeout)', () => {
    expect(isEnvironmentFailure(failWith('page.goto: Timeout 30000ms exceeded.'))).toBe(true);
  });

  it('es verdadero con errores de conexión de Node (ECONNREFUSED)', () => {
    expect(isEnvironmentFailure(failWith('Error: connect ECONNREFUSED 127.0.0.1:3000'))).toBe(true);
  });

  it('es verdadero si Docker no está disponible (Docker Desktop apagado en Windows)', () => {
    const logs =
      'failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; ' +
      'check if the path is correct and if the daemon is running';
    expect(isEnvironmentFailure(failWith(logs))).toBe(true);
  });

  it('es verdadero si el demonio de Docker no responde (Linux)', () => {
    const logs = 'Cannot connect to the Docker daemon at unix:///var/run/docker.sock.';
    expect(isEnvironmentFailure(failWith(logs))).toBe(true);
  });

  it('es falso con un timeout esperando un selector: ahí el selector puede estar mal', () => {
    const logs = 'Click: Timeout 10000ms exceeded. waiting for locator("#login")';
    expect(isEnvironmentFailure(failWith(logs))).toBe(false);
  });

  it('es falso con un error de elemento o de valor esperado', () => {
    expect(isEnvironmentFailure(failWith("Element 'id=login' not found"))).toBe(false);
  });
});

// Errores que son culpa del código generado (no de la US): repetirlos no justifica preguntar.
describe('isCodeError', () => {
  it('detecta una keyword inexistente', () => {
    expect(isCodeError("No keyword with name 'Click Buton' found.")).toBe(true);
  });

  it('detecta un error de sintaxis del archivo', () => {
    expect(isCodeError("[ ERROR ] Error in file '/tests/t.robot' on line 4: bad")).toBe(true);
  });

  it('detecta una librería que no se pudo importar', () => {
    expect(isCodeError("Importing library 'Browsr' failed: ModuleNotFoundError")).toBe(true);
  });

  it('detecta que el LLM no devolvió un test usable (US-05.3)', () => {
    expect(isCodeError(EMPTY_TEST_LOGS)).toBe(true);
  });

  it('es falso con un fallo de elemento o de valor (eso sí puede ser falta de información)', () => {
    expect(isCodeError("Element 'id=login' not found")).toBe(false);
  });
});

// US-10.3 / D-21: dos intentos seguidos que fallan por lo mismo => falta información.
describe('isRepeatedError', () => {
  it('es falso si no hay un intento anterior (primer fallo)', () => {
    expect(isRepeatedError(undefined, "Element 'login' not found")).toBe(false);
  });

  it('es verdadero con dos errores idénticos', () => {
    const log = "Element 'id=login' not found";
    expect(isRepeatedError(log, log)).toBe(true);
  });

  it('es verdadero si solo cambian números (tiempos, líneas)', () => {
    const before = "Element 'id=login' not found after 5.2 seconds (line 12)";
    const after = "Element 'id=login' not found after 5.4 seconds (line 14)";
    expect(isRepeatedError(before, after)).toBe(true);
  });

  it('ignora mayúsculas y espacios de más', () => {
    expect(isRepeatedError("Element  'Login' NOT found", "element 'login' not   found")).toBe(true);
  });

  it('es falso si el error es distinto de verdad', () => {
    const before = "Element 'id=login' not found";
    const after = "Element 'id=password' not found";
    expect(isRepeatedError(before, after)).toBe(false);
  });
});

describe('normalizeError', () => {
  it('sustituye los números por # y pasa a minúsculas', () => {
    expect(normalizeError('Timeout after 5.2 SECONDS at line 12')).toBe(
      'timeout after #.# seconds at line #',
    );
  });
});

// Un log real de Robot: el ERROR está bajo la línea "| FAIL |"; lo demás (nombre del test,
// resumen, rutas de salida) puede cambiar entre intentos aunque el error sea el mismo.
const robotLog = (testName: string, message: string): string =>
  [
    '==============================================================================',
    `${testName.padEnd(70)}| FAIL |`,
    message,
    '------------------------------------------------------------------------------',
    `${'Suite'.padEnd(70)}| FAIL |`,
    '1 test, 0 passed, 1 failed',
    '==============================================================================',
    'Output:  /work/results/output.xml',
  ].join('\n');

describe('extractFailureMessage', () => {
  it('se queda con el mensaje bajo la primera línea | FAIL |', () => {
    const logs = robotLog('Login', "Element 'login' not found");
    expect(extractFailureMessage(logs)).toBe("Element 'login' not found");
  });

  it('conserva un mensaje de varias líneas (p. ej. el Call log de Playwright)', () => {
    const message = 'TimeoutError: waiting\nCall log:\n  - waiting for locator("#login")';
    expect(extractFailureMessage(robotLog('Login', message))).toBe(message);
  });

  it('si el log no tiene esa forma (p. ej. un error de Docker), devuelve el log entero', () => {
    const logs = 'failed to connect to the docker API';
    expect(extractFailureMessage(logs)).toBe(logs);
  });
});

describe('isRepeatedError con logs reales de Robot', () => {
  it('es verdadero si el error es el mismo aunque cambie el nombre del test', () => {
    const before = robotLog('Login Test', "Element 'login' not found");
    const after = robotLog('Otro Nombre Distinto', "Element 'login' not found");
    expect(isRepeatedError(before, after)).toBe(true);
  });

  it('es falso si el error cambia aunque todo lo demás sea igual', () => {
    const before = robotLog('Login Test', "Element 'login' not found");
    const after = robotLog('Login Test', "Element 'password' not found");
    expect(isRepeatedError(before, after)).toBe(false);
  });
});
