export {
	INITIAL_WINDOWS,
	WindowsProvider,
	useActiveApp,
	useHasWindow,
	useIsActive,
	useWindow,
	useWindowActions,
	useWindowCycleSetting,
	useWindowFocusTarget,
	useWindowStore,
	useWindows,
} from './hooks';
export type { WindowActions, WindowStore, WindowsState } from './store';
export { MiniAppErrorBoundary, type MiniAppErrorBoundaryProps } from './MiniAppErrorBoundary';
