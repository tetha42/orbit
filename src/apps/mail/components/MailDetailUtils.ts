export function buildSafeEmailSrcDoc(messageHtml: string, loadRemoteImages: boolean): string {
	if (!messageHtml) return '';
	const hasRemoteImages = /<img[^>]+src=["']https?:\/\//i.test(messageHtml);
	let processed = messageHtml;
	if (!loadRemoteImages && hasRemoteImages) {
		processed = processed.replace(
			/<img([^>]*?)src=(["'])(https?:\/\/[^"']+)\2/gi,
			'<img$1data-blocked-src=$2$3$2 style="display:none !important;"'
		);
	}
	processed = processed
		.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
		.replace(/<(?:iframe|frame|frameset|object|embed|applet|form|base|meta)\b[^>]*>/gi, '')
		.replace(/\bon[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
		.replace(/(href|src)\s*=\s*(["']?)\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^"'\s>]*/gi, '$1=$2#blocked');

	const imgPolicy = loadRemoteImages ? 'img-src https: http: data: cid:;' : 'img-src data: cid:;';

	return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; ${imgPolicy} font-src data:;" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<base target="_blank" rel="noopener noreferrer" />
<style>
  html, body {
    margin: 0;
    padding: 16px 20px;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.55;
    color: #1a1a1a;
    background: #ffffff;
    word-wrap: break-word;
    overflow-x: auto;
  }
  img { max-width: 100%; height: auto; }
  a { color: #0066cc; }
  pre { white-space: pre-wrap; word-break: break-word; }
</style>
</head>
<body>${processed}</body>
</html>`;
}
