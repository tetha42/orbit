export const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

export async function request(path, options = {}) {
	const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
	const headers = {
		...(options.body ? { 'Content-Type': 'application/json' } : {}),
		'cf-connecting-ip': '127.0.0.1',
		...options.headers,
	};

	const res = await fetch(url, {
		method: options.method || 'GET',
		headers,
		body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
	});

	let data = null;
	const text = await res.text();
	try {
		data = JSON.parse(text);
	} catch {
		data = text;
	}

	return {
		status: res.status,
		headers: res.headers,
		data,
	};
}
