import React from 'react';
import type { AppIconSvgProps } from './iconTypes';

export function InventoryAppIcon({ size, className, shadowStyle }: AppIconSvgProps) {
	return (
		<svg
			viewBox="0 0 100 100"
			width={size}
			height={size}
			className={className}
			style={{ display: 'block', borderRadius: '22.5%', ...shadowStyle }}
		>
			<defs>
				<linearGradient id="chip-bg" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#09090b" />
					<stop offset="60%" stopColor="#18181b" />
					<stop offset="100%" stopColor="#27272a" />
				</linearGradient>
				<linearGradient id="gold-pin" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#fef08a" />
					<stop offset="100%" stopColor="#d97706" />
				</linearGradient>
				<linearGradient id="cyan-die" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#06b6d4" />
					<stop offset="100%" stopColor="#0284c7" />
				</linearGradient>
				<clipPath id="squircle-clip-inventory">
					<rect width="100" height="100" rx="22.5" />
				</clipPath>
			</defs>
			<g clipPath="url(#squircle-clip-inventory)">
				<rect width="100" height="100" fill="url(#chip-bg)" />

				{/* Circuit Traces */}
				<line x1="20" y1="20" x2="34" y2="34" stroke="#06b6d4" strokeWidth="1.2" opacity="0.4" />
				<line x1="80" y1="20" x2="66" y2="34" stroke="#06b6d4" strokeWidth="1.2" opacity="0.4" />
				<line x1="20" y1="80" x2="34" y2="66" stroke="#06b6d4" strokeWidth="1.2" opacity="0.4" />
				<line x1="80" y1="80" x2="66" y2="66" stroke="#06b6d4" strokeWidth="1.2" opacity="0.4" />

				{/* Golden Contact Pins (Top & Bottom) */}
				<rect x="36" y="24" width="4" height="6" rx="1" fill="url(#gold-pin)" />
				<rect x="44" y="24" width="4" height="6" rx="1" fill="url(#gold-pin)" />
				<rect x="52" y="24" width="4" height="6" rx="1" fill="url(#gold-pin)" />
				<rect x="60" y="24" width="4" height="6" rx="1" fill="url(#gold-pin)" />

				<rect x="36" y="70" width="4" height="6" rx="1" fill="url(#gold-pin)" />
				<rect x="44" y="70" width="4" height="6" rx="1" fill="url(#gold-pin)" />
				<rect x="52" y="70" width="4" height="6" rx="1" fill="url(#gold-pin)" />
				<rect x="60" y="70" width="4" height="6" rx="1" fill="url(#gold-pin)" />

				{/* Golden Contact Pins (Left & Right) */}
				<rect x="24" y="36" width="6" height="4" rx="1" fill="url(#gold-pin)" />
				<rect x="24" y="44" width="6" height="4" rx="1" fill="url(#gold-pin)" />
				<rect x="24" y="52" width="6" height="4" rx="1" fill="url(#gold-pin)" />
				<rect x="24" y="60" width="6" height="4" rx="1" fill="url(#gold-pin)" />

				<rect x="70" y="36" width="6" height="4" rx="1" fill="url(#gold-pin)" />
				<rect x="70" y="44" width="6" height="4" rx="1" fill="url(#gold-pin)" />
				<rect x="70" y="52" width="6" height="4" rx="1" fill="url(#gold-pin)" />
				<rect x="70" y="60" width="6" height="4" rx="1" fill="url(#gold-pin)" />

				{/* Ceramic Microcontroller Die Body */}
				<rect
					x="29"
					y="29"
					width="42"
					height="42"
					rx="8"
					fill="#0f172a"
					stroke="#38bdf8"
					strokeWidth="1.2"
					filter="drop-shadow(0 4px 10px rgba(6, 182, 212, 0.35))"
				/>
				{/* Glowing Cyan Core Engine */}
				<rect x="36" y="36" width="28" height="28" rx="5" fill="url(#cyan-die)" opacity="0.9" />
				<text
					x="50"
					y="53.5"
					fill="#ffffff"
					fontSize="7.5"
					fontWeight="900"
					letterSpacing="0.4"
					textAnchor="middle"
					fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
				>
					ORBIT
				</text>

				{/* Top Specular Rim */}
				<rect width="100" height="46" fill="url(#glass-sheen)" />
				<rect width="100" height="100" rx="22.5" fill="none" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1.5" />
			</g>
		</svg>
	);
}

export function MembersAppIcon({ size, className, shadowStyle }: AppIconSvgProps) {
	return (
		<svg
			viewBox="0 0 100 100"
			width={size}
			height={size}
			className={className}
			style={{ display: 'block', borderRadius: '22.5%', ...shadowStyle }}
		>
			<defs>
				<linearGradient id="members-bg" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#0369a1" />
					<stop offset="50%" stopColor="#0284c7" />
					<stop offset="100%" stopColor="#38bdf8" />
				</linearGradient>
				<linearGradient id="user-front" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#ffffff" />
					<stop offset="100%" stopColor="#e2e8f0" />
				</linearGradient>
				<clipPath id="squircle-clip-members">
					<rect width="100" height="100" rx="22.5" />
				</clipPath>
			</defs>
			<g clipPath="url(#squircle-clip-members)">
				<rect width="100" height="100" fill="url(#members-bg)" />

				{/* Soft Background Halos */}
				<circle cx="50" cy="46" r="32" fill="#ffffff" opacity="0.1" />

				{/* Left Back User */}
				<g opacity="0.65" transform="translate(14, 18)">
					<circle cx="24" cy="24" r="8" fill="#e0f2fe" />
					<path d="M 12 44 Q 12 36 24 36 Q 36 36 36 44 Z" fill="#e0f2fe" />
				</g>

				{/* Right Back User */}
				<g opacity="0.65" transform="translate(38, 18)">
					<circle cx="24" cy="24" r="8" fill="#e0f2fe" />
					<path d="M 12 44 Q 12 36 24 36 Q 36 44 36 44 Z" fill="#e0f2fe" />
				</g>

				{/* Central Executive Leader Avatar */}
				<g filter="drop-shadow(0 6px 12px rgba(2, 44, 80, 0.45))">
					<circle cx="50" cy="38" r="12" fill="url(#user-front)" />
					<path d="M 30 68 Q 30 52 50 52 Q 70 52 70 68 Z" fill="url(#user-front)" />
					{/* Tie / Crest Accent */}
					<polygon points="50,55 52,62 50,66 48,62" fill="#0284c7" />
				</g>

				{/* Top Specular Rim */}
				<rect width="100" height="46" fill="url(#glass-sheen)" />
				<rect width="100" height="100" rx="22.5" fill="none" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1.5" />
			</g>
		</svg>
	);
}
