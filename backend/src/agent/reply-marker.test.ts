import { describe, expect, it } from 'vitest';
import { parseReplyMarker } from './reply-marker.js';

describe('parseReplyMarker', () => {
  it('extrae el texto que sigue al marcador', () => {
    expect(parseReplyMarker('CANNOT_TEST: La web no tiene baja', 'CANNOT_TEST')).toBe(
      'La web no tiene baja',
    );
  });

  it('ignora mayúsculas, espacios alrededor y valla markdown', () => {
    expect(parseReplyMarker('  cannot_test:   motivo  \n', 'CANNOT_TEST')).toBe('motivo');
    expect(parseReplyMarker('```\nCANNOT_TEST: motivo\n```', 'CANNOT_TEST')).toBe('motivo');
  });

  it('solo reconoce el marcador pedido', () => {
    expect(parseReplyMarker('NEEDS_INFO: ¿Dónde?', 'CANNOT_TEST')).toBeNull();
  });

  it('solo cuenta al principio de la respuesta, no dentro del código', () => {
    const code = '*** Test Cases ***\nLogin\n    Log    CANNOT_TEST: x';
    expect(parseReplyMarker(code, 'CANNOT_TEST')).toBeNull();
  });

  it('devuelve null si no hay texto tras el marcador', () => {
    expect(parseReplyMarker('CANNOT_TEST:', 'CANNOT_TEST')).toBeNull();
    expect(parseReplyMarker('CANNOT_TEST:   ', 'CANNOT_TEST')).toBeNull();
  });
});
