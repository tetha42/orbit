/**
 * Ambient declarations for browser APIs this app uses that TypeScript's DOM lib
 * does not ship, and for the globals the pre-built 3D bundle attaches to `window`.
 *
 * Declaring them here removes the `(window as any)` casts that were scattered
 * through the components, and gives the 3D integration a checked surface.
 */

/** A page or chapter inside the 3D scene. */
interface WebGLSceneNode {
	isLoaded?: boolean;
	isActive?: boolean;
	load?: () => Promise<void> | void;
	enter?: () => void;
	beforeEnter?: () => void;
	afterEnter?: () => void;
	/** Chapters live on pages; pages do not nest further. */
	chapters?: Record<string, WebGLSceneNode>;
}

/** The shape of the 3D scene bundle loaded from /_astro. */
interface WebGLAppHandle {
	$wrapper?: HTMLElement;
	$canvas?: HTMLCanvasElement;
	init: (wrapper: HTMLElement, canvas: HTMLCanvasElement) => Promise<void> | void;
	state?: { emit: (event: unknown, payload?: unknown) => void };
	webgl?: {
		renderer?: { domElement?: HTMLCanvasElement };
		pages?: Record<string, WebGLSceneNode>;
		currentPage?: WebGLSceneNode;
	};
	tools?: { viewport?: { resize?: () => void; infos?: unknown } };
	core?: { ticker?: { play?: () => void; pause?: () => void } };
}

interface Window {
	/** Set once the bundle has booted; it registers global listeners and tickers. */
	__3d_inited?: boolean;
	__webgl_app?: WebGLAppHandle;
}

/** Chromium-only; feature-detected before use. */
interface BarcodeDetectorResult {
	rawValue: string;
}

declare class BarcodeDetector {
	constructor(options?: { formats?: string[] });
	detect(source: CanvasImageSource): Promise<BarcodeDetectorResult[]>;
	static getSupportedFormats(): Promise<string[]>;
}

interface Window {
	BarcodeDetector?: typeof BarcodeDetector;
}

/** Battery Status API — not in lib.dom. */
interface BatteryManager extends EventTarget {
	charging: boolean;
	chargingTime: number;
	dischargingTime: number;
	level: number;
	onchargingchange: ((this: BatteryManager, ev: Event) => unknown) | null;
	onlevelchange: ((this: BatteryManager, ev: Event) => unknown) | null;
}

interface Navigator {
	getBattery?: () => Promise<BatteryManager>;
}

/** Safari's legacy prefixed AudioContext. */
interface Window {
	webkitAudioContext?: typeof AudioContext;
}
