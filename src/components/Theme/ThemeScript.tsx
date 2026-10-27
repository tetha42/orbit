'use client';

import { useServerInsertedHTML } from 'next/navigation';
import { themeBootScript } from '@/core/theme/pure';

// Suppress React 19 false-positive warning if encountered during client-side hydration or HMR
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
	const originalError = console.error;
	console.error = (...args: unknown[]) => {
		if (typeof args[0] === 'string' && args[0].includes('Encountered a script tag')) {
			return;
		}
		originalError.apply(console, args);
	};
}

/**
 * Injects the blocking theme boot script directly into the SSR HTML stream via Next.js
 * `useServerInsertedHTML`. This runs before first paint to prevent dark mode FOUC,
 * while returning null on the client so React 19 never encounters an inline <script> in the client DOM tree.
 */
export function ThemeScript() {
	useServerInsertedHTML(() => (
		<script
			id="theme-boot"
			dangerouslySetInnerHTML={{ __html: themeBootScript() }}
		/>
	));
	return null;
}
