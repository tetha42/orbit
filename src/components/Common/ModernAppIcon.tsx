'use client';

import React from 'react';
import { AppID } from '@/types/workspace';
import { APPS_CONFIG } from '@/configs/apps.config';
import { AppIcon } from '@/components/Common/AppIcon';

interface ModernAppIconProps {
	appId: AppID;
	size?: number;
	className?: string;
	showShadow?: boolean;
}

export function ModernAppIcon({ appId, size = 48, className, showShadow = true }: ModernAppIconProps) {
	const shadowStyle = showShadow
		? {
				filter: 'drop-shadow(0 6px 14px rgba(0, 0, 0, 0.35)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
			}
		: {};

	const renderContent = () => {
		switch (appId) {
			case 'teams':
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

			case 'events':
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
								ETKİNLİK
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

			case 'budget':
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



			case 'certificates':
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

			case 'inventory':
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

			case 'members':
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

			case 'notes':
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

			case 'settings':
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

			case 'terminal':
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

			case 'database':
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

			case 'projects':
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

			case 'chat':
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

			// Haberler has no drawn icon; the dock's picture keeps its tile from being blank.
			case 'news':
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

			default: {
				// An app without a hand-drawn icon: its manifest's icon on an accent tile.
				// Every current app has one, so `appId` narrows to `never` here; widen it for apps added later.
				const accent = APPS_CONFIG[appId as AppID]?.accentColor ?? '#8e8e93';
				return (
					<div
						className={className}
						style={{
							width: size,
							height: size,
							borderRadius: '22.5%',
							background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
							display: 'grid',
							placeItems: 'center',
							...shadowStyle,
						}}
					>
						<AppIcon appId={appId} size={Math.round(size * 0.5)} color="#fff" />
					</div>
				);
			}
		}
	};

	return renderContent();
}
