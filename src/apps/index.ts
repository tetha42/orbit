/**
 * The app registry: every manifest under src/apps/<id>/, and the types and
 * ordered lists the rest of the portal is derived from. Pure — the server reads
 * it too (permissions), and so does scripts/check-pure.mjs.
 *
 * Nothing here is edited to add an app: drop a folder with a manifest.ts into
 * src/apps (see README.md).
 */
import { MANIFESTS } from './registry.gen.ts';
import type { AppManifest, WindowManifest } from '../core/apps/manifest.ts';

type Manifest = (typeof MANIFESTS)[number];

/** Every app a role can be granted, with or without a window. */
export type YetkiUygulamasi = Manifest['id'];
/** The apps that have a window on the desktop. */
export type AppID = Extract<Manifest, { window: object }>['id'];

/** The notification kinds the apps declare (`notifications` in a manifest). */
export type NotificationKind = Manifest extends infer M ? (M extends { notifications: infer N } ? keyof N & string : never) : never;

// Every app with a window is a permission app: it is one by construction, since
// both come from the same manifest — and a manifest without `permission` does
// not compile (`satisfies AppManifest`).
type HerUygulamaYetkili = [AppID] extends [YetkiUygulamasi] ? true : never;
const _herUygulamaYetkili: HerUygulamaYetkili = true;
void _herUygulamaYetkili;

const byPosition = <T extends AppManifest>(position: (m: T) => number | undefined) => (a: T, b: T) =>
	(position(a) ?? Infinity) - (position(b) ?? Infinity) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** All manifests, in the order the role editor lists them. */
export const ALL_MANIFESTS: readonly AppManifest[] = [...MANIFESTS].sort(byPosition<AppManifest>((m) => m.permission.sira));

const hasWindow = (m: AppManifest): m is WindowManifest => !!m.window;

/** The manifests with a window, in launcher / Spotlight / menu order. */
export const WINDOW_MANIFESTS: readonly WindowManifest[] = ALL_MANIFESTS.filter(hasWindow).sort(byPosition<WindowManifest>((m) => m.order));

/** The apps pinned in a fresh dock, left to right. */
export const DEFAULT_DOCK_ORDER: readonly AppID[] = [...WINDOW_MANIFESTS].sort(byPosition<WindowManifest>((m) => m.dock)).map((m) => m.id as AppID);

export const manifestOf = (id: string): AppManifest | undefined => ALL_MANIFESTS.find((m) => m.id === id);

/** The tint of an app's icon: its `colors` entry for that place, else its accent colour. */
export function appColor(id: string, where: 'icon' | 'menu' | 'search' = 'icon'): string {
	const m = WINDOW_MANIFESTS.find((w) => w.id === id);
	return m ? ((m.colors as Partial<Record<typeof where, string>> | undefined)?.[where] ?? m.accentColor) : '#8e8e93';
}

/** The shortcut shown next to an app in the menus ("⌘1"), if it has one. */
export const appShortcut = (id: string): string | undefined => WINDOW_MANIFESTS.find((m) => m.id === id)?.shortcut;

/** The dock icon image of an app, if its manifest names one. */
export const appDockIcon = (id: string): string | undefined => WINDOW_MANIFESTS.find((m) => m.id === id)?.dockIcon;
