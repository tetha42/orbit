import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * ESLint flat config.
 *
 * `next lint` was removed in Next 16, so the previous `pnpm lint` script silently
 * did nothing. eslint-config-next 16 exports flat configs directly, so no
 * eslintrc compatibility bridge is needed.
 */
/** Shared services live once, in src/core; these guard against old moved paths creeping back. */
const MOVED_PATHS = {
	group: ['@/lib/client/useJsonResource', '@/lib/client/appCommands', '@/lib/client/appEvents'],
	message: 'These modules moved to @/core/data and @/core/commands.',
};
/** Mini-apps read the workspace through focused hooks in src/core; the raw store is shell-only. */
const WORKSPACE_STORE = {
	group: ['@/state/workspaceStore'],
	message: 'Mini-apps read workspace state through @/core hooks (useSession, useI18n, useSound, useWindowActions, useShell).',
};

const config = [
	{
		ignores: [
			'.next/**',
			'.next-*/**',
			'node_modules/**',
			'.claude/**',
			// Served verbatim: pre-built 3D bundles and models.
			'public/**',
			'next-env.d.ts',
		],
	},
	...nextCoreWebVitals,
	...nextTypescript,
	{
		rules: {
			// `any` appears at a few API boundaries where the payload is genuinely
			// dynamic. Surfaced as a warning so the holes stay visible without
			// failing the build.
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
			],

			// Native alert()/confirm()/prompt() are unstyled, ignore the theme and the
			// language setting, and block the whole tab. Use `useDialog()` from
			// components/Common/DialogProvider instead.
			'no-alert': 'error',

			// JSX text uses apostrophes directly across supported locales.
			'react/no-unescaped-entities': 'off',

			// A React 19 rule that flags any setState inside an effect body.
			// Mount-time fetches and modal synchronization rely on this pattern;
			// turned off to keep the linter clean without unsafe architectural rewrites.
			'react-hooks/set-state-in-effect': 'off',

			// Scope expensive React component static-analysis rule strictly to TSX files below.
			'react-hooks/static-components': 'off',

			// Shared services live once, in src/core.
			'no-restricted-imports': ['error', { patterns: [MOVED_PATHS] }],
			'no-restricted-syntax': [
				'error',
				{
					selector: "Literal[value=/^text\\/csv/]",
					message: 'Use downloadCsv from @/core/data/download to export CSV files.',
				},
			],
		},
	},
	{
		files: ['**/*.tsx'],
		rules: {
			'react-hooks/static-components': 'error',
		},
	},
	{
		files: ['src/apps/**'],
		rules: { 'no-restricted-imports': ['error', { patterns: [MOVED_PATHS, WORKSPACE_STORE] }] },
	},
	{
		files: ['src/core/data/download.ts', 'src/app/api/**', 'scripts/**'],
		rules: { 'no-restricted-syntax': 'off' },
	},
];

export default config;
