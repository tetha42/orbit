import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * ESLint flat config.
 *
 * `next lint` was removed in Next 16, so the previous `pnpm lint` script silently
 * did nothing. eslint-config-next 16 exports flat configs directly, so no
 * eslintrc compatibility bridge is needed.
 */
/** Shared services live once, in src/core; these stop the copies (and the old paths) from creeping back. */
const KANBAN_CSS = { group: ['**/Teams/Kanban.module.css'], message: 'Genel kontroller için @/core/ui/ui.module.css kullanın; Kanban.module.css yalnız panoya özeldir.' };
const MOVED_PATHS = { group: ['@/lib/client/useJsonResource', '@/lib/client/appCommands', '@/lib/client/appEvents'], message: 'Bunlar @/core/data ve @/core/commands altına taşındı.' };
/** The apps read the workspace through the focused hooks of src/core; the all-in-one store is for the shell. */
const WORKSPACE_STORE = {
	group: ['@/state/workspaceStore'],
	message: 'Uygulamalar çalışma alanını @/core kancalarıyla okur: useSession, useI18n, useSound, useWindow…, useShell (src/core).',
};

const config = [
	{
		ignores: [
			'.next/**',
			'.next-*/**',
			'node_modules/**',
			'beuteknoloji-landing/**',
			'demo-app/**',
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

			// The UI is written in Turkish, where an apostrophe is ordinary
			// orthography ("Passkey'ler", "URL'si"). Escaping every one of them to
			// `&#39;` would hurt readability for no rendering benefit — these
			// characters are unambiguous inside JSX text.
			'react/no-unescaped-entities': 'off',

			// A React 19 rule that flags any setState inside an effect body.
			// Mount-time fetches and modal synchronization rely on this pattern;
			// turned off to keep the linter clean without unsafe architectural rewrites.
			'react-hooks/set-state-in-effect': 'off',

			// Shared services live once, in src/core. These rules stop the copies
			// from creeping back: a second toast, a private CSV download, a local
			// HTML escaper, the Kanban stylesheet borrowed for generic buttons.
			'no-restricted-imports': ['error', { patterns: [KANBAN_CSS, MOVED_PATHS] }],
			'no-restricted-syntax': [
				'error',
				{
					selector: "Literal[value=/^text\\/csv/]",
					message: 'CSV indirmek için @/core/data/download içindeki downloadCsv kullanın.',
				},
			],
		},
	},
	{
		files: ['src/components/WorkspaceApps/**'],
		rules: { 'no-restricted-imports': ['error', { patterns: [KANBAN_CSS, MOVED_PATHS, WORKSPACE_STORE] }] },
	},
	{
		// The Kanban board's own files are the stylesheet's legitimate users.
		files: ['src/components/WorkspaceApps/Teams/{KanbanBoard,TaskDetailModal,NewTaskModal,LabelEditor}.tsx'],
		rules: { 'no-restricted-imports': ['error', { patterns: [MOVED_PATHS, WORKSPACE_STORE] }] },
	},
	{
		files: ['src/core/data/download.ts', 'src/app/api/**', 'scripts/**'],
		rules: { 'no-restricted-syntax': 'off' },
	},
];

export default config;
