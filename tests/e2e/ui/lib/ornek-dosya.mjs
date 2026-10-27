// Tiny real files for the upload tests (a receipt, a profile photo).

/** A valid 1×1 PNG. */
export const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/** A file for `locator.setInputFiles(...)`. */
export const png = (name = 'ornek.png') => ({ name, mimeType: 'image/png', buffer: PNG_1X1 });

/** Not an image: an HTML page under a .png name (the server must refuse it). */
export const sahtePng = (name = 'sahte.png') => ({ name, mimeType: 'image/png', buffer: Buffer.from('<html><script>1</script></html>') });
