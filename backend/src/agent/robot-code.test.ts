import { describe, expect, it } from 'vitest';
import { extractRobotCode } from './robot-code.js';

const robot = [
  '*** Settings ***',
  'Library    Browser',
  '',
  '*** Test Cases ***',
  'Login',
  '    New Page    http://x',
].join('\n');

describe('extractRobotCode', () => {
  it('devuelve tal cual un archivo .robot limpio', () => {
    expect(extractRobotCode(robot)).toBe(robot);
  });

  it('quita las vallas markdown (```robot ... ```)', () => {
    expect(extractRobotCode(`\`\`\`robot\n${robot}\n\`\`\``)).toBe(robot);
    expect(extractRobotCode(`\`\`\`\n${robot}\n\`\`\``)).toBe(robot);
  });

  it('descarta el texto explicativo antes y después de la valla', () => {
    const reply = `Aquí tienes el test:\n\`\`\`robot\n${robot}\n\`\`\`\nEspero que ayude.`;
    expect(extractRobotCode(reply)).toBe(robot);
  });

  it('sin valla, descarta el texto anterior a la primera sección *** ... ***', () => {
    expect(extractRobotCode(`Claro, aquí va:\n${robot}`)).toBe(robot);
  });

  it('acepta la sección en singular y en minúsculas (*** test case ***)', () => {
    const code = '*** test case ***\nLogin\n    Log    hi';
    expect(extractRobotCode(code)).toBe(code);
  });

  it('devuelve null si la respuesta está vacía o solo tiene espacios', () => {
    expect(extractRobotCode('')).toBeNull();
    expect(extractRobotCode('  \n ')).toBeNull();
  });

  it('devuelve null si es solo prosa, sin secciones de Robot', () => {
    expect(extractRobotCode('Lo siento, no puedo ayudarte con eso.')).toBeNull();
  });

  it('devuelve null si no hay sección Test Cases (p. ej. solo Settings)', () => {
    expect(extractRobotCode('*** Settings ***\nLibrary    Browser')).toBeNull();
  });
});
