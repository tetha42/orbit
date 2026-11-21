import React from 'react';
import type { AppIconSvgProps } from './iconTypes';

export function NotesAppIcon({ size, className, shadowStyle }: AppIconSvgProps) {
	return (
		<svg
			viewBox="0 0 100 100"
			width={size}
			height={size}
			className={className}
			style={{ display: 'block', borderRadius: '22.5%', ...shadowStyle }}
		>
			<defs>
				<linearGradient id="notes-pad" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#fef9c3" />
					<stop offset="100%" stopColor="#fef08a" />
				</linearGradient>
				<linearGradient id="notes-top" x1="0%" y1="0%" x2="100%" y2="0%">
					<stop offset="0%" stopColor="#ca8a04" />
					<stop offset="50%" stopColor="#eab308" />
					<stop offset="100%" stopColor="#a16207" />
				</linearGradient>
				<clipPath id="squircle-clip-notes">
					<rect width="100" height="100" rx="22.5" />
				</clipPath>
			</defs>
			<g clipPath="url(#squircle-clip-notes)">
				{/* Legal Memo Pad Body */}
				<rect width="100" height="100" fill="url(#notes-pad)" />

				{/* Ruled Horizontal Lines */}
				<line x1="16" y1="36" x2="84" y2="36" stroke="#e2e8f0" strokeWidth="1.8" />
				<line x1="16" y1="46" x2="84" y2="46" stroke="#e2e8f0" strokeWidth="1.8" />
				<line x1="16" y1="56" x2="84" y2="56" stroke="#e2e8f0" strokeWidth="1.8" />
				<line x1="16" y1="66" x2="84" y2="66" stroke="#e2e8f0" strokeWidth="1.8" />
				<line x1="16" y1="76" x2="84" y2="76" stroke="#e2e8f0" strokeWidth="1.8" />

				{/* Bound Leather Top Strip */}
				<rect width="100" height="22" fill="url(#notes-top)" />
				<line x1="0" y1="22" x2="100" y2="22" stroke="#854d0e" strokeWidth="1" strokeDasharray="3 3" />

				{/* Sleek Modern Stylus / Pencil Diagonally */}
				<g transform="translate(34, 28) rotate(42)">
					{/* Stylus Body */}
					<rect x="0" y="0" width="8" height="42" rx="2" fill="#f59e0b" filter="drop-shadow(3px 4px 6px rgba(0,0,0,0.3))" />
					{/* Silver Ferrule */}
					<rect x="0" y="0" width="8" height="8" rx="1" fill="#cbd5e1" />
					{/* Pencil Tip */}
					<polygon points="0,42 8,42 4,52" fill="#fde68a" />
					<polygon points="2,48 6,48 4,52" fill="#334155" />
				</g>

				{/* Top Specular Rim */}
				<rect width="100" height="46" fill="url(#glass-sheen)" />
				<rect width="100" height="100" rx="22.5" fill="none" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1.5" />
			</g>
		</svg>
	);
}

export function SettingsAppIcon({ size, className, shadowStyle }: AppIconSvgProps) {
	return (
		<svg
			viewBox="0 0 100 100"
			width={size}
			height={size}
			className={className}
			style={{ display: 'block', borderRadius: '22.5%', ...shadowStyle }}
		>
			<defs>
				<linearGradient id="settings-bg" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#1e293b" />
					<stop offset="50%" stopColor="#334155" />
					<stop offset="100%" stopColor="#475569" />
				</linearGradient>
				<linearGradient id="gear-titanium" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#ffffff" />
					<stop offset="40%" stopColor="#cbd5e1" />
					<stop offset="80%" stopColor="#64748b" />
					<stop offset="100%" stopColor="#f8fafc" />
				</linearGradient>
				<clipPath id="squircle-clip-settings">
					<rect width="100" height="100" rx="22.5" />
				</clipPath>
			</defs>
			<g clipPath="url(#squircle-clip-settings)">
				<rect width="100" height="100" fill="url(#settings-bg)" />

				{/* Concentric Machined Circles */}
				<circle cx="50" cy="50" r="38" fill="none" stroke="#64748b" strokeWidth="0.8" opacity="0.3" strokeDasharray="4 2" />

				{/* Interlocking Gears */}
				{/* Large Gear (Center Right) */}
				<g transform="translate(54, 46)" filter="drop-shadow(0 6px 14px rgba(0,0,0,0.4))">
					{/* 8 Gear Teeth */}
					{[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
						<rect
							key={angle}
							x="-4"
							y="-24"
							width="8"
							height="8"
							rx="1.5"
							fill="url(#gear-titanium)"
							transform={`rotate(${angle})`}
						/>
					))}
					{/* Gear Disc */}
					<circle cx="0" cy="0" r="20" fill="url(#gear-titanium)" />
					{/* Center Axle Hole */}
					<circle cx="0" cy="0" r="8" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1" />
				</g>

				{/* Small Gear (Bottom Left) */}
				<g transform="translate(30, 68)" filter="drop-shadow(0 4px 8px rgba(0,0,0,0.4))">
					{[0, 60, 120, 180, 240, 300].map((angle) => (
						<rect
							key={angle}
							x="-3"
							y="-16"
							width="6"
							height="6"
							rx="1"
							fill="url(#gear-titanium)"
							transform={`rotate(${angle})`}
						/>
					))}
					<circle cx="0" cy="0" r="13" fill="url(#gear-titanium)" />
					<circle cx="0" cy="0" r="5" fill="#1e293b" />
				</g>

				{/* Top Specular Rim */}
				<rect width="100" height="46" fill="url(#glass-sheen)" />
				<rect width="100" height="100" rx="22.5" fill="none" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1.5" />
			</g>
		</svg>
	);
}
