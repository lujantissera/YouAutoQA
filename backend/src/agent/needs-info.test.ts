import { describe, expect, it } from 'vitest';
import { parseNeedsInfo } from './needs-info.js';

// D-41: al corregir, el modelo puede responder "NEEDS_INFO: <pregunta>" en vez de código.
describe('parseNeedsInfo', () => {
  it('extrae la pregunta de una respuesta NEEDS_INFO', () => {
    expect(parseNeedsInfo('NEEDS_INFO: ¿Dónde se da de baja la cuenta?')).toBe(
      '¿Dónde se da de baja la cuenta?',
    );
  });

  it('ignora mayúsculas, espacios alrededor y valla markdown', () => {
    expect(parseNeedsInfo('  needs_info:   ¿Dónde?  \n')).toBe('¿Dónde?');
    expect(parseNeedsInfo('```\nNEEDS_INFO: ¿Dónde?\n```')).toBe('¿Dónde?');
  });

  it('conserva una pregunta de varias líneas', () => {
    expect(parseNeedsInfo('NEEDS_INFO: ¿Dónde?\nTambién, ¿con qué usuario?')).toBe(
      '¿Dónde?\nTambién, ¿con qué usuario?',
    );
  });

  it('devuelve null con un .robot normal', () => {
    expect(parseNeedsInfo('*** Test Cases ***\nLogin\n    Log    hi')).toBeNull();
  });

  it('devuelve null si NEEDS_INFO aparece dentro del código y no al principio', () => {
    expect(parseNeedsInfo('*** Test Cases ***\nLogin\n    Log    NEEDS_INFO: x')).toBeNull();
  });

  it('devuelve null si la pregunta está vacía', () => {
    expect(parseNeedsInfo('NEEDS_INFO:')).toBeNull();
    expect(parseNeedsInfo('NEEDS_INFO:   ')).toBeNull();
  });
});
