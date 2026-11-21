export type { ClosedSessionInfo } from './terminal/typesAndState';
export { getTerminalSession, getRecentlyClosedSession } from './terminal/typesAndState';
export {
	createTerminalSession,
	writeToTerminal,
	resizeTerminalSession,
	closeTerminalSession,
	closeUserTerminalSessions,
} from './terminal/sessionLifecycle';
