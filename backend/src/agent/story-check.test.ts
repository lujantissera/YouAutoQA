import { describe, expect, it } from 'vitest';
import { parseStoryCheck } from './story-check.js';

describe('parseStoryCheck', () => {
  it('lee una US lista', () => {
    expect(parseStoryCheck('{"ready": true}')).toEqual({ ready: true });
  });

  it('lee una US a la que le falta información, con su pregunta', () => {
    const text = '{"ready": false, "question": "¿Qué usuario y contraseña uso?"}';
    expect(parseStoryCheck(text)).toEqual({
      ready: false,
      question: '¿Qué usuario y contraseña uso?',
    });
  });

  it('acepta el JSON envuelto en una valla markdown', () => {
    expect(parseStoryCheck('```json\n{"ready": true}\n```')).toEqual({ ready: true });
  });

  it('recorta los espacios de la pregunta', () => {
    expect(parseStoryCheck('{"ready": false, "question": "  ¿Dónde?  "}')).toEqual({
      ready: false,
      question: '¿Dónde?',
    });
  });

  // Fail-open: si no podemos fiarnos de la respuesta, no bloqueamos al usuario.
  it('deja pasar si la respuesta no es JSON', () => {
    expect(parseStoryCheck('Creo que está bien')).toEqual({ ready: true });
  });

  it('deja pasar si falta la pregunta o está vacía', () => {
    expect(parseStoryCheck('{"ready": false}')).toEqual({ ready: true });
    expect(parseStoryCheck('{"ready": false, "question": "  "}')).toEqual({ ready: true });
  });

  it('deja pasar si el JSON tiene otra forma', () => {
    expect(parseStoryCheck('{"ok": true}')).toEqual({ ready: true });
    expect(parseStoryCheck('[]')).toEqual({ ready: true });
  });
});
