import React from 'react';
import type { AppIconSvgProps } from './iconTypes';

export function ChatAppIcon({ size, className, shadowStyle }: AppIconSvgProps) {
	return (
		<svg
			viewBox="0 0 100 100"
			width={size}
			height={size}
			className={className}
			style={{ display: 'block', borderRadius: '22.5%', ...shadowStyle }}
		>
			<defs>
				<linearGradient id="chat-bg" x1="0%" y1="0%" x2="0%" y2="100%">
					<stop offset="0%" stopColor="#34d399" />
					<stop offset="100%" stopColor="#059669" />
				</linearGradient>
				<linearGradient id="chat-sheen" x1="0%" y1="0%" x2="0%" y2="100%">
					<stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
					<stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
				</linearGradient>
				<clipPath id="squircle-clip-chat">
					<rect width="100" height="100" rx="22.5" />
				</clipPath>
			</defs>
			<g clipPath="url(#squircle-clip-chat)">
				<rect width="100" height="100" fill="url(#chat-bg)" />
				{/* Soft chat bubble shadow */}
				<path
					d="M 50 20 C 31 20 16 33 16 48 C 16 57 22 65 31 70 C 30 76 27 80 23 83 C 28.5 83 36 80 41 75.5 C 44 76 47 76.5 50 76.5 C 69 76.5 84 63.5 84 48 C 84 33 69 20 50 20 Z"
					fill="#047857"
					opacity="0.35"
					transform="translate(0, 3)"
				/>
				{/* White chat bubble body */}
				<path
					d="M 50 20 C 31 20 16 33 16 48 C 16 57 22 65 31 70 C 30 76 27 80 23 83 C 28.5 83 36 80 41 75.5 C 44 76 47 76.5 50 76.5 C 69 76.5 84 63.5 84 48 C 84 33 69 20 50 20 Z"
					fill="#ffffff"
				/>
				{/* Three speech dots */}
				<circle cx="36" cy="48" r="4.5" fill="#10b981" />
				<circle cx="50" cy="48" r="4.5" fill="#10b981" />
				<circle cx="64" cy="48" r="4.5" fill="#10b981" />
				<rect width="100" height="46" fill="url(#chat-sheen)" />
				<rect width="100" height="100" rx="22.5" fill="none" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1.5" />
			</g>
		</svg>
	);
}

// Haberler has no drawn icon; the dock's picture keeps its tile from being blank.
export function NewsAppIcon({ size, className, shadowStyle }: AppIconSvgProps) {
	return (
		// eslint-disable-next-line @next/next/no-img-element
		<img
			src="/app-icons/news/256.png"
			alt=""
			width={size}
			height={size}
			className={className}
			style={{ display: 'block', borderRadius: '22.5%', ...shadowStyle }}
		/>
	);
}
