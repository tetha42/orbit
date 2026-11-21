import React from 'react';
import type { AppIconSvgProps } from './iconTypes';

export function BudgetAppIcon({ size, className, shadowStyle }: AppIconSvgProps) {
	return (
		<svg
			viewBox="0 0 100 100"
			width={size}
			height={size}
			className={className}
			style={{ display: 'block', borderRadius: '22.5%', ...shadowStyle }}
		>
			<defs>
				<linearGradient id="vault-bg" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#064e3b" />
					<stop offset="50%" stopColor="#047857" />
					<stop offset="100%" stopColor="#10b981" />
				</linearGradient>
				<linearGradient id="gold-coin" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#fef08a" />
					<stop offset="35%" stopColor="#fbbf24" />
					<stop offset="70%" stopColor="#d97706" />
					<stop offset="100%" stopColor="#fef3c7" />
				</linearGradient>
				<linearGradient id="gold-rim" x1="0%" y1="0%" x2="0%" y2="100%">
					<stop offset="0%" stopColor="#fef08a" />
					<stop offset="100%" stopColor="#92400e" />
				</linearGradient>
				<linearGradient id="neon-growth" x1="0%" y1="100%" x2="100%" y2="0%">
					<stop offset="0%" stopColor="#a7f3d0" />
					<stop offset="50%" stopColor="#fef08a" />
					<stop offset="100%" stopColor="#ffffff" />
				</linearGradient>
				<clipPath id="squircle-clip-budget">
					<rect width="100" height="100" rx="22.5" />
				</clipPath>
			</defs>
			<g clipPath="url(#squircle-clip-budget)">
				<rect width="100" height="100" fill="url(#vault-bg)" />

				{/* Concentric Guilloche Safe Rings */}
				<circle cx="50" cy="50" r="36" fill="none" stroke="#34d399" strokeWidth="0.8" opacity="0.3" strokeDasharray="4 2" />
				<circle cx="50" cy="50" r="28" fill="none" stroke="#34d399" strokeWidth="0.8" opacity="0.25" />
				<circle cx="50" cy="50" r="20" fill="none" stroke="#34d399" strokeWidth="0.6" opacity="0.2" />

				{/* 3D Stack of Gold Coins */}
				{/* Bottom Coin */}
				<ellipse cx="40" cy="66" rx="20" ry="7" fill="#92400e" />
				<path d="M 20 66 L 20 69 Q 40 78 60 69 L 60 66 Z" fill="#b45309" />
				<ellipse cx="40" cy="64" rx="20" ry="6.5" fill="url(#gold-coin)" stroke="url(#gold-rim)" strokeWidth="0.8" />

				{/* Middle Coin */}
				<ellipse cx="40" cy="58" rx="20" ry="7" fill="#92400e" />
				<path d="M 20 58 L 20 61 Q 40 70 60 61 L 60 58 Z" fill="#b45309" />
				<ellipse cx="40" cy="56" rx="20" ry="6.5" fill="url(#gold-coin)" stroke="url(#gold-rim)" strokeWidth="0.8" />

				{/* Top Coin with Embossed Currency Symbol */}
				<ellipse cx="40" cy="50" rx="20" ry="7" fill="#92400e" />
				<path d="M 20 50 L 20 53 Q 40 62 60 53 L 60 50 Z" fill="#b45309" />
				<ellipse cx="40" cy="48" rx="20" ry="6.5" fill="url(#gold-coin)" stroke="url(#gold-rim)" strokeWidth="1" />
				<text
					x="40"
					y="52"
					fill="#78350f"
					fontSize="13"
					fontWeight="900"
					textAnchor="middle"
					fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
				>
					₺
				</text>

				{/* Upward Glowing Surge Arrow */}
				<path
					d="M 22 72 Q 44 68 56 42 Q 62 28 78 22"
					fill="none"
					stroke="url(#neon-growth)"
					strokeWidth="3.5"
					strokeLinecap="round"
					filter="drop-shadow(0 2px 6px rgba(254, 240, 138, 0.6))"
				/>
				{/* Arrowhead */}
				<polygon points="78,16 84,23 74,26" fill="#ffffff" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))" />

				{/* Top Specular Rim */}
				<rect width="100" height="46" fill="url(#glass-sheen)" />
				<rect width="100" height="100" rx="22.5" fill="none" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1.5" />
			</g>
		</svg>
	);
}

export function CertificatesAppIcon({ size, className, shadowStyle }: AppIconSvgProps) {
	return (
		<svg
			viewBox="0 0 100 100"
			width={size}
			height={size}
			className={className}
			style={{ display: 'block', borderRadius: '22.5%', ...shadowStyle }}
		>
			<defs>
				<linearGradient id="cert-bg" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#451a03" />
					<stop offset="45%" stopColor="#b45309" />
					<stop offset="100%" stopColor="#f59e0b" />
				</linearGradient>
				<linearGradient id="gold-medal" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#fef9c3" />
					<stop offset="35%" stopColor="#fde047" />
					<stop offset="70%" stopColor="#ca8a04" />
					<stop offset="100%" stopColor="#854d0e" />
				</linearGradient>
				<linearGradient id="ribbon-grad" x1="0%" y1="0%" x2="100%" y2="0%">
					<stop offset="0%" stopColor="#1e3a8a" />
					<stop offset="50%" stopColor="#3b82f6" />
					<stop offset="100%" stopColor="#1e3a8a" />
				</linearGradient>
				<clipPath id="squircle-clip-certs">
					<rect width="100" height="100" rx="22.5" />
				</clipPath>
			</defs>
			<g clipPath="url(#squircle-clip-certs)">
				<rect width="100" height="100" fill="url(#cert-bg)" />

				{/* Radial Sunburst Rays */}
				<circle cx="50" cy="56" r="38" fill="none" stroke="#fde047" strokeWidth="0.8" opacity="0.25" strokeDasharray="3 3" />
				<circle cx="50" cy="56" r="28" fill="none" stroke="#fde047" strokeWidth="0.8" opacity="0.3" />

				{/* V-Shaped Silk Ribbon Hanging Down */}
				<polygon points="36,0 44,0 50,42 42,42" fill="url(#ribbon-grad)" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))" />
				<polygon points="64,0 56,0 50,42 58,42" fill="url(#ribbon-grad)" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))" />
				<line x1="40" y1="0" x2="46" y2="42" stroke="#fef08a" strokeWidth="1" opacity="0.8" />
				<line x1="60" y1="0" x2="54" y2="42" stroke="#fef08a" strokeWidth="1" opacity="0.8" />

				{/* 3D Gold Achievement Medallion */}
				<circle cx="50" cy="58" r="23" fill="#854d0e" />
				<circle cx="50" cy="56" r="22" fill="url(#gold-medal)" filter="drop-shadow(0 4px 10px rgba(0,0,0,0.4))" />
				<circle cx="50" cy="56" r="17.5" fill="none" stroke="#fef9c3" strokeWidth="1" opacity="0.8" />

				{/* 3D Faceted Star in Medal */}
				<polygon
					points="50,44 53.5,52 62,53 55.5,59 57.5,68 50,63.5 42.5,68 44.5,59 38,53 46.5,52"
					fill="#ffffff"
					filter="drop-shadow(0 2px 3px rgba(113, 63, 18, 0.5))"
				/>

				{/* Top Specular Rim */}
				<rect width="100" height="46" fill="url(#glass-sheen)" />
				<rect width="100" height="100" rx="22.5" fill="none" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1.5" />
			</g>
		</svg>
	);
}
