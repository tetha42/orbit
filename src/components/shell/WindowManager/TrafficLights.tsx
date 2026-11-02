'use client';

import { useState } from 'react';
import { X, Minus, Maximize2 } from 'lucide-react';

interface TrafficLightsProps {
	onClose: () => void;
	onMinimize: () => void;
	onMaximize: () => void;
	isMaximized?: boolean;
	size?: number;
}

export function TrafficLights({
	onClose,
	onMinimize,
	onMaximize,
	isMaximized = false,
	size = 16,
}: TrafficLightsProps) {
	const [isHovered, setIsHovered] = useState(false);

	const iconSize = Math.round(size * 0.62);

	return (
		<div
			className="traffic-lights-group"
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: '9px',
				zIndex: 10,
			}}
		>
			{/* Close (Red) */}
			<button
				onClick={(e) => {
					e.stopPropagation();
					onClose();
				}}
				data-window-control="close"
					title="Close Window"
				style={{
					width: `${size}px`,
					height: `${size}px`,
					borderRadius: '50%',
					backgroundColor: 'var(--traffic-red)',
					border: '0.5px solid var(--traffic-red)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					padding: 0,
					transition: 'transform 120ms ease, filter 120ms ease',
					cursor: 'pointer',
					boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
					transform: isHovered ? 'scale(1.06)' : 'scale(1)',
					touchAction: 'manipulation',
				}}
			>
				{isHovered && <X size={iconSize} color="#4d0000" strokeWidth={1.5} />}
			</button>

			{/* Minimize (Yellow) */}
			<button
				onClick={(e) => {
					e.stopPropagation();
					onMinimize();
				}}
				data-window-control="minimize"
					title="Minimize to Dock"
				style={{
					width: `${size}px`,
					height: `${size}px`,
					borderRadius: '50%',
					backgroundColor: 'var(--traffic-yellow)',
					border: '0.5px solid var(--traffic-yellow)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					padding: 0,
					transition: 'transform 120ms ease, filter 120ms ease',
					cursor: 'pointer',
					boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
					transform: isHovered ? 'scale(1.06)' : 'scale(1)',
					touchAction: 'manipulation',
				}}
			>
				{isHovered && <Minus size={iconSize} color="#5e4100" strokeWidth={1.5} />}
			</button>

			{/* Maximize (Green) */}
			<button
				onClick={(e) => {
					e.stopPropagation();
					onMaximize();
				}}
				data-window-control="maximize"
					title={isMaximized ? 'Restore' : 'Zoom Fullscreen'}
				style={{
					width: `${size}px`,
					height: `${size}px`,
					borderRadius: '50%',
					backgroundColor: 'var(--traffic-green)',
					border: '0.5px solid var(--traffic-green)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					padding: 0,
					transition: 'transform 120ms ease, filter 120ms ease',
					cursor: 'pointer',
					boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
					transform: isHovered ? 'scale(1.06)' : 'scale(1)',
					touchAction: 'manipulation',
				}}
			>
				{isHovered && <Maximize2 size={iconSize - 1} color="#004d00" strokeWidth={1.5} />}
			</button>
		</div>
	);
}
