'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export interface SoundContextValue {
	/** 0–100. */
	volume: number;
	setVolume: (volume: number) => void;
	isMuted: boolean;
	setIsMuted: (muted: boolean) => void;
	toggleMute: () => void;
	/** The ambient background sound (the menu bar's sound control). */
	isAmbientSfxEnabled: boolean;
	toggleAmbientSfx: () => void;
	/** The short chime the desktop plays for system events (e.g. an app the role does not open). */
	playSystemSound: () => void;
}

const SoundContext = createContext<SoundContextValue | null>(null);

/** System sounds: the volume, the mute switch, the ambient sound setting and the chime itself. */
export function SoundProvider({ children }: { children: React.ReactNode }) {
	const [volume, setVolume] = useState<number>(80);
	const [isMuted, setIsMuted] = useState<boolean>(false);
	const [isAmbientSfxEnabled, setIsAmbientSfxEnabled] = useState<boolean>(() => {
		if (typeof window !== 'undefined') {
			try {
				const saved = localStorage.getItem('ambient_sfx_enabled');
				return saved !== null ? saved === 'true' : true;
			} catch {
				// Storage blocked (private window): the default.
			}
		}
		return true;
	});

	const playSystemSound = useCallback(() => {
		if (isMuted) return;
		try {
			const AudioContextClass =
				typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
			if (AudioContextClass) {
				const ctx = new AudioContextClass();
				const osc = ctx.createOscillator();
				const gain = ctx.createGain();
				osc.type = 'sine';
				osc.frequency.setValueAtTime(587.33, ctx.currentTime);
				osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
				gain.gain.setValueAtTime((volume / 100) * 0.35, ctx.currentTime);
				gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
				osc.connect(gain);
				gain.connect(ctx.destination);
				osc.start();
				osc.stop(ctx.currentTime + 0.22);
			}
		} catch {
			const audio = new Audio('/sounds/mac-startup-sound.mp3');
			audio.volume = Math.max(0, Math.min(1, volume / 100));
			audio.play().catch(() => {});
		}
	}, [isMuted, volume]);

	const toggleMute = useCallback(() => {
		setIsMuted((prev) => !prev);
	}, []);

	const toggleAmbientSfx = useCallback(() => {
		setIsAmbientSfxEnabled((prev) => {
			const next = !prev;
			if (typeof window !== 'undefined') {
				try {
					localStorage.setItem('ambient_sfx_enabled', String(next));
				} catch {
					// Storage blocked: the choice holds until the page closes.
				}
			}
			return next;
		});
	}, []);

	const value = useMemo<SoundContextValue>(
		() => ({ volume, setVolume, isMuted, setIsMuted, toggleMute, isAmbientSfxEnabled, toggleAmbientSfx, playSystemSound }),
		[volume, isMuted, toggleMute, isAmbientSfxEnabled, toggleAmbientSfx, playSystemSound]
	);

	return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

/** System sound settings and the chime — `const { volume, toggleMute, playSystemSound } = useSound()`. */
export function useSound(): SoundContextValue {
	const ctx = useContext(SoundContext);
	if (!ctx) throw new Error('useSound must be used within a WorkspaceProvider');
	return ctx;
}
