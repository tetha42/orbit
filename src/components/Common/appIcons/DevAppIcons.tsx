import React from 'react';
import type { AppIconSvgProps } from './iconTypes';

export function TerminalAppIcon({ size, className, shadowStyle }: AppIconSvgProps) {
	return (
		<svg
			viewBox="0 0 100 100"
			width={size}
			height={size}
			className={className}
			style={{ display: 'block', borderRadius: '22.5%', ...shadowStyle }}
		>
			<defs>
				<linearGradient id="term-bg" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#0f172a" />
					<stop offset="60%" stopColor="#020617" />
					<stop offset="100%" stopColor="#000000" />
				</linearGradient>
				<clipPath id="squircle-clip-terminal">
					<rect width="100" height="100" rx="22.5" />
				</clipPath>
			</defs>
			<g clipPath="url(#squircle-clip-terminal)">
				<rect width="100" height="100" fill="url(#term-bg)" />

				{/* Console Inner Bezel */}
				<rect
					x="10"
					y="12"
					width="80"
					height="76"
					rx="8"
					fill="#090d16"
					stroke="#1e293b"
					strokeWidth="1.2"
					filter="drop-shadow(inset 0 2px 4px rgba(0,0,0,0.8))"
				/>

				{/* macOS Window Traffic Lights */}
				<circle cx="22" cy="24" r="3.2" fill="#ef4444" />
				<circle cx="31" cy="24" r="3.2" fill="#f59e0b" />
				<circle cx="40" cy="24" r="3.2" fill="#10b981" />

				{/* Console Prompt Lines */}
				{/* Glowing Prompt: >_ */}
				<text
					x="20"
					y="52"
					fill="#30d158"
					fontSize="18"
					fontWeight="900"
					fontFamily="'SF Mono', 'Fira Code', Menlo, monospace"
					filter="drop-shadow(0 0 6px rgba(48, 209, 88, 0.75))"
				>
					&gt;_
				</text>

				{/* Monospace Code Output Simulation */}
				<rect x="20" y="62" width="46" height="3" rx="1.5" fill="#22c55e" opacity="0.6" />
				<rect x="20" y="70" width="30" height="3" rx="1.5" fill="#22c55e" opacity="0.4" />

				{/* Top Specular Rim */}
				<rect width="100" height="46" fill="url(#glass-sheen)" />
				<rect width="100" height="100" rx="22.5" fill="none" stroke="rgba(255, 255, 255, 0.35)" strokeWidth="1.5" />
			</g>
		</svg>
	);
}

export function DatabaseAppIcon({ size, className, shadowStyle }: AppIconSvgProps) {
	return (
		<svg
			viewBox="0 0 100 100"
			width={size}
			height={size}
			className={className}
			style={{ display: 'block', borderRadius: '22.5%', ...shadowStyle }}
		>
			<defs>
				<linearGradient id="db-bg" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#1e3a8a" />
					<stop offset="50%" stopColor="#0f172a" />
					<stop offset="100%" stopColor="#020617" />
				</linearGradient>
				<linearGradient id="db-disk" x1="0%" y1="0%" x2="0%" y2="100%">
					<stop offset="0%" stopColor="#38bdf8" />
					<stop offset="100%" stopColor="#0284c7" />
				</linearGradient>
				<clipPath id="squircle-clip-database">
					<rect width="100" height="100" rx="22.5" />
				</clipPath>
			</defs>
			<g clipPath="url(#squircle-clip-database)">
				<rect width="100" height="100" fill="url(#db-bg)" />

				{/* Cylinder 1 (Bottom) */}
				<path
					d="M 24 58 C 24 53 76 53 76 58 L 76 72 C 76 77 24 77 24 72 Z"
					fill="url(#db-disk)"
					opacity="0.85"
				/>
				<ellipse cx="50" cy="58" rx="26" ry="6" fill="#7dd3fc" />

				{/* Cylinder 2 (Middle) */}
				<path
					d="M 24 42 C 24 37 76 37 76 42 L 76 54 C 76 59 24 59 24 54 Z"
					fill="url(#db-disk)"
					opacity="0.9"
				/>
				<ellipse cx="50" cy="42" rx="26" ry="6" fill="#bae6fd" />

				{/* Cylinder 3 (Top) */}
				<path
					d="M 24 26 C 24 21 76 21 76 26 L 76 38 C 76 43 24 43 24 38 Z"
					fill="url(#db-disk)"
				/>
				<ellipse cx="50" cy="26" rx="26" ry="6" fill="#e0f2fe" />

				{/* Center Activity LED dot */}
				<circle cx="68" cy="30" r="2" fill="#34c759" />

				{/* Top Specular Rim */}
				<rect width="100" height="46" fill="url(#glass-sheen)" />
				<rect width="100" height="100" rx="22.5" fill="none" stroke="rgba(255, 255, 255, 0.35)" strokeWidth="1.5" />
			</g>
		</svg>
	);
}

export function ProjectsAppIcon({ size, className, shadowStyle }: AppIconSvgProps) {
	return (
		<svg
			viewBox="0 0 100 100"
			width={size}
			height={size}
			className={className}
			style={{ display: 'block', borderRadius: '22.5%', ...shadowStyle }}
		>
			<defs>
				<linearGradient id="proj-bg" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#0f172a" />
					<stop offset="50%" stopColor="#0369a1" />
					<stop offset="100%" stopColor="#0284c7" />
				</linearGradient>
				<clipPath id="squircle-clip-proj">
					<rect width="100" height="100" rx="22.5" />
				</clipPath>
			</defs>
			<g clipPath="url(#squircle-clip-proj)">
				<rect width="100" height="100" fill="url(#proj-bg)" />
				<circle cx="50" cy="50" r="32" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.3" strokeDasharray="3 3" />
				{/* Git Fork Branch Graphic */}
				<g transform="translate(26, 26)">
					<line x1="12" y1="12" x2="12" y2="36" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
					<path d="M 12 24 C 24 24, 36 20, 36 14" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
					<circle cx="12" cy="12" r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
					<circle cx="12" cy="36" r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
					<circle cx="36" cy="14" r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
				</g>
				<rect width="100" height="46" fill="url(#glass-sheen)" />
				<rect width="100" height="100" rx="22.5" fill="none" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1.5" />
			</g>
		</svg>
	);
}
