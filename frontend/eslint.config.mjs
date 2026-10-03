import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// Reglas de Next.js + React + TypeScript. En la Fase 4 se genera la app Next.js sobre esta carpeta.
const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  { ignores: ['.next/', 'node_modules/'] },
  {
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
];

export default eslintConfig;
