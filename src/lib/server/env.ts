import { CONFIG } from './config';

/**
 * Type-safe and validated server environment configuration.
 *
 * Centralizes all process.env reads to prevent runtime crashes caused by
 * missing or invalid environment variables.
 */

export interface ServerEnv {
	NODE_ENV: 'development' | 'production' | 'test';
	DATABASE_URL: string;
	AUTH_SECRET?: string;
	BOOTSTRAP_ADMIN_EMAIL: string;
	BOOTSTRAP_ADMIN_PASSWORD?: string;
	BOOTSTRAP_ADMIN_AD: string;
	BOOTSTRAP_ADMIN_SOYAD: string;
	PUBLIC_API_ALLOWED_ORIGINS: string;
	PUBLIC_BASE_URL: string;
	UPLOAD_DIR: string;
	TERMINAL_ENABLED: boolean;
	WEBAUTHN_ORIGIN?: string;
	WEBAUTHN_RP_ID?: string;
	SMTP_HOST?: string;
	SMTP_PORT?: number;
	SMTP_USER?: string;
	SMTP_PASS?: string;
	SMTP_FROM?: string;
}

function parseServerEnv(): ServerEnv {
	const nodeEnv = (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test';
	const dbUrl = process.env.DATABASE_URL?.trim() || CONFIG.database.url || '';

	if (!dbUrl && nodeEnv !== 'test') {
		console.warn(
			'[ENV] WARNING: DATABASE_URL is not set. The application requires PostgreSQL to operate correctly.'
		);
	}

	const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim() || CONFIG.bootstrapAdmin.password;
	if (bootstrapPassword && bootstrapPassword.length < 12) {
		console.warn(
			'[CONFIG] WARNING: Bootstrap admin password must be at least 12 characters. Skipping initial admin generation.'
		);
	}

	const smtpPortRaw = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
	const smtpPort = smtpPortRaw && !isNaN(smtpPortRaw) ? smtpPortRaw : undefined;

	return {
		NODE_ENV: nodeEnv,
		DATABASE_URL: dbUrl,
		AUTH_SECRET: process.env.AUTH_SECRET?.trim() || CONFIG.security.authSecret,
		BOOTSTRAP_ADMIN_EMAIL: (process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() || CONFIG.bootstrapAdmin.email || 'admin@orbit.local').toLowerCase(),
		BOOTSTRAP_ADMIN_PASSWORD: bootstrapPassword || undefined,
		BOOTSTRAP_ADMIN_AD: process.env.BOOTSTRAP_ADMIN_AD?.trim() || CONFIG.bootstrapAdmin.firstName || 'Orbit',
		BOOTSTRAP_ADMIN_SOYAD: process.env.BOOTSTRAP_ADMIN_SOYAD?.trim() || CONFIG.bootstrapAdmin.lastName || 'Admin',
		PUBLIC_API_ALLOWED_ORIGINS: process.env.PUBLIC_API_ALLOWED_ORIGINS?.trim() || '',
		PUBLIC_BASE_URL: (process.env.PUBLIC_BASE_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, ''),
		UPLOAD_DIR: process.env.UPLOAD_DIR?.trim() || './data/uploads',
		TERMINAL_ENABLED: process.env.TERMINAL_ENABLED === '1' || (nodeEnv === 'development' && process.env.TERMINAL_ENABLED !== '0'),
		WEBAUTHN_ORIGIN: process.env.WEBAUTHN_ORIGIN?.trim() || undefined,
		WEBAUTHN_RP_ID: process.env.WEBAUTHN_RP_ID?.trim() || undefined,
		SMTP_HOST: process.env.SMTP_HOST?.trim() || undefined,
		SMTP_PORT: smtpPort,
		SMTP_USER: process.env.SMTP_USER?.trim() || undefined,
		SMTP_PASS: (process.env.SMTP_PASS || '').replace(/\s+/g, '') || undefined,
		SMTP_FROM: process.env.SMTP_FROM?.trim() || undefined,
	};
}

/**
 * Validated server-side environment object.
 */
export const serverEnv: ServerEnv = parseServerEnv();
