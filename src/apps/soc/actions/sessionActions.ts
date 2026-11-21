export async function postSocAction(payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string; data?: Record<string, unknown> }> {
	const res = await fetch('/api/soc', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		return { ok: false, error: typeof data.error === 'string' ? data.error : undefined, data };
	}
	return { ok: true, data };
}

export async function executeKillSession(userId: string) {
	return postSocAction({ action: 'kill_session', userId });
}

export async function executeKillAllOtherSessions() {
	return postSocAction({ action: 'kill_all_sessions' });
}

export async function executeRevokeAnomalousSessions() {
	return postSocAction({ action: 'revoke_anomalies' });
}

export async function executeSuspendUser(userId: string) {
	return postSocAction({ action: 'suspend_user', userId });
}
