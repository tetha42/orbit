import React from 'react';
import { useI18n } from '@/core/i18n';
import type { AppIconSvgProps } from './iconTypes';

export function TeamsAppIcon({ size, className, shadowStyle }: AppIconSvgProps) {
	return (
		<svg
			viewBox="0 0 100 100"
			width={size}
			height={size}
			className={className}
			style={{ display: 'block', borderRadius: '22.5%', ...shadowStyle }}
		>
			<defs>
				<linearGradient id="teams-bg" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#081a36" />
					<stop offset="45%" stopColor="#0a4db5" />
					<stop offset="100%" stopColor="#0077ff" />
				</linearGradient>
				<linearGradient id="rocket-hull" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#ffffff" />
					<stop offset="50%" stopColor="#cbd5e1" />
					<stop offset="100%" stopColor="#64748b" />
				</linearGradient>
				<linearGradient id="jet-flame" x1="100%" y1="0%" x2="0%" y2="100%">
					<stop offset="0%" stopColor="#38bdf8" />
					<stop offset="40%" stopColor="#00b4d8" />
					<stop offset="100%" stopColor="transparent" />
				</linearGradient>
				<linearGradient id="glass-sheen" x1="0%" y1="0%" x2="0%" y2="100%">
					<stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
					<stop offset="40%" stopColor="#ffffff" stopOpacity="0.08" />
					<stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
				</linearGradient>
				<clipPath id="squircle-clip-teams">
					<rect width="100" height="100" rx="22.5" />
				</clipPath>
			</defs>
			<g clipPath="url(#squircle-clip-teams)">
				{/* Background */}
				<rect width="100" height="100" fill="url(#teams-bg)" />

				{/* Blueprint Grid & Circles */}
				<circle cx="50" cy="50" r="38" fill="none" stroke="#38bdf8" strokeWidth="0.8" opacity="0.3" strokeDasharray="3 3" />
				<circle cx="50" cy="50" r="26" fill="none" stroke="#38bdf8" strokeWidth="0.8" opacity="0.25" />
				<circle cx="50" cy="50" r="14" fill="none" stroke="#38bdf8" strokeWidth="0.6" opacity="0.2" strokeDasharray="2 2" />
				<line x1="12" y1="50" x2="88" y2="50" stroke="#38bdf8" strokeWidth="0.6" opacity="0.2" />
				<line x1="50" y1="12" x2="50" y2="88" stroke="#38bdf8" strokeWidth="0.6" opacity="0.2" />
				{/* Network Nodes */}
				<circle cx="28" cy="30" r="2" fill="#7dd3fc" opacity="0.8" />
				<circle cx="72" cy="70" r="2.5" fill="#7dd3fc" opacity="0.8" />
				<circle cx="78" cy="32" r="1.8" fill="#7dd3fc" opacity="0.7" />
				<line x1="28" y1="30" x2="44" y2="40" stroke="#38bdf8" strokeWidth="0.8" opacity="0.4" />
				<line x1="72" y1="70" x2="60" y2="58" stroke="#38bdf8" strokeWidth="0.8" opacity="0.4" />

				{/* Jet Flame Exhaust */}
				<path d="M 38 60 Q 22 76 14 86 Q 30 76 46 68 Z" fill="url(#jet-flame)" opacity="0.9" />
				<ellipse cx="26" cy="74" rx="4" ry="12" transform="rotate(-45 26 74)" fill="#e0f2fe" opacity="0.8" />

				{/* 3D Sleek Rocket */}
				<g transform="translate(18, 14)">
					{/* Left Fin */}
					<path d="M 18 48 L 12 58 L 22 54 Z" fill="#475569" />
					{/* Right Fin */}
					<path d="M 44 22 L 54 16 L 50 26 Z" fill="#475569" />
					{/* Bottom Center Engine Nozzle */}
					<ellipse cx="23" cy="49" rx="5" ry="3" transform="rotate(-45 23 49)" fill="#1e293b" />
					{/* Main Rocket Fuselage */}
					<path
						d="M 52 14 C 44 14, 25 32, 21 47 L 27 53 C 42 49, 60 30, 60 22 C 60 16, 56 14, 52 14 Z"
						fill="url(#rocket-hull)"
					/>
					{/* Cockpit Porthole Glass */}
					<circle cx="44" cy="27" r="5" fill="#0284c7" stroke="#e2e8f0" strokeWidth="1.2" />
					<circle cx="43" cy="26" r="2" fill="#ffffff" opacity="0.85" />
					{/* Speed Line Highlight */}
					<path d="M 50 17 Q 35 34 26 46" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" opacity="0.75" fill="none" />
				</g>

				{/* Top Specular Rim & Glass Reflection */}
				<rect width="100" height="46" fill="url(#glass-sheen)" />
				<rect width="100" height="100" rx="22.5" fill="none" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1.5" />
			</g>
		</svg>
	);
}

export function EventsAppIcon({ size, className, shadowStyle }: AppIconSvgProps) {
	const { t } = useI18n();
	return (
		<svg
			viewBox="0 0 100 100"
			width={size}
			height={size}
			className={className}
			style={{ display: 'block', borderRadius: '22.5%', ...shadowStyle }}
		>
			<defs>
				<linearGradient id="cal-header" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#ff3b30" />
					<stop offset="100%" stopColor="#d70015" />
				</linearGradient>
				<linearGradient id="cal-body" x1="0%" y1="0%" x2="0%" y2="100%">
					<stop offset="0%" stopColor="#ffffff" />
					<stop offset="100%" stopColor="#f1f5f9" />
				</linearGradient>
				<linearGradient id="ring-silver" x1="0%" y1="0%" x2="100%" y2="0%">
					<stop offset="0%" stopColor="#94a3b8" />
					<stop offset="40%" stopColor="#ffffff" />
					<stop offset="100%" stopColor="#475569" />
				</linearGradient>
				<linearGradient id="qr-core" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#0284c7" />
					<stop offset="100%" stopColor="#0369a1" />
				</linearGradient>
				<clipPath id="squircle-clip-events">
					<rect width="100" height="100" rx="22.5" />
				</clipPath>
			</defs>
			<g clipPath="url(#squircle-clip-events)">
				{/* Background Base */}
				<rect width="100" height="100" fill="#0f172a" />
				{/* Calendar White Sheet */}
				<rect y="28" width="100" height="72" fill="url(#cal-body)" />
				{/* Calendar Red Header */}
				<rect y="0" width="100" height="34" fill="url(#cal-header)" />

				{/* Header Text */}
				<text
					x="50"
					y="22"
					fill="#ffffff"
					fontSize="11.5"
					fontWeight="800"
					letterSpacing="1.8"
					textAnchor="middle"
					fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
				>
					{t('eventsIconLabel')}
				</text>

				{/* Silver Binder Rings */}
				<rect x="24" y="6" width="6" height="16" rx="3" fill="url(#ring-silver)" filter="drop-shadow(0 2px 2px rgba(0,0,0,0.3))" />
				<rect x="70" y="6" width="6" height="16" rx="3" fill="url(#ring-silver)" filter="drop-shadow(0 2px 2px rgba(0,0,0,0.3))" />

				{/* Holographic QR Pass Emblem in Center */}
				<g transform="translate(26, 42)">
					<rect width="48" height="46" rx="10" fill="url(#qr-core)" opacity="0.08" stroke="#0284c7" strokeWidth="1.2" />
					{/* QR Corner Markers */}
					<rect x="6" y="6" width="11" height="11" rx="2.5" fill="none" stroke="#0284c7" strokeWidth="2" />
					<rect x="9" y="9" width="5" height="5" rx="1" fill="#ff3b30" />

					<rect x="31" y="6" width="11" height="11" rx="2.5" fill="none" stroke="#0284c7" strokeWidth="2" />
					<rect x="34" y="9" width="5" height="5" rx="1" fill="#ff3b30" />

					<rect x="6" y="29" width="11" height="11" rx="2.5" fill="none" stroke="#0284c7" strokeWidth="2" />
					<rect x="9" y="32" width="5" height="5" rx="1" fill="#ff3b30" />

					{/* QR Data Dots */}
					<circle cx="24" cy="11" r="2" fill="#0284c7" />
					<circle cx="24" cy="22" r="2.2" fill="#0284c7" />
					<circle cx="34" cy="24" r="1.8" fill="#0284c7" />
					<circle cx="18" cy="35" r="1.8" fill="#0284c7" />
					<circle cx="28" cy="34" r="2.2" fill="#0284c7" />
					<circle cx="38" cy="34" r="1.8" fill="#0284c7" />

					{/* Glowing Scanline */}
					<line x1="2" y1="23" x2="46" y2="23" stroke="#38bdf8" strokeWidth="1.4" opacity="0.8" />
				</g>

				{/* Top Specular Rim */}
				<rect width="100" height="100" rx="22.5" fill="none" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1.5" />
			</g>
		</svg>
	);
}
