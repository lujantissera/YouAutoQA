// lint-staged ejecuta estos comandos SOLO sobre los archivos que están en el commit
// y les añade al final la lista de archivos.
// ESLint se lanza dentro de cada workspace (npm exec --workspace) para que use el
// eslint.config.mjs y la versión de ESLint de ese paquete, no la de la raíz.
export default {
  'backend/**/*.{ts,js,mjs,cjs}': [
    'npm exec --workspace backend -- eslint --fix --max-warnings=0',
    'prettier --write',
  ],
  'frontend/**/*.{ts,tsx,js,jsx,mjs,cjs}': [
    'npm exec --workspace frontend -- eslint --fix --max-warnings=0',
    'prettier --write',
  ],
  '*.{json,yml,yaml,css}': ['prettier --write'],
};
