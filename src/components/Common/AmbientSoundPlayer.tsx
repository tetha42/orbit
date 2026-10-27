'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSound } from '@/core/sound';
import { useIsMounted } from '@/lib/client/useClientValue';

const DEFAULT_SOUND_SRC = '/assets/sounds/sound.mp3';

export function AmbientSoundPlayer({ showButton = true }: { showButton?: boolean }) {
	const { isAmbientSfxEnabled, toggleAmbientSfx, isMuted, volume } = useSound();
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [hasInteracted, setHasInteracted] = useState(false);
	const animFrameRef = useRef<number | null>(null);
	const phaseRef = useRef(0);
	const amplitudeRef = useRef(0);
	const hasMounted = useIsMounted();

	// Safe audio playback initiation
	const attemptPlay = useCallback(async () => {
		if (!audioRef.current) return;
		try {
			if (isAmbientSfxEnabled && !isMuted) {
				audioRef.current.volume = Math.max(0, Math.min(1, (volume / 100) * 0.45));
				await audioRef.current.play();
			}
		} catch {
			// Autoplay blocked by browser until user gesture
		}
	}, [isAmbientSfxEnabled, isMuted, volume]);

	// Listen for first user interaction on window to satisfy browser autoplay policy
	useEffect(() => {
		if (typeof window !== 'undefined' && window.innerWidth < 768) return;
		const handleFirstGesture = () => {
			setHasInteracted(true);
			attemptPlay();
			window.removeEventListener('click', handleFirstGesture);
			window.removeEventListener('keydown', handleFirstGesture);
			window.removeEventListener('touchstart', handleFirstGesture);
		};

		window.addEventListener('click', handleFirstGesture);
		window.addEventListener('keydown', handleFirstGesture);
		window.addEventListener('touchstart', handleFirstGesture);

		return () => {
			window.removeEventListener('click', handleFirstGesture);
			window.removeEventListener('keydown', handleFirstGesture);
			window.removeEventListener('touchstart', handleFirstGesture);
		};
	}, [attemptPlay]);

	// React to volume / mute / enable changes
	useEffect(() => {
		if (!audioRef.current) return;

		const shouldPlay = isAmbientSfxEnabled && !isMuted;
		const targetVol = shouldPlay ? Math.max(0, Math.min(1, (volume / 100) * 0.45)) : 0;

		audioRef.current.volume = targetVol;

		if (shouldPlay) {
			if (audioRef.current.paused && hasInteracted) {
				attemptPlay();
			}
		} else {
			if (!audioRef.current.paused) {
				audioRef.current.pause();
				setIsPlaying(false);
			}
		}
	}, [isAmbientSfxEnabled, isMuted, volume, hasInteracted, attemptPlay]);

	// Waveform animation on canvas (identical to original landing page)
	useEffect(() => {
		if (typeof window !== 'undefined' && window.innerWidth < 768) return;
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
		canvas.width = 24 * dpr;
		canvas.height = 24 * dpr;

		let running = true;

		const render = () => {
			if (!running) return;

			// Smoothly interpolate amplitude towards target
			const targetAmp = isPlaying && isAmbientSfxEnabled && !isMuted ? 4 : 0;
			amplitudeRef.current += (targetAmp - amplitudeRef.current) * 0.12;

			phaseRef.current += 0.08;

			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.save();
			ctx.beginPath();
			ctx.lineWidth = 1.5 * dpr;
			ctx.strokeStyle = isPlaying && isAmbientSfxEnabled && !isMuted ? '#38bdf8' : 'rgba(255, 255, 255, 0.4)';
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';

			const length = 0.25 / dpr;
			const midY = canvas.height / 2;

			for (let x = 0; x < canvas.width; x++) {
				const y = midY + amplitudeRef.current * dpr * Math.sin(x * length + phaseRef.current);
				if (x === 0) {
					ctx.moveTo(x, y);
				} else {
					ctx.lineTo(x, y);
				}
			}
			ctx.stroke();
			ctx.restore();

			// Silent and settled to a flat line: stop. The loop used to run every
			// frame forever, sound or not; it starts again when playback does.
			if (targetAmp === 0 && amplitudeRef.current < 0.01) {
				animFrameRef.current = null;
				return;
			}
			animFrameRef.current = requestAnimationFrame(render);
		};

		animFrameRef.current = requestAnimationFrame(render);

		return () => {
			running = false;
			if (animFrameRef.current) {
				cancelAnimationFrame(animFrameRef.current);
			}
		};
	}, [isPlaying, isAmbientSfxEnabled, isMuted]);

	const handleToggle = (e: React.MouseEvent) => {
		e.stopPropagation();
		setHasInteracted(true);
		toggleAmbientSfx();
	};

	if (typeof window !== 'undefined' && window.innerWidth < 768) {
		return null;
	}

	return (
		<>
			{/* Hidden audio element */}
			<audio
				ref={audioRef}
				src={DEFAULT_SOUND_SRC}
				loop
				preload="auto"
				playsInline
				onPlay={() => setIsPlaying(true)}
				onPause={() => setIsPlaying(false)}
			/>

			{/* Floating SFX Waveform Button */}
			{showButton && hasMounted && (
				<div
					style={{
						position: 'fixed',
						// On the phone the bottom bar owns the lower edge; it publishes its height here.
						bottom: 'calc(24px + var(--mobile-nav-offset, 0px))',
						right: '28px',
						zIndex: 9999,
						pointerEvents: 'auto',
					}}
				>
					<button
						type="button"
						onClick={handleToggle}
						title="Ortam SFX"
						style={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							width: '44px',
							height: '44px',
							borderRadius: '50%',
							background:
								isAmbientSfxEnabled && !isMuted
									? 'rgba(10, 16, 28, 0.65)'
									: 'rgba(10, 16, 28, 0.35)',
							border:
								isAmbientSfxEnabled && !isMuted
									? '1px solid rgba(255, 255, 255, 0.16)'
									: '1px solid rgba(255, 255, 255, 0.08)',
							boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.12)',
							backdropFilter: 'var(--glass-blur)',
							cursor: 'pointer',
							transition: 'all 0.2s ease',
						}}
					>
						<canvas
							ref={canvasRef}
							style={{
								width: '24px',
								height: '24px',
								display: 'block',
							}}
						/>
					</button>
				</div>
			)}
		</>
	);
}
