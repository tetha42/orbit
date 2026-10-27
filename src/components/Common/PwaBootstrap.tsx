'use client';

// Imported for its side effect: `@/lib/client/pwa` attaches the
// `beforeinstallprompt` / `appinstalled` listeners as soon as the client bundle
// loads. Mounting this in the root layout (rather than importing the module from
// the download page) is what lets it catch the event, which usually fires before
// the page's own components have hydrated.
import '@/lib/client/pwa';

export function PwaBootstrap() {
	return null;
}
