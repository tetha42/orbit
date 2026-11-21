export interface InspectionActionResult {
	ok: boolean;
	error?: string;
	data?: Record<string, unknown>;
}

async function postInspectionAction(
	payload: Record<string, unknown>,
	signal?: AbortSignal
): Promise<InspectionActionResult> {
	const res = await fetch('/api/soc/inspection', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
		signal,
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		return {
			ok: false,
			error: typeof data.error === 'string' ? data.error : undefined,
			data,
		};
	}
	return { ok: true, data };
}

export async function executeTriggerFimScan(
	target: string,
	signal?: AbortSignal
): Promise<InspectionActionResult> {
	return postInspectionAction({ action: 'scan_fim', target }, signal);
}

export async function executeTriggerApiScan(
	signal?: AbortSignal
): Promise<InspectionActionResult> {
	return postInspectionAction({ action: 'scan_api' }, signal);
}

export async function executeCreateBaseline(
	target: string,
	signal?: AbortSignal
): Promise<InspectionActionResult> {
	return postInspectionAction({ action: 'create_baseline', target }, signal);
}

export async function executeProbeRoute(
	endpoint: string,
	signal?: AbortSignal
): Promise<InspectionActionResult> {
	return postInspectionAction({ action: 'probe_route', endpoint }, signal);
}
