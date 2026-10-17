import { describe, expect, it } from 'vitest';
import { loadRunnerConfig } from './config.js';

const validEnv = {
  RF_RUNNER_IMAGE: 'marketsquare/robotframework-browser:20.6.0',
  RF_RUNNER_MEMORY: '2g',
  RF_RUNNER_CPUS: '2',
  RF_RUNNER_PIDS_LIMIT: '512',
  AUT_BASE_URL: 'https://www.saucedemo.com',
};

describe('loadRunnerConfig', () => {
  it('lee la imagen, los límites y la URL de la app del entorno', () => {
    expect(loadRunnerConfig(validEnv)).toEqual({
      image: 'marketsquare/robotframework-browser:20.6.0',
      memory: '2g',
      cpus: '2',
      pidsLimit: 512,
      baseUrl: 'https://www.saucedemo.com',
    });
  });

  it('usa valores por defecto seguros para los límites que faltan', () => {
    const config = loadRunnerConfig({ RF_RUNNER_IMAGE: validEnv.RF_RUNNER_IMAGE });

    expect(config.memory).toBe('1g');
    expect(config.cpus).toBe('1');
    expect(config.pidsLimit).toBe(256);
  });

  it('no incluye baseUrl si AUT_BASE_URL no está definida', () => {
    const config = loadRunnerConfig({ RF_RUNNER_IMAGE: validEnv.RF_RUNNER_IMAGE });

    expect(config.baseUrl).toBeUndefined();
  });

  it('exige la imagen: sin ella falla nombrando la variable', () => {
    expect(() => loadRunnerConfig({})).toThrow(/RF_RUNNER_IMAGE/);
  });

  it('trata una imagen vacía o solo con espacios como ausente', () => {
    expect(() => loadRunnerConfig({ RF_RUNNER_IMAGE: '   ' })).toThrow(/RF_RUNNER_IMAGE/);
  });

  it('rechaza un límite de procesos que no sea un entero positivo', () => {
    for (const bad of ['abc', '0', '-5', '1.5']) {
      expect(() => loadRunnerConfig({ ...validEnv, RF_RUNNER_PIDS_LIMIT: bad })).toThrow(
        /RF_RUNNER_PIDS_LIMIT/,
      );
    }
  });

  it('rechaza un límite de CPU que no sea un número positivo', () => {
    for (const bad of ['abc', '0', '-1']) {
      expect(() => loadRunnerConfig({ ...validEnv, RF_RUNNER_CPUS: bad })).toThrow(
        /RF_RUNNER_CPUS/,
      );
    }
  });

  it('rechaza un límite de memoria con formato inválido', () => {
    for (const bad of ['mucha', '1.5g', 'g1']) {
      expect(() => loadRunnerConfig({ ...validEnv, RF_RUNNER_MEMORY: bad })).toThrow(
        /RF_RUNNER_MEMORY/,
      );
    }
  });
});
