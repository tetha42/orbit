/**
 * Resilient clipboard helper with fallbacks for permissions, insecure contexts,
 * and iframe environments.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
	if (typeof window === 'undefined') return false;

	// Modern asynchronous Clipboard API
	if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			// Fall through to legacy execCommand fallback
		}
	}

	// Legacy execCommand('copy') fallback for restricted origins or mobile webviews
	try {
		const textArea = document.createElement('textarea');
		textArea.value = text;
		textArea.style.position = 'fixed';
		textArea.style.left = '-9999px';
		textArea.style.top = '-9999px';
		textArea.style.opacity = '0';
		textArea.setAttribute('readonly', '');
		document.body.appendChild(textArea);
		textArea.focus();
		textArea.select();
		const successful = document.execCommand('copy');
		document.body.removeChild(textArea);
		return successful;
	} catch {
		return false;
	}
}
