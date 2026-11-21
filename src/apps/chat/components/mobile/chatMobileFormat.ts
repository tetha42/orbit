export function formatChatTime(ts?: number): string {
	if (!ts) return '';
	return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatChatDateTime(ts?: number): string {
	if (!ts) return '';
	const d = new Date(ts);
	return `${d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}
