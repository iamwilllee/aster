import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import asterUi from './scripts/eslint-ui.mjs'

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.wrangler/**',
      '.tanstack/**',
      'worker-configuration.d.ts',
      'src/routeTree.gen.ts',
      // Flatpack sources, copied unmodified by scripts/flatpack-sync.mjs.
      'src/components/flatpack/**',
      'playwright-report/**',
      'test-results/**',
      'qa/**',
      '.local/**',
    ],
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx'],
  })),
  {
    files: ['src/**/*.tsx'],
    ignores: ['src/components/ui/**'],
    plugins: { 'aster-ui': asterUi },
    rules: {
      'aster-ui/no-native-controls': 'error',
      'aster-ui/control-geometry': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@base-ui/react', '@base-ui/react/*'],
              message:
                'Import the project UI wrapper. Base UI primitives belong in src/components/ui/.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
  {
    files: ['src/components/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          allowExportNames: ['buttonProps', 'useI18n'],
        },
      ],
    },
  },
  {
    // Router redirects and notFound use thrown response objects for control flow.
    files: ['src/routes/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      '@typescript-eslint/only-throw-error': 'off',
      ...reactHooks.configs.recommended.rules,
    },
  },
)
