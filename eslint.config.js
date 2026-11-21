// Lint for bugs and for this repo's conventions (AGENTS.md); formatting is Prettier's job.
import js from '@eslint/js';
import perfectionist from 'eslint-plugin-perfectionist';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

export default ts.config(
  { ignores: ['dist/', 'node_modules/'] },
  js.configs.recommended,
  ...ts.configs.recommendedTypeChecked,
  ...svelte.configs.recommended,
  {
    // Sorted where order means nothing at run time: type members, unions and exports (`just fmt`
    // fixes them). Not object literals: CHOICES, DIFFICULTIES and the like are read in order.
    plugins: { perfectionist },
    settings: { perfectionist: { type: 'natural', ignoreCase: true } },
    rules: {
      'perfectionist/sort-interfaces': 'error',
      'perfectionist/sort-object-types': 'error',
      'perfectionist/sort-union-types': 'error',
      'perfectionist/sort-intersection-types': 'error',
      'perfectionist/sort-exports': 'error',
      'perfectionist/sort-named-exports': 'error',
      // Attributes in one order; never moved across a {...spread}, which overrides what's before it.
      'svelte/sort-attributes': 'error',
    },
  },
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Promises: deals and puzzles are made in workers, and GameScreen2's onstart / onnext return them.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      // A new action kind must be handled in every reducer switch.
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: true },
      ],
      // Unused names are already errors in tsconfig (noUnusedLocals / noUnusedParameters).
      '@typescript-eslint/no-unused-vars': 'off',
      // Off: typescript-eslint can't read the types of .svelte imports, so these flag them as
      // `any`; the rest is JSON.parse and Array().fill, and svelte-check already runs strict.
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // `a ? (x = 1) : (y = 2);` as a statement is fine.
      '@typescript-eslint/no-unused-expressions': ['error', { allowTernary: true }],
      // Only the icons used get built in: import each by its own path.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@lucide/svelte',
              message: "Import each icon by its path: '@lucide/svelte/icons/<name>'.",
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'navigator',
          property: 'vibrate',
          message: 'No vibration: feedback is visual only.',
        },
      ],
    },
  },
  {
    // `let [a, b] = ...` stays let when either is reassigned. (Svelte files keep the plugin's own
    // rule, which knows `let { ... } = $props()` must be let.)
    files: ['**/*.ts', '**/*.js'],
    ignores: ['**/*.svelte.ts'],
    rules: { 'prefer-const': ['error', { destructuring: 'all' }] },
  },
  {
    // Svelte components: let the Svelte parser hand <script lang="ts"> to typescript-eslint.
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parserOptions: { parser: ts.parser } },
    rules: {
      // It can't see the types Svelte gives, so it calls needed assertions unnecessary.
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    },
  },
  {
    // Saves go through shared/storage.ts, which never throws.
    files: ['src/**/*.ts', 'src/**/*.svelte'],
    ignores: ['src/shared/storage.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Use loadJSON / saveJSON from src/shared/storage.ts.' },
      ],
    },
  },
  {
    // logic.ts and game.ts are pure: no DOM, no Svelte.
    files: ['src/**/logic.ts', 'src/**/game.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: '@lucide/svelte', message: 'No icons in pure rules.' }],
          patterns: [
            {
              group: ['svelte', 'svelte/*', '*.svelte'],
              allowTypeImports: true,
              message: 'logic.ts and game.ts stay pure.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'location'].map(
          (name) => ({ name, message: 'logic.ts and game.ts stay pure: no DOM.' }),
        ),
      ],
    },
  },
  {
    // Plain config and the one-off scripts: no type-aware linting outside tsconfig's files.
    files: ['*.js', 'scripts/**'],
    ...ts.configs.disableTypeChecked,
  },
);
