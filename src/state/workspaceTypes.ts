import type { AppID, FocusTarget, FocusTargetInput, WindowState } from '@/types/workspace';
import type { ExtendedAppMetadata } from '@/configs/apps.config';
import type { I18nContextValue } from '@/core/i18n';
import type { SessionContextValue } from '@/core/session';
import type { SoundContextValue } from '@/core/sound';
import type { WindowActions } from '@/core/windows';
import type { ShellActions, ShellState } from '@/core/shell/shell';

/**
 * The old all-in-one value, for code that has not moved to the focused hooks
 * (`useSession`, `useI18n`, `useSound`, `useWindow`, `useShell`… in src/core).
 * It is the union of those modules' values and re-renders on any change of them.
 */
export type WorkspaceContextType = SessionContextValue &
	I18nContextValue &
	SoundContextValue &
	WindowActions &
	ShellState &
	ShellActions & {
		windows: Record<AppID, WindowState>;
		activeApp: AppID | 'portal';
		focusTarget: FocusTarget | null;
		isWindowCycleEnabled: boolean;
		setIsWindowCycleEnabled: (enabled: boolean) => void;
		/** Opens an app, optionally at a record: `openApp('events', { section, kind, itemId })`. */
		openApp: (id: AppID, target?: FocusTargetInput) => void;
		getAppMeta: (appId: AppID) => ExtendedAppMetadata;
	};
