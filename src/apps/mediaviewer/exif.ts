/**
 * Small, dependency-free JPEG EXIF reader for the media viewer. It only needs
 * the handful of tags shown in the information panel, so it intentionally does
 * not expose the whole EXIF tree.
 */

export interface ExifValue {
	key: string;
	value: string;
}

const TAG_KEYS = new Map<number, string>([
	[0x010f, 'make'],
	[0x0110, 'model'],
	[0x0112, 'orientation'],
	[0x0131, 'software'],
	[0x0132, 'modified'],
	[0x9003, 'dateTaken'],
	[0x829a, 'exposure'],
	[0x829d, 'aperture'],
	[0x8827, 'iso'],
	[0x9202, 'apertureApex'],
	[0x920a, 'focalLength'],
	[0x9209, 'flash'],
	[0xa405, 'focalLength35'],
	[0x011a, 'xResolution'],
	[0x011b, 'yResolution'],
	[0x0128, 'resolutionUnit'],
	[0x9204, 'exposureBias'],
	[0x9207, 'meteringMode'],
	[0x9208, 'lightSource'],
	[0xa001, 'colorSpace'],
	[0xa002, 'pixelWidth'],
	[0xa003, 'pixelHeight'],
	[0x0001, 'gpsLatitudeRef'],
	[0x0002, 'gpsLatitude'],
	[0x0003, 'gpsLongitudeRef'],
	[0x0004, 'gpsLongitude'],
	[0x0005, 'gpsAltitudeRef'],
	[0x0006, 'gpsAltitude'],
]);

const TYPE_SIZE: Record<number, number> = {
	1: 1, // BYTE
	2: 1, // ASCII
	3: 2, // SHORT
	4: 4, // LONG
	5: 8, // RATIONAL
	7: 1, // UNDEFINED
	9: 4, // SLONG
	10: 8, // SRATIONAL
};

const LITTLE = 0x4949;

function readU16(view: DataView, offset: number, little: boolean): number {
	return view.getUint16(offset, little);
}

function readU32(view: DataView, offset: number, little: boolean): number {
	return view.getUint32(offset, little);
}

function readAscii(view: DataView, offset: number, length: number): string {
	let text = '';
	for (let i = 0; i < length; i += 1) {
		const code = view.getUint8(offset + i);
		if (code === 0) break;
		text += String.fromCharCode(code);
	}
	return text;
}

function readValue(
	view: DataView,
	type: number,
	count: number,
	offset: number,
	little: boolean
): number | string | number[] | null {
	const size = TYPE_SIZE[type];
	if (!size || offset < 0 || offset + size * count > view.byteLength) return null;

	if (type === 2) return readAscii(view, offset, count);

	const values: number[] = [];
	for (let i = 0; i < count; i += 1) {
		const at = offset + i * size;
		if (type === 1 || type === 7) values.push(view.getUint8(at));
		else if (type === 3) values.push(readU16(view, at, little));
		else if (type === 4) values.push(readU32(view, at, little));
		else if (type === 9) values.push(view.getInt32(at, little));
		else if (type === 5 || type === 10) {
			const numerator = type === 5 ? readU32(view, at, little) : view.getInt32(at, little);
			const denominator = type === 5 ? readU32(view, at + 4, little) : view.getInt32(at + 4, little);
			values.push(denominator === 0 ? 0 : numerator / denominator);
		}
	}
	return values.length === 1 ? values[0] : values;
}

function formatExposure(value: number | string | number[]): string {
	if (typeof value !== 'number') return String(value);
	if (value >= 1) return `${Number(value.toFixed(2))} s`;
	return `1/${Math.round(1 / value)} s`;
}

function formatAperture(value: number | string | number[]): string {
	if (typeof value !== 'number') return String(value);
	return `f/${Number(value.toFixed(1))}`;
}

function formatFocal(value: number | string | number[]): string {
	if (typeof value !== 'number') return String(value);
	return `${Number(value.toFixed(1))} mm`;
}

function formatGpsCoordinate(value: number[]): string {
	if (value.length < 3) return value.join(', ');
	return `${value[0]}° ${value[1]}' ${Number(value[2].toFixed(2))}"`;
}

function formatValue(key: string, value: number | string | number[]): string {
	if (Array.isArray(value)) {
		if (key === 'gpsLatitude' || key === 'gpsLongitude') return formatGpsCoordinate(value);
		return value.join(', ');
	}
	if (key === 'exposure') return formatExposure(value);
	if (key === 'aperture') return formatAperture(value);
	if (key === 'apertureApex' && typeof value === 'number') return `f/${Number(Math.pow(2, value / 2).toFixed(1))}`;
	if (key === 'colorSpace' && typeof value === 'number') {
		return value === 1 ? 'sRGB' : value === 2 ? 'Adobe RGB' : value === 65535 ? 'Uncalibrated' : String(value);
	}
	if (key === 'focalLength' || key === 'focalLength35') return formatFocal(value);
	if (key === 'xResolution' || key === 'yResolution') return `${Number(Number(value).toFixed(1))} dpi`;
	if (key === 'resolutionUnit') return Number(value) === 3 ? 'cm' : 'inch';
	if (key === 'orientation') return String(value);
	return String(value);
}

interface TiffResult {
	values: Map<string, string>;
}

function parseIfd(
	view: DataView,
	base: number,
	offset: number,
	little: boolean,
	result: TiffResult,
	visited: Set<number>
): void {
	const absolute = base + offset;
	if (offset < 0 || absolute + 2 > view.byteLength || visited.has(absolute)) return;
	visited.add(absolute);
	const count = readU16(view, absolute, little);
	if (!Number.isFinite(count) || count > 2048) return;

	let exifOffset: number | null = null;
	let gpsOffset: number | null = null;

	for (let i = 0; i < count; i += 1) {
		const entry = absolute + 2 + i * 12;
		if (entry + 12 > view.byteLength) break;
		const tag = readU16(view, entry, little);
		const type = readU16(view, entry + 2, little);
		const itemCount = readU32(view, entry + 4, little);
		const size = TYPE_SIZE[type];
		if (!size) continue;
		const valueOffset = size * itemCount <= 4 ? entry + 8 : base + readU32(view, entry + 8, little);
		const value = readValue(view, type, itemCount, valueOffset, little);
		if (value === null) continue;

		if (tag === 0x8769 && typeof value === 'number') exifOffset = value;
		else if (tag === 0x8825 && typeof value === 'number') gpsOffset = value;
		else {
			const key = TAG_KEYS.get(tag);
			if (key) result.values.set(key, formatValue(key, value));
		}
	}

	if (exifOffset !== null) parseIfd(view, base, exifOffset, little, result, visited);
	if (gpsOffset !== null) {
		const gps = new Map<string, string>();
		const gpsResult: TiffResult = { values: gps };
		parseIfd(view, base, gpsOffset, little, gpsResult, visited);
		const lat = gps.get('gpsLatitude');
		const lon = gps.get('gpsLongitude');
		if (lat && lon) {
			const latRef = gps.get('gpsLatitudeRef') ?? '';
			const lonRef = gps.get('gpsLongitudeRef') ?? '';
			result.values.set('gps', `${latRef} ${lat}, ${lonRef} ${lon}`.trim());
		}
	}
}

function parseTiff(view: DataView, base: number): ExifValue[] {
	if (base + 8 > view.byteLength) return [];
	const little = readU16(view, base, false) === LITTLE;
	if (readU16(view, base + 2, little) !== 42) return [];
	const firstIfd = readU32(view, base + 4, little);
	const result: TiffResult = { values: new Map() };
	parseIfd(view, base, firstIfd, little, result, new Set());
	return Array.from(result.values, ([key, value]) => ({ key, value }));
}

/** Reads the EXIF block of a JPEG; other containers return an empty list. */
export function readExif(buffer: ArrayBuffer): ExifValue[] {
	const view = new DataView(buffer);
	if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return [];
	let offset = 2;
	while (offset + 4 <= view.byteLength) {
		const marker = view.getUint16(offset, false);
		offset += 2;
		if (marker === 0xffda || marker === 0xffd9) break;
		if ((marker & 0xff00) !== 0xff00) break;
		if (marker === 0xffe1) {
			const length = view.getUint16(offset, false);
			offset += 2;
			if (length < 8 || offset + length - 2 > view.byteLength) break;
			if (readAscii(view, offset, 4) === 'Exif') {
				return parseTiff(view, offset + 6);
			}
			offset += length - 2;
			continue;
		}
		if (marker === 0xff01 || (marker >= 0xffd0 && marker <= 0xffd7)) continue;
		if (offset + 2 > view.byteLength) break;
		const length = view.getUint16(offset, false);
		if (length < 2) break;
		offset += length;
	}
	return [];
}
