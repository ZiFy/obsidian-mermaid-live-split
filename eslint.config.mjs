import tseslint from 'typescript-eslint';
export default tseslint.config(...tseslint.configs.recommended, { ignores: ['main.js', 'node_modules/**', '.npm-cache/**'] });
