/**
 * Client-side image compression using HTML5 Canvas & createImageBitmap.
 * Scales down high-resolution smartphone photos (5-10MB) to maximum dimensions
 * and converts them to efficient WebP (or JPEG fallback) prior to HTTP upload.
 */
export async function compressImageToWebp(
	file: File,
	maxDimension = 1280,
	quality = 0.85
): Promise<Blob> {
	// If not an image (e.g. PDF), return original file as-is
	if (!file.type.startsWith('image/')) {
		return file;
	}

	// SVG is already vector and lightweight
	if (file.type === 'image/svg+xml') {
		return file;
	}

	try {
		const bitmap = await createImageBitmap(file);
		let { width, height } = bitmap;

		// Scale down if either dimension exceeds maxDimension while preserving aspect ratio
		if (width > maxDimension || height > maxDimension) {
			if (width > height) {
				height = Math.round((height * maxDimension) / width);
				width = maxDimension;
			} else {
				width = Math.round((width * maxDimension) / height);
				height = maxDimension;
			}
		}

		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;

		const ctx = canvas.getContext('2d');
		if (!ctx) {
			return file;
		}

		ctx.drawImage(bitmap, 0, 0, width, height);

		const toBlob = (type: string, q: number) =>
			new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, q));

		const webpBlob = await toBlob('image/webp', quality);
		if (webpBlob && webpBlob.type === 'image/webp') {
			return webpBlob;
		}

		const jpegBlob = await toBlob('image/jpeg', quality);
		if (jpegBlob) {
			return jpegBlob;
		}

		return file;
	} catch {
		// Fallback if browser doesn't support createImageBitmap or canvas fails
		return file;
	}
}
