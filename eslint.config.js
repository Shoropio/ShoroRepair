import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		// Build output, native shells and generated configs are not linted.
		ignores: ['dist', 'dev-dist', 'src-tauri', 'android', 'capacitor.config.ts', 'vite.config.ts']
	},
	{
		extends: [js.configs.recommended, ...tseslint.configs.recommended],
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			ecmaVersion: 2022,
			globals: globals.browser,
			parserOptions: { sourceType: 'module' }
		},
		plugins: {
			'react-hooks': reactHooks,
			'react-refresh': reactRefresh
		},
		rules: {
			...reactHooks.configs.recommended.rules,
			'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
			// Error-level: unused vars are a real defect signal in this codebase.
			// Catch-clause bindings are ignored via caughtErrorsIgnorePattern (so
			// `catch (_err)` is fine); rename real catch vars with a `_` prefix.
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
			],
			// Error-level: all legacy `any` usages have been replaced with real
			// types. This keeps the source tree `any`-free going forward. Test
			// files keep their own override (see below).
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-empty-object-type': 'off'
		}
	},
	// Test files legitimately lean on loose typing for mocks/fixtures; the
	// `any` rule is lexical-only there (no runtime impact).
	{
		files: ['**/*.test.ts', '**/*.test.tsx'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off'
		}
	}
);
