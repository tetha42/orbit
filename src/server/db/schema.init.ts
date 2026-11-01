import type { PoolClient } from 'pg';
import { errorMessage } from '@/lib/errors';
import { slugify, uniqueSlug } from '@/lib/text';
import { DEFAULT_REGISTRATION_CORE_CONFIG } from '@/lib/registrationConfig';
import { DEFAULT_TEAM_CATEGORIES, LEGACY_TEAM_CATEGORY_MAP } from '@/lib/teamCategories';
import {
	DEFAULT_MEMBERSHIP_POLICY,
	MEMBERSHIP_POLICY_SETTINGS_KEY,
} from '@/lib/membershipPolicy';

export async function runSchemaMigrations(client: PoolClient): Promise<void> {
	// Normalize legacy columns in base tables ('kullaniciId' -> 'userId', 'durum' -> 'status', 'takimId' -> 'teamId')
	try {
		const legacyUserCols = await client.query<{ table_name: string }>(
			`SELECT table_name FROM information_schema.columns 
			 WHERE table_schema = 'public' 
			   AND column_name IN ('kullaniciid', 'kullaniciId')
			   AND table_name NOT IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public')`
		);
		for (const row of legacyUserCols.rows) {
			await client.query(`ALTER TABLE "${row.table_name}" RENAME COLUMN kullaniciid TO userid`).catch(() => {});
		}

		const legacyStatusCols = await client.query<{ table_name: string }>(
			`SELECT table_name FROM information_schema.columns 
			 WHERE table_schema = 'public' 
			   AND column_name IN ('durum', 'Durum')
			   AND table_name NOT IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public')`
		);
		for (const row of legacyStatusCols.rows) {
			await client.query(`ALTER TABLE "${row.table_name}" RENAME COLUMN durum TO status`).catch(() => {});
		}

		const legacyTeamCols = await client.query<{ table_name: string }>(
			`SELECT table_name FROM information_schema.columns 
			 WHERE table_schema = 'public' 
			   AND column_name IN ('takimid', 'takimId')
			   AND table_name NOT IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public')`
		);
		for (const row of legacyTeamCols.rows) {
			await client.query(`ALTER TABLE "${row.table_name}" RENAME COLUMN takimid TO teamid`).catch(() => {});
		}

		const legacyDateCols = await client.query<{ table_name: string }>(
			`SELECT table_name FROM information_schema.columns 
			 WHERE table_schema = 'public' 
			   AND column_name IN ('tarih', 'Tarih')
			   AND table_name NOT IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public')`
		);
		for (const row of legacyDateCols.rows) {
			await client.query(`ALTER TABLE "${row.table_name}" RENAME COLUMN tarih TO date`).catch(() => {});
		}

		const legacyRoleCols = await client.query<{ table_name: string }>(
			`SELECT table_name FROM information_schema.columns 
			 WHERE table_schema = 'public' 
			   AND column_name IN ('rolid', 'rolId')
			   AND table_name NOT IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public')`
		);
		for (const row of legacyRoleCols.rows) {
			await client.query(`ALTER TABLE "${row.table_name}" RENAME COLUMN rolid TO roleid`).catch(() => {});
		}

		const legacyEventCols = await client.query<{ table_name: string }>(
			`SELECT table_name FROM information_schema.columns 
			 WHERE table_schema = 'public' 
			   AND column_name IN ('bitis', 'Bitis')
			   AND table_name NOT IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public')`
		);
		for (const row of legacyEventCols.rows) {
			await client.query(`ALTER TABLE "${row.table_name}" RENAME COLUMN bitis TO endtime`).catch(() => {});
		}
	} catch {
		// Non-fatal if table inspect fails
	}

	// 1. Create tables with robust constraints and BIGINT timestamps
	await client.query(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			executed_at BIGINT NOT NULL,
			description TEXT
		);

		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			first_name TEXT NOT NULL,
			last_name TEXT NOT NULL,
			email TEXT UNIQUE NOT NULL,
			email_verified_at BIGINT,
			password_hash TEXT NOT NULL,
			handle TEXT UNIQUE,
			department TEXT NOT NULL,
			grade INTEGER NOT NULL DEFAULT 1,
			avatar_url TEXT,
			bio TEXT,
			xp INTEGER NOT NULL DEFAULT 0,
			status TEXT NOT NULL DEFAULT 'beklemede',
			session_token TEXT,
			last_login_at BIGINT,
			last_login_ip TEXT,
			last_login_user_agent TEXT,
			last_active_ip TEXT,
			last_active_at BIGINT,
			totp_secret TEXT,
			totp_enabled INTEGER NOT NULL DEFAULT 0,
			totp_recovery_codes TEXT,
			totp_confirmed_at BIGINT,
			totp_last_step BIGINT,
			session_expires_at BIGINT,
			auth_method TEXT NOT NULL DEFAULT 'password',
			mail_notifications_enabled INTEGER NOT NULL DEFAULT 0,
			role_id TEXT,
			created_at BIGINT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_users_session_token ON users (session_token);
		CREATE INDEX IF NOT EXISTS idx_users_role_id ON users (role_id);

		CREATE TABLE IF NOT EXISTS teams (
			id TEXT PRIMARY KEY,
			ad TEXT NOT NULL,
			slug TEXT UNIQUE NOT NULL,
			aciklama TEXT NOT NULL,
			kategori TEXT NOT NULL,
			liderId TEXT,
			kontenjan INTEGER NOT NULL DEFAULT 6,
			repoUrl TEXT,
			katilimTuru TEXT NOT NULL DEFAULT 'acik',
			status TEXT NOT NULL DEFAULT 'aktif',
			olusturma BIGINT NOT NULL,
			FOREIGN KEY (liderId) REFERENCES users(id) ON DELETE SET NULL
		);

		CREATE TABLE IF NOT EXISTS team_members (
			id TEXT PRIMARY KEY,
			teamId TEXT NOT NULL,
			userId TEXT NOT NULL,
			takimRolu TEXT NOT NULL DEFAULT 'Developer',
			basvuruNotu TEXT,
			status TEXT NOT NULL DEFAULT 'aktif',
			katilimTarihi BIGINT NOT NULL,
			FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE,
			FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
			UNIQUE(teamId, userId)
		);

		CREATE TABLE IF NOT EXISTS team_application_decisions (
			teamId TEXT NOT NULL,
			userId TEXT NOT NULL,
			karar TEXT NOT NULL CHECK (karar IN ('kabul', 'red')),
			date BIGINT NOT NULL,
			PRIMARY KEY (teamId, userId),
			FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE,
			FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS team_tasks (
			id TEXT PRIMARY KEY,
			teamId TEXT NOT NULL,
			baslik TEXT NOT NULL,
			aciklama TEXT,
			status TEXT NOT NULL DEFAULT 'yapilacak',
			oncelik TEXT NOT NULL DEFAULT 'orta',
			atananUyeId TEXT,
			teslimTarihi BIGINT,
			sira DOUBLE PRECISION,
			etiketler TEXT,
			olusturanId TEXT REFERENCES users(id) ON DELETE SET NULL,
			guncellenme BIGINT,
			tamamlanma BIGINT,
			xpVerildi INTEGER NOT NULL DEFAULT 0,
			olusturma BIGINT NOT NULL,
			FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE,
			FOREIGN KEY (atananUyeId) REFERENCES users(id) ON DELETE SET NULL
		);

		CREATE TABLE IF NOT EXISTS team_task_items (
			id TEXT PRIMARY KEY,
			gorevId TEXT NOT NULL,
			metin TEXT NOT NULL,
			tamamMi INTEGER NOT NULL DEFAULT 0,
			sira DOUBLE PRECISION NOT NULL DEFAULT 0,
			olusturma BIGINT NOT NULL,
			FOREIGN KEY (gorevId) REFERENCES team_tasks(id) ON DELETE CASCADE
		);
		CREATE INDEX IF NOT EXISTS idx_team_task_items_task ON team_task_items (gorevId, sira);

		CREATE TABLE IF NOT EXISTS team_task_comments (
			id TEXT PRIMARY KEY,
			gorevId TEXT NOT NULL,
			userId TEXT,
			icerik TEXT NOT NULL,
			olusturma BIGINT NOT NULL,
			FOREIGN KEY (gorevId) REFERENCES team_tasks(id) ON DELETE CASCADE,
			FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
		);
		CREATE INDEX IF NOT EXISTS idx_team_task_comments_task ON team_task_comments (gorevId, olusturma);

		CREATE TABLE IF NOT EXISTS team_task_activities (
			id TEXT PRIMARY KEY,
			gorevId TEXT NOT NULL,
			aktorId TEXT,
			tur TEXT NOT NULL,
			detay TEXT,
			olusturma BIGINT NOT NULL,
			FOREIGN KEY (gorevId) REFERENCES team_tasks(id) ON DELETE CASCADE,
			FOREIGN KEY (aktorId) REFERENCES users(id) ON DELETE SET NULL
		);
		CREATE INDEX IF NOT EXISTS idx_team_task_activities_task ON team_task_activities (gorevId, olusturma DESC);

		CREATE TABLE IF NOT EXISTS events (
			id TEXT PRIMARY KEY,
			slug TEXT UNIQUE NOT NULL,
			baslik TEXT NOT NULL,
			tur TEXT NOT NULL,
			aciklama TEXT NOT NULL,
			konum TEXT NOT NULL,
			baslangic BIGINT NOT NULL,
			endTime BIGINT NOT NULL,
			kapasite INTEGER DEFAULT 60,
			status TEXT NOT NULL DEFAULT 'yayinda',
			yoklamaAcik INTEGER NOT NULL DEFAULT 0,
			guncellenme BIGINT,
			olusturanId TEXT,
			olusturma BIGINT NOT NULL,
			FOREIGN KEY (olusturanId) REFERENCES users(id) ON DELETE SET NULL
		);

		CREATE TABLE IF NOT EXISTS event_registrations (
			etkinlikId TEXT NOT NULL,
			userId TEXT NOT NULL,
			olusturma BIGINT NOT NULL,
			PRIMARY KEY (etkinlikId, userId),
			FOREIGN KEY (etkinlikId) REFERENCES events(id) ON DELETE CASCADE,
			FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS attendances (
			id TEXT PRIMARY KEY,
			etkinlikId TEXT NOT NULL,
			userId TEXT NOT NULL,
			yontem TEXT NOT NULL DEFAULT 'qr',
			katilimZamani BIGINT NOT NULL,
			kaydedenId TEXT REFERENCES users(id) ON DELETE SET NULL,
			FOREIGN KEY (etkinlikId) REFERENCES events(id) ON DELETE CASCADE,
			FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
			UNIQUE(etkinlikId, userId)
		);

		CREATE TABLE IF NOT EXISTS budget_records (
			id TEXT PRIMARY KEY,
			date BIGINT NOT NULL,
			tur TEXT NOT NULL,
			kategori TEXT NOT NULL,
			tutarKurus INTEGER NOT NULL,
			aciklama TEXT NOT NULL,
			fisFotoUrl TEXT,
			kaydedenId TEXT,
			teamId TEXT,
			aktarimId TEXT,
			guncelleyenId TEXT,
			guncellenme BIGINT,
			olusturma BIGINT NOT NULL,
			FOREIGN KEY (kaydedenId) REFERENCES users(id) ON DELETE SET NULL,
			FOREIGN KEY (guncelleyenId) REFERENCES users(id) ON DELETE SET NULL
		);

		CREATE TABLE IF NOT EXISTS files (
			ad TEXT PRIMARY KEY,
			yukleyenId TEXT,
			mime TEXT NOT NULL,
			boyut INTEGER NOT NULL,
			herkeseAcik INTEGER NOT NULL DEFAULT 0,
			olusturma BIGINT NOT NULL,
			FOREIGN KEY (yukleyenId) REFERENCES users(id) ON DELETE SET NULL
		);

		CREATE TABLE IF NOT EXISTS decisions (
			id TEXT PRIMARY KEY,
			kararNo INTEGER UNIQUE NOT NULL,
			belgeTuru TEXT NOT NULL DEFAULT 'karar',
			baslik TEXT NOT NULL,
			date BIGINT NOT NULL,
			gundem TEXT NOT NULL,
			icerik TEXT NOT NULL,
			kamuyaAcikMi INTEGER NOT NULL DEFAULT 1,
			kilitliMi INTEGER NOT NULL DEFAULT 0,
			olusturanId TEXT,
			olusturma BIGINT NOT NULL,
			FOREIGN KEY (olusturanId) REFERENCES users(id) ON DELETE SET NULL
		);

		CREATE TABLE IF NOT EXISTS news (
			id TEXT PRIMARY KEY,
			slug TEXT UNIQUE,
			baslik TEXT NOT NULL,
			ozet TEXT NOT NULL,
			icerik TEXT NOT NULL,
			kategori TEXT NOT NULL DEFAULT 'genel',
			onemliMi INTEGER NOT NULL DEFAULT 0,
			resimUrl TEXT,
			yazarId TEXT,
			publishStatus TEXT NOT NULL DEFAULT 'yayinda',
			yayinTarihi BIGINT,
			olusturma BIGINT NOT NULL,
			guncellenme BIGINT NOT NULL,
			FOREIGN KEY (yazarId) REFERENCES users(id) ON DELETE SET NULL
		);

		CREATE TABLE IF NOT EXISTS certificates (
			id TEXT PRIMARY KEY,
			verificationCode TEXT UNIQUE NOT NULL,
			userId TEXT NOT NULL,
			etkinlikId TEXT,
			baslik TEXT NOT NULL,
			verilisTarihi BIGINT NOT NULL,
			pdfUrl TEXT,
			kategori TEXT DEFAULT 'achievement',
			dil TEXT DEFAULT 'tr',
			aciklama TEXT,
			olusturma BIGINT NOT NULL,
			FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY (etkinlikId) REFERENCES events(id) ON DELETE SET NULL
		);

		CREATE TABLE IF NOT EXISTS inventory (
			id TEXT PRIMARY KEY,
			kod TEXT UNIQUE NOT NULL,
			ad TEXT NOT NULL,
			kategori TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'saglam',
			konum TEXT NOT NULL,
			oduncAlanId TEXT,
			oduncTarihi BIGINT,
			iadeTarihi BIGINT,
			aciklama TEXT,
			seriNo TEXT,
			FOREIGN KEY (oduncAlanId) REFERENCES users(id) ON DELETE SET NULL
		);

		CREATE TABLE IF NOT EXISTS inventory_activities (
			id TEXT PRIMARY KEY,
			envanterId TEXT NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
			tur TEXT NOT NULL,
			aktorId TEXT REFERENCES users(id) ON DELETE SET NULL,
			userId TEXT REFERENCES users(id) ON DELETE SET NULL,
			aciklama TEXT,
			date BIGINT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS user_notes (
			id TEXT PRIMARY KEY,
			userId TEXT NOT NULL,
			baslik TEXT NOT NULL,
			icerik TEXT NOT NULL,
			renk TEXT DEFAULT 'sari',
			sabitliMi INTEGER NOT NULL DEFAULT 0,
			klasorId TEXT NOT NULL DEFAULT 'quick',
			copteMi INTEGER NOT NULL DEFAULT 0,
			guncellenme BIGINT NOT NULL,
			olusturma BIGINT NOT NULL,
			FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS user_note_folders (
			id TEXT PRIMARY KEY,
			userId TEXT NOT NULL,
			ad TEXT NOT NULL,
			renk TEXT,
			sira INTEGER DEFAULT 0,
			olusturma BIGINT NOT NULL,
			FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS system_settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL,
			updated_at BIGINT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS legal_documents (
			id TEXT PRIMARY KEY,
			doc_type TEXT UNIQUE NOT NULL,
			scope TEXT NOT NULL DEFAULT 'registration',
			title_tr TEXT NOT NULL,
			title_en TEXT NOT NULL,
			body_tr TEXT NOT NULL,
			body_en TEXT NOT NULL,
			required INTEGER NOT NULL DEFAULT 0,
			enabled INTEGER NOT NULL DEFAULT 1,
			sort_order INTEGER NOT NULL DEFAULT 0,
			updated_at BIGINT NOT NULL,
			updated_by TEXT
		);

		CREATE TABLE IF NOT EXISTS form_fields (
			id TEXT PRIMARY KEY,
			scope TEXT NOT NULL DEFAULT 'registration',
			field_key TEXT NOT NULL,
			type TEXT NOT NULL DEFAULT 'text',
			section TEXT NOT NULL DEFAULT 'custom',
			label_tr TEXT NOT NULL,
			label_en TEXT NOT NULL,
			placeholder_tr TEXT,
			placeholder_en TEXT,
			options TEXT NOT NULL DEFAULT '[]',
			required INTEGER NOT NULL DEFAULT 0,
			enabled INTEGER NOT NULL DEFAULT 1,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at BIGINT NOT NULL,
			updated_at BIGINT NOT NULL,
			UNIQUE (scope, field_key)
		);

		CREATE TABLE IF NOT EXISTS member_field_values (
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			field_id TEXT NOT NULL REFERENCES form_fields(id) ON DELETE CASCADE,
			value TEXT NOT NULL,
			updated_at BIGINT NOT NULL,
			PRIMARY KEY (user_id, field_id)
		);

		CREATE TABLE IF NOT EXISTS custom_wallpapers (
			id TEXT PRIMARY KEY,
			title_tr TEXT NOT NULL,
			title_en TEXT NOT NULL,
			type TEXT NOT NULL DEFAULT 'custom',
			filename TEXT UNIQUE NOT NULL,
			mime TEXT NOT NULL,
			size INTEGER NOT NULL DEFAULT 0,
			created_by TEXT,
			created_at BIGINT NOT NULL,
			sort_order INTEGER NOT NULL DEFAULT 0
		);

		CREATE TABLE IF NOT EXISTS webauthn_credentials (
			id TEXT PRIMARY KEY,
			userId TEXT NOT NULL,
			publicKey TEXT NOT NULL,
			counter BIGINT NOT NULL DEFAULT 0,
			transports TEXT,
			deviceType TEXT,
			backedUp INTEGER NOT NULL DEFAULT 0,
			nickname TEXT,
			olusturma BIGINT NOT NULL,
			sonKullanma BIGINT,
			FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
		);
		CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user ON webauthn_credentials (userId);

		CREATE TABLE IF NOT EXISTS webauthn_challenges (
			id TEXT PRIMARY KEY,
			userId TEXT,
			challenge TEXT NOT NULL,
			tur TEXT NOT NULL,
			olusturma BIGINT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_created ON webauthn_challenges (olusturma);

		CREATE TABLE IF NOT EXISTS projects (
			id TEXT PRIMARY KEY,
			slug TEXT UNIQUE NOT NULL,
			baslik TEXT NOT NULL,
			ozet TEXT NOT NULL DEFAULT '',
			aciklama TEXT NOT NULL DEFAULT '',
			repoUrl TEXT,
			canliUrl TEXT,
			teknolojiler TEXT NOT NULL DEFAULT '[]',
			teamId TEXT,
			olusturanId TEXT,
			status TEXT NOT NULL DEFAULT 'oneri',
			oneCikan INTEGER NOT NULL DEFAULT 0,
			olusturma BIGINT NOT NULL,
			guncellenme BIGINT NOT NULL,
			FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE SET NULL,
			FOREIGN KEY (olusturanId) REFERENCES users(id) ON DELETE SET NULL
		);
		CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status, oneCikan DESC, olusturma DESC);

		CREATE TABLE IF NOT EXISTS project_likes (
			projeId TEXT NOT NULL,
			userId TEXT NOT NULL,
			olusturma BIGINT NOT NULL,
			PRIMARY KEY (projeId, userId),
			FOREIGN KEY (projeId) REFERENCES projects(id) ON DELETE CASCADE,
			FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS chat_rooms (
			id TEXT PRIMARY KEY,
			tur TEXT NOT NULL DEFAULT 'genel',
			teamId TEXT REFERENCES teams(id) ON DELETE CASCADE,
			ad TEXT NOT NULL,
			olusturma BIGINT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_chat_rooms_team ON chat_rooms (teamId);

		CREATE TABLE IF NOT EXISTS chat_messages (
			id TEXT PRIMARY KEY,
			odaId TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
			gonderenId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			gonderenAd TEXT NOT NULL,
			gonderenFoto TEXT,
			icerik TEXT NOT NULL,
			ekler TEXT NOT NULL DEFAULT '[]',
			date BIGINT NOT NULL,
			silinmeTarihi BIGINT DEFAULT NULL,
			duzenlenmeTarihi BIGINT DEFAULT NULL,
			yanitlananMesajId TEXT DEFAULT NULL,
			yanitlananMesaj TEXT DEFAULT NULL,
			iletildiMi INTEGER NOT NULL DEFAULT 0
		);
		CREATE INDEX IF NOT EXISTS idx_chat_messages_room_time ON chat_messages (odaId, date ASC);

		CREATE TABLE IF NOT EXISTS chat_members (
			odaId TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
			userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			sonOkuma BIGINT NOT NULL DEFAULT 0,
			PRIMARY KEY (odaId, userId)
		);

		CREATE TABLE IF NOT EXISTS email_verifications (
			email TEXT PRIMARY KEY,
			code TEXT NOT NULL,
			type TEXT NOT NULL DEFAULT 'registration',
			expires_at BIGINT NOT NULL,
			created_at BIGINT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS system_logs (
			id BIGSERIAL PRIMARY KEY,
			zaman BIGINT NOT NULL,
			seviye TEXT NOT NULL DEFAULT 'INFO',
			servis TEXT NOT NULL,
			mesaj TEXT NOT NULL,
			detay JSONB,
			userId TEXT,
			ip TEXT NOT NULL DEFAULT ''
		);
		CREATE INDEX IF NOT EXISTS idx_system_logs_zaman ON system_logs (zaman DESC);
		CREATE INDEX IF NOT EXISTS idx_system_logs_servis ON system_logs (servis, zaman DESC);
		CREATE INDEX IF NOT EXISTS idx_system_logs_seviye ON system_logs (seviye, zaman DESC);
		CREATE INDEX IF NOT EXISTS idx_system_logs_ip ON system_logs (ip, zaman DESC);

		CREATE TABLE IF NOT EXISTS soc_incidents (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			severity TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'new',
			source_ip TEXT,
			service TEXT,
			details JSONB,
			analyst_notes TEXT,
			assigned_to TEXT,
			created_at BIGINT NOT NULL,
			updated_at BIGINT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_soc_incidents_status ON soc_incidents (status, created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_soc_incidents_ip ON soc_incidents (source_ip);

		CREATE TABLE IF NOT EXISTS user_workspace_preferences (
			user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			state JSONB NOT NULL DEFAULT '{}'::jsonb,
			updated_at BIGINT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_workspace_pref_updated_at ON user_workspace_preferences(updated_at DESC);

		-- All domain queries now target canonical English physical tables directly.
		-- Drop all legacy Turkish compatibility views:
		DROP VIEW IF EXISTS kullanicilar CASCADE;
		DROP VIEW IF EXISTS takimlar CASCADE;
		DROP VIEW IF EXISTS takim_uyeleri CASCADE;
		DROP VIEW IF EXISTS takim_basvuru_kararlari CASCADE;
		DROP VIEW IF EXISTS takim_gorevleri CASCADE;
		DROP VIEW IF EXISTS takim_gorev_maddeleri CASCADE;
		DROP VIEW IF EXISTS takim_gorev_yorumlari CASCADE;
		DROP VIEW IF EXISTS takim_gorev_aktivite CASCADE;
		DROP VIEW IF EXISTS etkinlikler CASCADE;
		DROP VIEW IF EXISTS etkinlik_kayitlari CASCADE;
		DROP VIEW IF EXISTS yoklamalar CASCADE;
		DROP VIEW IF EXISTS butce_kayitlari CASCADE;
		DROP VIEW IF EXISTS dosyalar CASCADE;
		DROP VIEW IF EXISTS tutanaklar_kararlar CASCADE;
		DROP VIEW IF EXISTS haberler CASCADE;
		DROP VIEW IF EXISTS sertifikalar CASCADE;
		DROP VIEW IF EXISTS envanter CASCADE;
		DROP VIEW IF EXISTS envanter_hareketleri CASCADE;
		DROP VIEW IF EXISTS kullanici_notlari CASCADE;
		DROP VIEW IF EXISTS kullanici_not_klasorleri CASCADE;
		DROP VIEW IF EXISTS sistem_ayarlari CASCADE;
		DROP VIEW IF EXISTS sohbet_odalari CASCADE;
		DROP VIEW IF EXISTS sohbet_mesajlari CASCADE;
		DROP VIEW IF EXISTS sohbet_uyeleri CASCADE;
		DROP VIEW IF EXISTS eposta_dogrulama CASCADE;
		DROP VIEW IF EXISTS sistem_loglari CASCADE;
		DROP VIEW IF EXISTS projeler CASCADE;
		DROP VIEW IF EXISTS proje_begenileri CASCADE;
		DROP VIEW IF EXISTS sohbet_anketleri CASCADE;
		DROP VIEW IF EXISTS sohbet_anket_secenekleri CASCADE;
		DROP VIEW IF EXISTS sohbet_anket_oylari CASCADE;
		DROP VIEW IF EXISTS guvenlik_engelleri CASCADE;
	`);

	try {
		await client.query(`
			CREATE EXTENSION IF NOT EXISTS pg_trgm;
			CREATE INDEX IF NOT EXISTS idx_system_logs_message_trgm ON system_logs USING gin (mesaj gin_trgm_ops);
		`);
	} catch {
		// Ignore if pg_trgm is not available on restricted host
	}

	await client.query(`
		INSERT INTO chat_rooms (id, tur, teamId, ad, olusturma)
		VALUES ('oda_genel', 'genel', NULL, 'Orbit General Chat', $1)
		ON CONFLICT (id) DO NOTHING;
	`, [Date.now()]);

	const hadXpColumn =
		((
			await client.query(
				`SELECT 1 FROM information_schema.columns WHERE table_name = 'takim_gorevleri' AND column_name = 'xpverildi'`
			)
		).rowCount ?? 0) > 0;

	const tableMap: Record<string, string> = {
		kullanicilar: 'users',
		tutanaklar_kararlar: 'decisions',
		takim_gorevleri: 'team_tasks',
		etkinlikler: 'events',
		takimlar: 'teams',
		takim_uyeleri: 'team_members',
		dosyalar: 'files',
		yoklamalar: 'attendances',
		butce_kayitlari: 'budget_records',
		envanter: 'inventory',
		haberler: 'news',
		kullanici_notlari: 'user_notes',
		sertifikalar: 'certificates',
		sohbet_mesajlari: 'chat_messages',
	};

	const userColMap: Record<string, string> = {
		oturumBitis: 'session_expires_at',
		totpSonAdim: 'totp_last_step',
		sonGirisIp: 'last_login_ip',
		sonGirisUserAgent: 'last_login_user_agent',
		sonAktifIp: 'last_active_ip',
		sonAktifTarihi: 'last_active_at',
	};

	for (const [table, column, type] of [
		['kullanicilar', 'oturumBitis', 'BIGINT'],
		['kullanicilar', 'totpSonAdim', 'BIGINT'],
		['tutanaklar_kararlar', 'belgeTuru', "TEXT DEFAULT 'karar'"],
		['takim_gorevleri', 'xpVerildi', 'INTEGER NOT NULL DEFAULT 0'],
		['etkinlikler', 'yoklamaAcik', 'INTEGER NOT NULL DEFAULT 0'],
		['takimlar', 'katilimTuru', "TEXT NOT NULL DEFAULT 'acik'"],
		['takim_uyeleri', 'basvuruNotu', 'TEXT'],
		['dosyalar', 'herkeseAcik', 'INTEGER NOT NULL DEFAULT 0'],
		['etkinlikler', 'guncellenme', 'BIGINT'],
		['yoklamalar', 'kaydedenId', 'TEXT REFERENCES users(id) ON DELETE SET NULL'],
		['takim_gorevleri', 'sira', 'DOUBLE PRECISION'],
		['takim_gorevleri', 'etiketler', 'TEXT'],
		['takim_gorevleri', 'olusturanId', 'TEXT REFERENCES users(id) ON DELETE SET NULL'],
		['takim_gorevleri', 'guncellenme', 'BIGINT'],
		['takim_gorevleri', 'tamamlanma', 'BIGINT'],
		['butce_kayitlari', 'teamId', 'TEXT REFERENCES teams(id) ON DELETE RESTRICT'],
		['envanter', 'aciklama', 'TEXT'],
		['envanter', 'seriNo', 'TEXT'],
		['envanter', 'oduncTarihi', 'BIGINT'],
		['butce_kayitlari', 'aktarimId', 'TEXT'],
		['butce_kayitlari', 'guncelleyenId', 'TEXT REFERENCES users(id) ON DELETE SET NULL'],
		['butce_kayitlari', 'guncellenme', 'BIGINT'],
		['haberler', 'slug', 'TEXT'],
		['haberler', 'publishStatus', "TEXT NOT NULL DEFAULT 'yayinda'"],
		['haberler', 'yayinTarihi', 'BIGINT'],
		['kullanici_notlari', 'klasorId', "TEXT NOT NULL DEFAULT 'quick'"],
		['kullanici_notlari', 'copteMi', 'INTEGER NOT NULL DEFAULT 0'],
		['sertifikalar', 'kategori', "TEXT DEFAULT 'achievement'"],
		['sertifikalar', 'dil', "TEXT DEFAULT 'tr'"],
		['sertifikalar', 'aciklama', 'TEXT'],
		['sohbet_mesajlari', 'silinmeTarihi', 'BIGINT'],
		['sohbet_mesajlari', 'duzenlenmeTarihi', 'BIGINT'],
		['sohbet_mesajlari', 'yanitlananMesajId', 'TEXT DEFAULT NULL'],
		['sohbet_mesajlari', 'yanitlananMesaj', 'TEXT DEFAULT NULL'],
		['sohbet_mesajlari', 'iletildiMi', 'INTEGER NOT NULL DEFAULT 0'],
		['kullanicilar', 'sonGirisIp', 'TEXT'],
		['kullanicilar', 'sonGirisUserAgent', 'TEXT'],
		['kullanicilar', 'sonAktifIp', 'TEXT'],
		['kullanicilar', 'sonAktifTarihi', 'BIGINT'],
	] as const) {
		const targetTable = tableMap[table] || table;
		const targetCol = targetTable === 'users' ? (userColMap[column] || column) : column;
		const check = await client.query(
			`SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND (column_name = $2 OR column_name = $3)`,
			[targetTable, column.toLowerCase(), targetCol.toLowerCase()]
		);
		if ((check.rowCount ?? 0) === 0) {
			await client
				.query(`ALTER TABLE ${targetTable} ADD COLUMN IF NOT EXISTS ${targetCol} ${type}`)
				.catch((err: unknown) => {
					console.warn(`[PostgreSQL] ${targetTable}.${targetCol} migration:`, errorMessage(err));
				});
		}
	}

	await client
		.query(`CREATE INDEX IF NOT EXISTS idx_budget_records_team ON budget_records (teamId, date DESC)`)
		.catch((err: unknown) => {
			console.warn('[PostgreSQL] idx_budget_records_team:', errorMessage(err));
		});
	await client
		.query(`CREATE INDEX IF NOT EXISTS idx_inventory_activities_item ON inventory_activities (envanterId, date DESC)`)
		.catch((err: unknown) => {
			console.warn('[PostgreSQL] idx_inventory_activities_item:', errorMessage(err));
		});
	await client
		.query(`CREATE INDEX IF NOT EXISTS idx_budget_records_aktarim ON budget_records (aktarimId) WHERE aktarimId IS NOT NULL`)
		.catch((err: unknown) => {
			console.warn('[PostgreSQL] idx_budget_records_aktarim:', errorMessage(err));
		});
	await client
		.query(`CREATE INDEX IF NOT EXISTS idx_user_notes_user ON user_notes (userId, guncellenme DESC)`)
		.catch((err: unknown) => {
			console.warn('[PostgreSQL] idx_user_notes_user:', errorMessage(err));
		});
	await client
		.query(`CREATE INDEX IF NOT EXISTS idx_user_note_folders_user ON user_note_folders (userId, olusturma ASC)`)
		.catch((err: unknown) => {
			console.warn('[PostgreSQL] idx_user_note_folders_user:', errorMessage(err));
		});
	await client
		.query(`CREATE INDEX IF NOT EXISTS idx_chat_messages_room_deleted ON chat_messages (odaId, silinmeTarihi)`)
		.catch((err: unknown) => {
			console.warn('[PostgreSQL] idx_chat_messages_room_deleted:', errorMessage(err));
		});

	async function runMigrationStep(
		version: string,
		description: string,
		fn: () => Promise<void>
	): Promise<void> {
		try {
			const check = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);
			if ((check.rowCount ?? 0) > 0) return;

			await fn();
			await client.query(
				'INSERT INTO schema_migrations (version, executed_at, description) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
				[version, Date.now(), description]
			);
		} catch (err: unknown) {
			console.warn(`[Migration] ${version} (${description}):`, errorMessage(err));
		}
	}

	await runMigrationStep('2026_01_fis_foto_url', 'Fix fisFotoUrl pathing', async () => {
		await client.query(
			`UPDATE butce_kayitlari SET fisFotoUrl = regexp_replace(fisFotoUrl, '^/uploads/', '/api/uploads/') WHERE fisFotoUrl LIKE '/uploads/%'`
		);
	});

	await runMigrationStep('2026_02_profil_foto_cleanup', 'Clean legacy mock profile photos', async () => {
		await client.query(`UPDATE users SET avatar_url = NULL WHERE avatar_url LIKE '/purus-profile/%'`);
	});

	await runMigrationStep('2026_03_haberler_slugs', 'Backfill unique slugs for news', async () => {
		const unslugged = await client.query(
			'SELECT id, baslik FROM news WHERE slug IS NULL ORDER BY olusturma ASC'
		);
		for (const row of unslugged.rows) {
			const slug = await uniqueSlug(
				slugify(row.baslik),
				async (candidate) =>
					((await client.query('SELECT 1 FROM news WHERE slug = $1', [candidate])).rowCount ?? 0) > 0,
				'haber'
			);
			await client.query('UPDATE news SET slug = $1 WHERE id = $2', [slug, row.id]);
		}
		await client.query(
			`UPDATE news SET yayinTarihi = olusturma WHERE yayinTarihi IS NULL AND publishStatus <> 'taslak'`
		);
		await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_news_slug ON news (slug)');
	});

	if (!hadXpColumn) {
		await runMigrationStep('2026_04_takim_gorevleri_xp', 'Backfill task xp flags', async () => {
			const check = await client.query(`SELECT to_regclass('takim_gorevleri') AS tbl, to_regclass('team_tasks') AS canonical`);
			const target = check.rows[0]?.canonical ? 'team_tasks' : (check.rows[0]?.tbl ? 'takim_gorevleri' : null);
			if (target) {
				await client.query(`UPDATE "${target}" SET xpVerildi = 1 WHERE status = 'tamamlandi'`);
			}
		});
	}

	await runMigrationStep('2026_05_takim_gorevleri_sira', 'Backfill task ordering and timestamps', async () => {
		const check = await client.query(`SELECT to_regclass('takim_gorevleri') AS tbl, to_regclass('team_tasks') AS canonical`);
		const target = check.rows[0]?.canonical ? 'team_tasks' : (check.rows[0]?.tbl ? 'takim_gorevleri' : null);
		if (target) {
			await client.query(
				`UPDATE "${target}"
				 SET sira = COALESCE(sira, -olusturma),
				     guncellenme = COALESCE(guncellenme, olusturma),
				     tamamlanma = CASE WHEN status = 'tamamlandi' THEN COALESCE(tamamlanma, olusturma) ELSE tamamlanma END
				 WHERE sira IS NULL OR guncellenme IS NULL`
			);
		}
	});

	await runMigrationStep('2026_06_etkinlik_kayitlari', 'Migrate attendance to registrations', async () => {
		const check = await client.query(`SELECT to_regclass('etkinlik_kayitlari') AS reg, to_regclass('yoklamalar') AS yok`);
		if (check.rows[0]?.reg && check.rows[0]?.yok) {
			await client.query(
				`INSERT INTO etkinlik_kayitlari (etkinlikId, userId, olusturma)
				 SELECT etkinlikId, userId, katilimZamani FROM yoklamalar
				 WHERE yontem NOT IN ('qr', 'bilet', 'manuel')
				 ON CONFLICT DO NOTHING`
			);
			await client.query(`DELETE FROM yoklamalar WHERE yontem NOT IN ('qr', 'bilet', 'manuel')`);
		}
	});

	await runMigrationStep('2026_07_sertifikalar_bigint', 'Cast certificate timestamps to BIGINT', async () => {
		await client.query(`DROP VIEW IF EXISTS sertifikalar CASCADE`);
		for (const column of ['verilistarihi', 'olusturma']) {
			try {
				await client.query(`
					ALTER TABLE certificates
					ALTER COLUMN ${column} TYPE BIGINT
					USING (NULLIF(regexp_replace(${column}::text, '[^0-9]', '', 'g'), '')::bigint)
				`);
			} catch (err) {
				if (!/is of type bigint/i.test(String(errorMessage(err)))) {
					throw err;
				}
			}
		}
	});

	await runMigrationStep('2026_08_kullanicilar_durum', 'Normalize default user status', async () => {
		await client.query(`ALTER TABLE users ALTER COLUMN status SET DEFAULT 'beklemede'`);
		await client.query(`UPDATE users SET status = 'beklemede' WHERE status = 'pending'`);
	});

	await runMigrationStep('2026_09_sohbet_mesajlari_moderasyon', 'Add soft-delete and edit timestamps to chat messages', async () => {
		await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS silinmeTarihi BIGINT DEFAULT NULL`);
		await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS duzenlenmeTarihi BIGINT DEFAULT NULL`);
		await client.query(`CREATE INDEX IF NOT EXISTS idx_chat_messages_room_deleted ON chat_messages (odaId, silinmeTarihi)`);
	});

	await runMigrationStep('2026_10_sohbet_anket_sistemi', 'Create chat poll tables for interactive polls and voting', async () => {
		await client.query(`
			CREATE TABLE IF NOT EXISTS chat_polls (
				id TEXT PRIMARY KEY,
				mesajId TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
				odaId TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
				olusturanId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				soru TEXT NOT NULL,
				cokluSecim BOOLEAN NOT NULL DEFAULT false,
				anonim BOOLEAN NOT NULL DEFAULT true,
				endsAt BIGINT DEFAULT NULL,
				kapali BOOLEAN NOT NULL DEFAULT false,
				olusturma BIGINT NOT NULL
			);

			CREATE INDEX IF NOT EXISTS idx_chat_polls_mesaj ON chat_polls (mesajId);
			CREATE INDEX IF NOT EXISTS idx_chat_polls_oda ON chat_polls (odaId);

			CREATE TABLE IF NOT EXISTS chat_poll_options (
				id TEXT PRIMARY KEY,
				pollId TEXT NOT NULL REFERENCES chat_polls(id) ON DELETE CASCADE,
				sira INTEGER NOT NULL DEFAULT 0,
				metin TEXT NOT NULL
			);

			CREATE INDEX IF NOT EXISTS idx_chat_poll_options_poll ON chat_poll_options (pollId, sira ASC);

			CREATE TABLE IF NOT EXISTS chat_poll_votes (
				id TEXT PRIMARY KEY,
				pollId TEXT NOT NULL REFERENCES chat_polls(id) ON DELETE CASCADE,
				secenekId TEXT NOT NULL REFERENCES chat_poll_options(id) ON DELETE CASCADE,
				userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				userFirstName TEXT NOT NULL,
				userAvatar TEXT,
				date BIGINT NOT NULL,
				UNIQUE(pollId, secenekId, userId)
			);

			CREATE INDEX IF NOT EXISTS idx_chat_poll_votes_poll ON chat_poll_votes (pollId);
			CREATE INDEX IF NOT EXISTS idx_chat_poll_votes_user ON chat_poll_votes (userId);

			DROP VIEW IF EXISTS sohbet_anketleri CASCADE;
			DROP VIEW IF EXISTS sohbet_anket_secenekleri CASCADE;
			DROP VIEW IF EXISTS sohbet_anket_oylari CASCADE;
		`);
	});

	await runMigrationStep('2026_11_soc_guvenlik_tablolar', 'Create SoC IP quarantine and firewall table', async () => {
		await client.query(`
			CREATE TABLE IF NOT EXISTS security_blocks (
				ip TEXT PRIMARY KEY,
				status TEXT NOT NULL DEFAULT 'ban',
				reason TEXT NOT NULL,
				threat_score INTEGER NOT NULL DEFAULT 100,
				violations INTEGER NOT NULL DEFAULT 1,
				creator_id TEXT,
				expires_at BIGINT DEFAULT NULL,
				created_at BIGINT NOT NULL,
				updated_at BIGINT NOT NULL
			);

			CREATE INDEX IF NOT EXISTS idx_security_blocks_durum ON security_blocks (status, expires_at);
			DROP VIEW IF EXISTS guvenlik_engelleri CASCADE;
		`);
	});

	await runMigrationStep('2026_12_english_schema_rename', 'Migrate all tables and columns to English with backwards-compatible updatable views', async () => {
		// Map of old table name -> new table name
		const tableRenames: [string, string][] = [
			['kullanicilar', 'users'],
			['roller', 'roles'],
			['rol_izinleri', 'role_permissions'],
			['takimlar', 'teams'],
			['takim_uyeleri', 'team_members'],
			['takim_basvuru_kararlari', 'team_application_decisions'],
			['takim_gorevleri', 'team_tasks'],
			['takim_gorev_maddeleri', 'team_task_items'],
			['takim_gorev_yorumlari', 'team_task_comments'],
			['takim_gorev_aktivite', 'team_task_activities'],
			['etkinlikler', 'events'],
			['etkinlik_kayitlari', 'event_registrations'],
			['yoklamalar', 'attendances'],
			['butce_kayitlari', 'budget_records'],
			['dosyalar', 'files'],
			['tutanaklar_kararlar', 'decisions'],
			['haberler', 'news'],
			['sertifikalar', 'certificates'],
			['envanter', 'inventory'],
			['envanter_hareketleri', 'inventory_activities'],
			['kullanici_notlari', 'user_notes'],
			['kullanici_not_klasorleri', 'user_note_folders'],
			['sistem_ayarlari', 'system_settings'],
			['sohbet_odalari', 'chat_rooms'],
			['sohbet_mesajlari', 'chat_messages'],
			['sohbet_uyeleri', 'chat_members'],
			['sohbet_anketleri', 'chat_polls'],
			['sohbet_anket_secenekleri', 'chat_poll_options'],
			['sohbet_anket_oylari', 'chat_poll_votes'],
			['eposta_dogrulama', 'email_verifications'],
			['sistem_loglari', 'system_logs'],
			['guvenlik_engelleri', 'security_blocks'],
			['mesaj_konulari', 'mail_threads'],
			['mesajlar', 'mail_messages'],
			['mesaj_alicilari', 'mail_recipients'],
			['denetim_kaydi', 'audit_logs'],
			['projeler', 'projects'],
			['proje_begenileri', 'project_likes'],
		];

		// Check which base tables exist
		const baseTablesRes = await client.query<{ table_name: string }>(
			`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
		);
		const existingBaseTables = new Set(baseTablesRes.rows.map((r) => r.table_name));

		// Safely rename base tables
		for (const [oldName, newName] of tableRenames) {
			if (existingBaseTables.has(oldName) && !existingBaseTables.has(newName)) {
				await client.query(`ALTER TABLE ${oldName} RENAME TO ${newName}`);
			}
		}

		// Helper to safely rename column if exists
		const renameCol = async (table: string, oldCol: string, newCol: string) => {
			if (oldCol.toLowerCase() === newCol.toLowerCase()) return;
			const check = await client.query<{ column_name: string }>(
				`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND lower(column_name) = $2`,
				[table, oldCol.toLowerCase()]
			);
			if (check.rowCount && check.rows[0]?.column_name) {
				await client.query(`ALTER TABLE ${table} RENAME COLUMN "${check.rows[0].column_name}" TO "${newCol}"`).catch(() => {});
			}
		};

		// Safely rename columns in users
		await renameCol('users', 'ad', 'first_name');
		await renameCol('users', 'soyad', 'last_name');
		await renameCol('users', 'email', 'email');
		await renameCol('users', 'passwordHash', 'password_hash');
		await renameCol('users', 'sifrehash', 'password_hash');
		await renameCol('users', 'ogrenciNo', 'handle');
		await renameCol('users', 'ogrencino', 'handle');
		await renameCol('users', 'bolum', 'department');
		await renameCol('users', 'sinif', 'grade');
		await renameCol('users', 'roleId', 'role_id');
		await renameCol('users', 'rolid', 'role_id');
		await renameCol('users', 'profilFoto', 'avatar_url');
		await renameCol('users', 'profilfoto', 'avatar_url');
		await renameCol('users', 'status', 'status');
		await renameCol('users', 'aktifOturumToken', 'session_token');
		await renameCol('users', 'aktifoturumtoken', 'session_token');
		await renameCol('users', 'sonGirisTarihi', 'last_login_at');
		await renameCol('users', 'songiristarihi', 'last_login_at');
		await renameCol('users', 'sonGirisIp', 'last_login_ip');
		await renameCol('users', 'songirisip', 'last_login_ip');
		await renameCol('users', 'sonGirisUserAgent', 'last_login_user_agent');
		await renameCol('users', 'songirisuseragent', 'last_login_user_agent');
		await renameCol('users', 'sonAktifIp', 'last_active_ip');
		await renameCol('users', 'sonaktifip', 'last_active_ip');
		await renameCol('users', 'sonAktifTarihi', 'last_active_at');
		await renameCol('users', 'sonaktiftarihi', 'last_active_at');
		await renameCol('users', 'totpSecret', 'totp_secret');
		await renameCol('users', 'totpsecret', 'totp_secret');
		await renameCol('users', 'totpEnabled', 'totp_enabled');
		await renameCol('users', 'totpenabled', 'totp_enabled');
		await renameCol('users', 'totpRecoveryCodes', 'totp_recovery_codes');
		await renameCol('users', 'totprecoverycodes', 'totp_recovery_codes');
		await renameCol('users', 'totpConfirmedAt', 'totp_confirmed_at');
		await renameCol('users', 'totpconfirmedat', 'totp_confirmed_at');
		await renameCol('users', 'totpSonAdim', 'totp_last_step');
		await renameCol('users', 'totpsonadim', 'totp_last_step');
		await renameCol('users', 'oturumBitis', 'session_expires_at');
		await renameCol('users', 'oturumbitis', 'session_expires_at');
		await renameCol('users', 'postaEposta', 'mail_notifications_enabled');
		await renameCol('users', 'postaeposta', 'mail_notifications_enabled');
		await renameCol('users', 'olusturma', 'created_at');

		// Safely rename columns in system_settings
		await renameCol('system_settings', 'anahtar', 'key');
		await renameCol('system_settings', 'deger', 'value');
		await renameCol('system_settings', 'guncellenme', 'updated_at');

		// Safely rename columns in security_blocks
		await renameCol('security_blocks', 'status', 'status');
		await renameCol('security_blocks', 'neden', 'reason');
		await renameCol('security_blocks', 'tehditPuani', 'threat_score');
		await renameCol('security_blocks', 'tehditpuani', 'threat_score');
		await renameCol('security_blocks', 'ihlaller', 'violations');
		await renameCol('security_blocks', 'olusturanId', 'creator_id');
		await renameCol('security_blocks', 'olusturanid', 'creator_id');
		await renameCol('security_blocks', 'expiresAt', 'expires_at');
		await renameCol('security_blocks', 'bitistarihi', 'expires_at');
		await renameCol('security_blocks', 'olusturma', 'created_at');
		await renameCol('security_blocks', 'guncellenme', 'updated_at');

		// Safely rename columns in system_logs
		await renameCol('system_logs', 'kullaniciId', 'userid');
		await renameCol('system_logs', 'kullaniciid', 'userid');

		// Safely rename columns in events
		await renameCol('events', 'bitis', 'endtime');

		// Safely rename columns in role_permissions
		await renameCol('role_permissions', 'rolId', 'roleid');
		await renameCol('role_permissions', 'rolid', 'roleid');

		// Drop all legacy compatibility views
		await client.query(`
			DROP VIEW IF EXISTS kullanicilar CASCADE;
			DROP VIEW IF EXISTS etkinlikler CASCADE;
			DROP VIEW IF EXISTS sistem_ayarlari CASCADE;
			DROP VIEW IF EXISTS guvenlik_engelleri CASCADE;
			DROP VIEW IF EXISTS eposta_dogrulama CASCADE;
			DROP VIEW IF EXISTS sistem_loglari CASCADE;
		`);
	});

	await runMigrationStep('2026_13_user_auth_method', 'Track whether the active session used a password, TOTP or a passkey', async () => {
		await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_method TEXT NOT NULL DEFAULT 'password'`);
	});

	await runMigrationStep('2026_14_customization_schema', 'Create legal documents, custom form fields and custom wallpapers', async () => {
		await client.query(`
			CREATE TABLE IF NOT EXISTS legal_documents (
				id TEXT PRIMARY KEY,
				doc_type TEXT UNIQUE NOT NULL,
				scope TEXT NOT NULL DEFAULT 'registration',
				title_tr TEXT NOT NULL,
				title_en TEXT NOT NULL,
				body_tr TEXT NOT NULL,
				body_en TEXT NOT NULL,
				required INTEGER NOT NULL DEFAULT 0,
				enabled INTEGER NOT NULL DEFAULT 1,
				sort_order INTEGER NOT NULL DEFAULT 0,
				updated_at BIGINT NOT NULL,
				updated_by TEXT
			);

			CREATE TABLE IF NOT EXISTS form_fields (
				id TEXT PRIMARY KEY,
				scope TEXT NOT NULL DEFAULT 'registration',
				field_key TEXT NOT NULL,
				type TEXT NOT NULL DEFAULT 'text',
				section TEXT NOT NULL DEFAULT 'custom',
				label_tr TEXT NOT NULL,
				label_en TEXT NOT NULL,
				placeholder_tr TEXT,
				placeholder_en TEXT,
				options TEXT NOT NULL DEFAULT '[]',
				required INTEGER NOT NULL DEFAULT 0,
				enabled INTEGER NOT NULL DEFAULT 1,
				sort_order INTEGER NOT NULL DEFAULT 0,
				created_at BIGINT NOT NULL,
				updated_at BIGINT NOT NULL,
				UNIQUE (scope, field_key)
			);

			CREATE TABLE IF NOT EXISTS member_field_values (
				user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				field_id TEXT NOT NULL REFERENCES form_fields(id) ON DELETE CASCADE,
				value TEXT NOT NULL,
				updated_at BIGINT NOT NULL,
				PRIMARY KEY (user_id, field_id)
			);

			CREATE TABLE IF NOT EXISTS custom_wallpapers (
				id TEXT PRIMARY KEY,
				title_tr TEXT NOT NULL,
				title_en TEXT NOT NULL,
				type TEXT NOT NULL DEFAULT 'custom',
				filename TEXT UNIQUE NOT NULL,
				mime TEXT NOT NULL,
				size INTEGER NOT NULL DEFAULT 0,
				created_by TEXT,
				created_at BIGINT NOT NULL,
				sort_order INTEGER NOT NULL DEFAULT 0
			);

			ALTER TABLE files ADD COLUMN IF NOT EXISTS sohbetOdaId TEXT;
		`);
	});


	await runMigrationStep('2026_15_editable_defaults', 'Seed defaults for editable registration and team settings', async () => {
		const defaults: Record<string, string> = {
			site_description_tr:
				'Tetha42 tarafından geliştirilen kendi sunucunuzda barındırılan topluluk işletim sistemi.',
			site_description_en: 'Self-hosted community operating system engineered by tetha42.',
			site_brand_version: 'default',
			registration_core_fields: JSON.stringify(DEFAULT_REGISTRATION_CORE_CONFIG),
			team_categories: JSON.stringify(DEFAULT_TEAM_CATEGORIES),
		};
		const now = Date.now();
		for (const [key, value] of Object.entries(defaults)) {
			await client.query(
				`INSERT INTO system_settings (key, value, updated_at)
				 VALUES ($1, $2, $3)
				 ON CONFLICT (key) DO NOTHING`,
				[key, value, now]
			);
		}
		// Existing installs may already have a community name but no short name.
		// Fresh installs do not have a name yet, so setup supplies this row itself.
		const community = await client.query(
			`SELECT value FROM system_settings WHERE key = 'kulup_adi' LIMIT 1`
		);
		const communityName = String(community.rows[0]?.value ?? '').trim();
		if (communityName) {
			await client.query(
				`INSERT INTO system_settings (key, value, updated_at)
				 VALUES ('site_short_name', $1, $2)
				 ON CONFLICT (key) DO NOTHING`,
				[communityName.slice(0, 24), now]
			);
		}
	});

	await runMigrationStep('2026_16_english_defaults', 'Translate seed roles, team categories and team roles to English', async () => {
		// These tables are created by ensureRoleSchema *after* schema migrations on a
		// brand-new database. Fresh seeds are already English, so only translate the
		// legacy rows when the tables are present.
		const relationExists = async (name: string) =>
			Boolean((await client.query(`SELECT to_regclass($1) AS name`, [`public.${name}`])).rows[0]?.name);
		const hasRoles = await relationExists('roles');
		const hasTeamMembers = await relationExists('team_members');
		const hasTeams = await relationExists('teams');
		const hasSettings = await relationExists('system_settings');
		// Only rename the known built-in role rows. Custom roles (and a role a
		// community already renamed itself) are left exactly as they are.
		if (hasRoles) {
		const roleRenames: Array<{ id: string; oldName: string; newName: string; oldDescription?: string; newDescription?: string }> = [
			{ id: 'rol_yonetim_kurulu', oldName: 'Yönetim Kurulu', newName: 'Management Board', oldDescription: 'Kulübün günlük yönetimi', newDescription: 'Daily operations of the community' },
			{ id: 'rol_uye', oldName: 'Üye', newName: 'Member', oldDescription: 'Aktif topluluk üyesi', newDescription: 'Active community member' },
			{ id: 'rol_mezun', oldName: 'Mezun', newName: 'Alumni', oldDescription: 'Mezun topluluk üyesi (salt okunur erişim).', newDescription: 'Alumni community member (read-only access).' },
		];
		for (const role of roleRenames) {
			await client.query(
				`UPDATE roles SET ad = $1
				 WHERE id = $2 AND ad = $3
				   AND NOT EXISTS (SELECT 1 FROM roles WHERE lower(ad) = lower($1) AND id <> $2)`,
				[role.newName, role.id, role.oldName]
			);
			if (role.oldDescription && role.newDescription) {
				await client.query(
					`UPDATE roles SET aciklama = $1 WHERE id = $2 AND aciklama = $3`,
					[role.newDescription, role.id, role.oldDescription]
				);
			}
		}
		await client.query(
			`UPDATE roles SET aciklama = 'Manages all applications. Cannot be changed.'
			 WHERE id = 'rol_admin' AND aciklama = 'Tüm uygulamaları yönetir. Değiştirilemez.'`
		);
		}

		// Team member titles created by the old seed/default.
		if (hasTeamMembers) {
			for (const [oldRole, newRole] of [
				['Takım Kaptanı', 'Team Captain'],
				['Geliştirici', 'Developer'],
				['Ar-Ge Üyesi', 'R&D Member'],
			] as const) {
				await client.query(`UPDATE team_members SET takimRolu = $1 WHERE takimRolu = $2`, [newRole, oldRole]);
			}
			await client.query(`ALTER TABLE team_members ALTER COLUMN takimRolu SET DEFAULT 'Developer'`);
		}

		// Existing teams and the saved category menu.
		if (hasTeams) {
			for (const [oldCategory, newCategory] of Object.entries(LEGACY_TEAM_CATEGORY_MAP)) {
				await client.query(`UPDATE teams SET kategori = $1 WHERE kategori = $2`, [newCategory, oldCategory]);
			}
		}
		if (hasSettings) {
		const stored = await client.query(`SELECT value FROM system_settings WHERE key = 'team_categories' LIMIT 1`);
		const rawCategories = stored.rows[0]?.value;
		if (typeof rawCategories === 'string' && rawCategories.trim()) {
			try {
				const parsed = JSON.parse(rawCategories);
				if (Array.isArray(parsed)) {
					const translated = parsed.map((value: unknown) =>
						typeof value === 'string' && LEGACY_TEAM_CATEGORY_MAP[value]
							? LEGACY_TEAM_CATEGORY_MAP[value]
							: value
					);
					if (JSON.stringify(translated) !== JSON.stringify(parsed)) {
						await client.query(
							`UPDATE system_settings SET value = $1, updated_at = $2 WHERE key = 'team_categories'`,
							[JSON.stringify(translated), Date.now()]
						);
					}
				}
			} catch {
				// Invalid JSON is left to the normalizer/fallback.
			}
		}
		}
	});

	await runMigrationStep('2026_17_legal_acceptance_evidence', 'Version legal documents and record immutable member consent evidence', async () => {
		await client.query(
			`ALTER TABLE legal_documents ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1`
		);
		await client.query(
			`CREATE TABLE IF NOT EXISTS legal_acceptances (
				id TEXT PRIMARY KEY,
				user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				document_id TEXT NOT NULL REFERENCES legal_documents(id) ON DELETE RESTRICT,
				document_version INTEGER NOT NULL,
				content_hash TEXT NOT NULL,
				accepted_at BIGINT NOT NULL,
				ip TEXT,
				user_agent TEXT,
				source TEXT NOT NULL DEFAULT 'registration',
				UNIQUE (user_id, document_id, document_version)
			)`
		);
		await client.query(
			`CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user ON legal_acceptances (user_id, accepted_at DESC)`
		);
		await client.query(
			`CREATE INDEX IF NOT EXISTS idx_legal_acceptances_document ON legal_acceptances (document_id, document_version)`
		);
	});

	await runMigrationStep('2026_18_member_field_policies', 'Separate where a custom field is collected, required, visible and editable', async () => {
		await client.query(`ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS collect_at TEXT NOT NULL DEFAULT 'registration'`);
		await client.query(`ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS required_at TEXT NOT NULL DEFAULT 'none'`);
		await client.query(`ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS directory_visibility TEXT NOT NULL DEFAULT 'hidden'`);
		await client.query(`ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS self_editable INTEGER NOT NULL DEFAULT 0`);
		await client.query(`ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS admin_editable INTEGER NOT NULL DEFAULT 1`);
		await client.query(`ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS archived_at BIGINT`);

		// Backfill the legacy `scope`/`required` pair without changing behaviour.
		await client.query(`
			UPDATE form_fields SET
				collect_at = CASE scope WHEN 'member' THEN 'admin' ELSE scope END,
				required_at = CASE
					WHEN required = 1 AND scope = 'registration' THEN 'registration'
					WHEN required = 1 AND scope = 'member' THEN 'admin'
					WHEN required = 1 AND scope = 'both' THEN 'both'
					ELSE 'none'
				END,
				directory_visibility = CASE scope WHEN 'registration' THEN 'hidden' ELSE 'members' END,
				self_editable = CASE scope WHEN 'both' THEN 1 ELSE 0 END,
				admin_editable = 1
		`);
		await client.query(`CREATE INDEX IF NOT EXISTS idx_form_fields_collect ON form_fields (collect_at, archived_at)`);
	});

	await runMigrationStep('2026_19_email_change_requests', 'Add verified self-service e-mail change requests', async () => {
		await client.query(
			`CREATE TABLE IF NOT EXISTS email_change_requests (
				id TEXT PRIMARY KEY,
				user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				new_email TEXT NOT NULL,
				code_hash TEXT NOT NULL,
				attempts INTEGER NOT NULL DEFAULT 0,
				expires_at BIGINT NOT NULL,
				created_at BIGINT NOT NULL,
				requested_ip TEXT,
				user_agent TEXT,
				used_at BIGINT
			)`
		);
		await client.query(
			`CREATE UNIQUE INDEX IF NOT EXISTS idx_email_change_open
			 ON email_change_requests (user_id) WHERE used_at IS NULL`
		);
		await client.query(
			`CREATE INDEX IF NOT EXISTS idx_email_change_expiry ON email_change_requests (expires_at) WHERE used_at IS NULL`
		);
		await client.query(
			`CREATE INDEX IF NOT EXISTS idx_email_change_requests_user_id ON email_change_requests (user_id)`
		);
	});

	await runMigrationStep('2026_20_email_verified_at', 'Track when the current e-mail address was verified', async () => {
		await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at BIGINT`);
	});

	await runMigrationStep('2026_21_membership_lifecycle', 'Add membership applications, invitations and policy', async () => {
		await client.query(
			`CREATE TABLE IF NOT EXISTS membership_applications (
				id TEXT PRIMARY KEY,
				user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				source TEXT NOT NULL DEFAULT 'self',
				status TEXT NOT NULL DEFAULT 'pending_review',
				snapshot TEXT NOT NULL DEFAULT '{}',
				invitation_id TEXT,
				submitted_at BIGINT NOT NULL,
				email_verified_at BIGINT,
				reviewed_by TEXT,
				reviewed_at BIGINT,
				rejection_reason TEXT,
				created_at BIGINT NOT NULL
			)`
		);
		await client.query(
			`CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_application_open
			 ON membership_applications (user_id)
			 WHERE status IN ('submitted', 'email_verified', 'pending_review')`
		);
		await client.query(
			`CREATE INDEX IF NOT EXISTS idx_membership_application_status
			 ON membership_applications (status, submitted_at)`
		);
		await client.query(
			`CREATE INDEX IF NOT EXISTS idx_membership_applications_user_id
			 ON membership_applications (user_id)`
		);

		await client.query(
			`CREATE TABLE IF NOT EXISTS invitations (
				id TEXT PRIMARY KEY,
				token_hash TEXT UNIQUE NOT NULL,
				email TEXT,
				role_id TEXT,
				team_id TEXT,
				note TEXT,
				created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
				expires_at BIGINT NOT NULL,
				used_at BIGINT,
				used_by TEXT REFERENCES users(id) ON DELETE SET NULL,
				created_at BIGINT NOT NULL
			)`
		);
		await client.query(
			`CREATE INDEX IF NOT EXISTS idx_invitations_open ON invitations (expires_at) WHERE used_at IS NULL`
		);

		await client.query(
			`INSERT INTO system_settings (key, value, updated_at)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (key) DO NOTHING`,
			[MEMBERSHIP_POLICY_SETTINGS_KEY, JSON.stringify(DEFAULT_MEMBERSHIP_POLICY), Date.now()]
		);
	});

	await runMigrationStep('2026_22_application_reapply_link', 'Link a re-application to the rejected application it follows', async () => {
		await client.query(
			`ALTER TABLE membership_applications
			 ADD COLUMN IF NOT EXISTS reapply_of TEXT REFERENCES membership_applications(id) ON DELETE SET NULL`
		);
	});

	await runMigrationStep('2026_23_committees', 'Separate committees from working groups and link meetings and decisions', async () => {
		await client.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'working_group'`);
		await client.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS quorum INTEGER NOT NULL DEFAULT 0`);
		await client.query(`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS voting_right INTEGER NOT NULL DEFAULT 0`);
		await client.query(`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS term_start BIGINT`);
		await client.query(`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS term_end BIGINT`);
		await client.query(
			`CREATE TABLE IF NOT EXISTS committee_meetings (
				id TEXT PRIMARY KEY,
				committee_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
				title TEXT NOT NULL,
				date BIGINT NOT NULL,
				agenda TEXT NOT NULL DEFAULT '',
				minutes TEXT NOT NULL DEFAULT '',
				status TEXT NOT NULL DEFAULT 'planned',
				created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
				created_at BIGINT NOT NULL,
				updated_at BIGINT NOT NULL
			)`
		);
		await client.query(
			`CREATE INDEX IF NOT EXISTS idx_committee_meetings_body ON committee_meetings (committee_id, date DESC)`
		);
		await client.query(`ALTER TABLE decisions ADD COLUMN IF NOT EXISTS body_id TEXT REFERENCES teams(id) ON DELETE SET NULL`);
		await client.query(`ALTER TABLE decisions ADD COLUMN IF NOT EXISTS decision_type TEXT NOT NULL DEFAULT 'resolution'`);
		await client.query(`ALTER TABLE decisions ADD COLUMN IF NOT EXISTS quorum_met INTEGER NOT NULL DEFAULT 0`);
		await client.query(`ALTER TABLE decisions ADD COLUMN IF NOT EXISTS votes_for INTEGER NOT NULL DEFAULT 0`);
		await client.query(`ALTER TABLE decisions ADD COLUMN IF NOT EXISTS votes_against INTEGER NOT NULL DEFAULT 0`);
		await client.query(`ALTER TABLE decisions ADD COLUMN IF NOT EXISTS votes_abstain INTEGER NOT NULL DEFAULT 0`);
		await client.query(`ALTER TABLE decisions ADD COLUMN IF NOT EXISTS published_at BIGINT`);
		await client.query(`CREATE INDEX IF NOT EXISTS idx_decisions_body ON decisions (body_id, date DESC)`);
		// The legacy compatibility views were created with an explicit column list;
		// Drop legacy compatibility views if any
		await client.query(`DROP VIEW IF EXISTS takimlar CASCADE`);
		await client.query(`DROP VIEW IF EXISTS takim_uyeleri CASCADE`);
		await client.query(`DROP VIEW IF EXISTS tutanaklar_kararlar CASCADE`);
	});

	await runMigrationStep('2026_24_project_event_ownership', 'Separate created_by from the owning team and owner user', async () => {
		for (const table of ['projects', 'events']) {
			await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS owner_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL`);
			await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL`);
			await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id) ON DELETE SET NULL`);
		}
		await client.query(`UPDATE projects SET
			owner_team_id = COALESCE(owner_team_id, teamId),
			owner_user_id = COALESCE(owner_user_id, olusturanId),
			created_by = COALESCE(created_by, olusturanId)`);
		await client.query(`UPDATE events SET
			owner_user_id = COALESCE(owner_user_id, olusturanId),
			created_by = COALESCE(created_by, olusturanId)`);
		await client.query(`CREATE INDEX IF NOT EXISTS idx_projects_owner_team ON projects (owner_team_id)`);
		await client.query(`CREATE INDEX IF NOT EXISTS idx_projects_owner_user ON projects (owner_user_id)`);
		await client.query(`CREATE INDEX IF NOT EXISTS idx_events_owner_team ON events (owner_team_id)`);
		await client.query(`CREATE INDEX IF NOT EXISTS idx_events_owner_user ON events (owner_user_id)`);
		await client.query(`DROP VIEW IF EXISTS projeler CASCADE`);
		await client.query(`DROP VIEW IF EXISTS etkinlikler CASCADE`);
	});

	await runMigrationStep('2026_25_legal_document_versions', 'Archive every legal document version for an auditable history', async () => {
		await client.query(
			`CREATE TABLE IF NOT EXISTS legal_document_versions (
				id TEXT PRIMARY KEY,
				document_id TEXT NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
				doc_type TEXT NOT NULL,
				version INTEGER NOT NULL,
				scope TEXT NOT NULL,
				title_tr TEXT NOT NULL,
				title_en TEXT NOT NULL,
				body_tr TEXT NOT NULL,
				body_en TEXT NOT NULL,
				required INTEGER NOT NULL DEFAULT 0,
				content_hash TEXT NOT NULL,
				archived_at BIGINT NOT NULL,
				archived_by TEXT REFERENCES users(id) ON DELETE SET NULL,
				UNIQUE (document_id, version)
			)`
		);
		await client.query(
			`CREATE INDEX IF NOT EXISTS idx_legal_versions_doc ON legal_document_versions (document_id, version DESC)`
		);
	});

	await runMigrationStep('2026_26_mail_outbox', 'Queue transactional e-mail for admin approval when SMTP is unavailable', async () => {
		await client.query(
			`CREATE TABLE IF NOT EXISTS mail_outbox (
				id TEXT PRIMARY KEY,
				kind TEXT NOT NULL,
				recipient TEXT NOT NULL,
				subject TEXT NOT NULL,
				payload TEXT NOT NULL DEFAULT '',
				status TEXT NOT NULL DEFAULT 'pending',
				target_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
				requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
				error TEXT,
				attempts INTEGER NOT NULL DEFAULT 0,
				created_at BIGINT NOT NULL,
				approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
				approved_at BIGINT,
				sent_at BIGINT
			)`
		);
		await client.query(
			`CREATE INDEX IF NOT EXISTS idx_mail_outbox_status ON mail_outbox (status, created_at DESC)`
		);
	});

	await runMigrationStep('2026_27_drop_legacy_kullanicilar_view', 'Drop legacy kullanicilar view now that all repos use users directly', async () => {
		await client.query(`DROP VIEW IF EXISTS kullanicilar CASCADE`);
	});

	await runMigrationStep('2026_28_normalize_user_tables', 'Decompose users table into accounts, memberships, profiles with auto-synchronization triggers', async () => {
		// 1. Create normalized accounts table
		await client.query(`
			CREATE TABLE IF NOT EXISTS accounts (
				id TEXT PRIMARY KEY,
				email TEXT UNIQUE NOT NULL,
				password_hash TEXT,
				totp_secret TEXT,
				totp_enabled INTEGER NOT NULL DEFAULT 0,
				totp_recovery_codes TEXT,
				totp_confirmed_at BIGINT,
				totp_last_step BIGINT,
				session_token TEXT,
				session_expires_at BIGINT,
				auth_method TEXT NOT NULL DEFAULT 'password',
				last_login_at BIGINT,
				last_login_ip TEXT,
				last_login_user_agent TEXT,
				last_active_at BIGINT,
				last_active_ip TEXT,
				created_at BIGINT NOT NULL
			);
			CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts (email);
			CREATE INDEX IF NOT EXISTS idx_accounts_session ON accounts (session_token);
		`);

		// 2. Create normalized memberships table
		await client.query(`
			CREATE TABLE IF NOT EXISTS memberships (
				id TEXT PRIMARY KEY,
				user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
				role_id TEXT REFERENCES roles(id) ON DELETE SET NULL,
				status TEXT NOT NULL DEFAULT 'beklemede',
				department TEXT,
				grade TEXT,
				handle TEXT,
				mail_notifications_enabled INTEGER NOT NULL DEFAULT 1,
				created_at BIGINT NOT NULL,
				UNIQUE (user_id)
			);
			CREATE INDEX IF NOT EXISTS idx_memberships_role ON memberships (role_id);
			CREATE INDEX IF NOT EXISTS idx_memberships_status ON memberships (status);
		`);

		// 3. Create normalized profiles table
		await client.query(`
			CREATE TABLE IF NOT EXISTS profiles (
				id TEXT PRIMARY KEY,
				user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
				first_name TEXT NOT NULL,
				last_name TEXT NOT NULL,
				avatar_url TEXT,
				bio TEXT,
				contact_info JSONB,
				created_at BIGINT NOT NULL,
				UNIQUE (user_id)
			);
		`);

		// 4. Backfill from users table if accounts table is empty
		await client.query(`
			INSERT INTO accounts (id, email, password_hash, totp_secret, totp_enabled, totp_recovery_codes, totp_confirmed_at, totp_last_step, session_token, session_expires_at, auth_method, last_login_at, last_login_ip, last_login_user_agent, last_active_at, last_active_ip, created_at)
			SELECT id, email, password_hash, totp_secret, COALESCE(totp_enabled, 0), totp_recovery_codes, totp_confirmed_at, totp_last_step, session_token, session_expires_at, COALESCE(auth_method, 'password'), last_login_at, last_login_ip, last_login_user_agent, last_active_at, last_active_ip, COALESCE(created_at, (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint)
			FROM users
			ON CONFLICT (id) DO NOTHING;

			INSERT INTO memberships (id, user_id, role_id, status, department, grade, handle, mail_notifications_enabled, created_at)
			SELECT id, id, role_id, COALESCE(status, 'beklemede'), department, grade, handle, COALESCE(mail_notifications_enabled, 1), COALESCE(created_at, (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint)
			FROM users
			ON CONFLICT (user_id) DO NOTHING;

			INSERT INTO profiles (id, user_id, first_name, last_name, avatar_url, bio, contact_info, created_at)
			SELECT id, id, COALESCE(first_name, ''), COALESCE(last_name, ''), avatar_url, NULL, '{}'::jsonb, COALESCE(created_at, (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint)
			FROM users
			ON CONFLICT (user_id) DO NOTHING;
		`);

		// 5. Create real-time sync trigger from users to accounts/memberships/profiles
		await client.query(`
			CREATE OR REPLACE FUNCTION sync_users_to_normalized() RETURNS TRIGGER AS $$
			BEGIN
				IF (TG_OP = 'INSERT') THEN
					INSERT INTO accounts (id, email, password_hash, totp_secret, totp_enabled, totp_recovery_codes, totp_confirmed_at, totp_last_step, session_token, session_expires_at, auth_method, last_login_at, last_login_ip, last_login_user_agent, last_active_at, last_active_ip, created_at)
					VALUES (NEW.id, NEW.email, NEW.password_hash, NEW.totp_secret, COALESCE(NEW.totp_enabled, 0), NEW.totp_recovery_codes, NEW.totp_confirmed_at, NEW.totp_last_step, NEW.session_token, NEW.session_expires_at, COALESCE(NEW.auth_method, 'password'), NEW.last_login_at, NEW.last_login_ip, NEW.last_login_user_agent, NEW.last_active_at, NEW.last_active_ip, COALESCE(NEW.created_at, (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint))
					ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash, totp_secret = EXCLUDED.totp_secret, totp_enabled = EXCLUDED.totp_enabled, session_token = EXCLUDED.session_token, session_expires_at = EXCLUDED.session_expires_at, auth_method = EXCLUDED.auth_method, last_login_at = EXCLUDED.last_login_at, last_active_at = EXCLUDED.last_active_at;

					INSERT INTO memberships (id, user_id, role_id, status, department, grade, handle, mail_notifications_enabled, created_at)
					VALUES (NEW.id, NEW.id, NEW.role_id, COALESCE(NEW.status, 'beklemede'), NEW.department, NEW.grade, NEW.handle, COALESCE(NEW.mail_notifications_enabled, 1), COALESCE(NEW.created_at, (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint))
					ON CONFLICT (user_id) DO UPDATE SET role_id = EXCLUDED.role_id, status = EXCLUDED.status, department = EXCLUDED.department, grade = EXCLUDED.grade, handle = EXCLUDED.handle, mail_notifications_enabled = EXCLUDED.mail_notifications_enabled;

					INSERT INTO profiles (id, user_id, first_name, last_name, avatar_url, created_at)
					VALUES (NEW.id, NEW.id, COALESCE(NEW.first_name, ''), COALESCE(NEW.last_name, ''), NEW.avatar_url, COALESCE(NEW.created_at, (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint))
					ON CONFLICT (user_id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, avatar_url = EXCLUDED.avatar_url;

					RETURN NEW;
				ELSIF (TG_OP = 'UPDATE') THEN
					UPDATE accounts SET email = NEW.email, password_hash = NEW.password_hash, totp_secret = NEW.totp_secret, totp_enabled = COALESCE(NEW.totp_enabled, 0), totp_recovery_codes = NEW.totp_recovery_codes, totp_confirmed_at = NEW.totp_confirmed_at, totp_last_step = NEW.totp_last_step, session_token = NEW.session_token, session_expires_at = NEW.session_expires_at, auth_method = COALESCE(NEW.auth_method, 'password'), last_login_at = NEW.last_login_at, last_login_ip = NEW.last_login_ip, last_login_user_agent = NEW.last_login_user_agent, last_active_at = NEW.last_active_at, last_active_ip = NEW.last_active_ip WHERE id = NEW.id;

					UPDATE memberships SET role_id = NEW.role_id, status = COALESCE(NEW.status, 'beklemede'), department = NEW.department, grade = NEW.grade, handle = NEW.handle, mail_notifications_enabled = COALESCE(NEW.mail_notifications_enabled, 1) WHERE user_id = NEW.id;

					UPDATE profiles SET first_name = COALESCE(NEW.first_name, ''), last_name = COALESCE(NEW.last_name, ''), avatar_url = NEW.avatar_url WHERE user_id = NEW.id;

					RETURN NEW;
				ELSIF (TG_OP = 'DELETE') THEN
					DELETE FROM accounts WHERE id = OLD.id;
					RETURN OLD;
				END IF;
				RETURN NULL;
			END;
			$$ LANGUAGE plpgsql;

			DROP TRIGGER IF EXISTS trg_sync_users_to_normalized ON users;
			CREATE TRIGGER trg_sync_users_to_normalized AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION sync_users_to_normalized();
		`);
	});

	await runMigrationStep('2026_29_drop_all_compatibility_views', 'Drop all legacy SQL compatibility views across all domains', async () => {
		await client.query(`
			DROP VIEW IF EXISTS takimlar CASCADE;
			DROP VIEW IF EXISTS takim_uyeleri CASCADE;
			DROP VIEW IF EXISTS takim_basvuru_kararlari CASCADE;
			DROP VIEW IF EXISTS takim_gorevleri CASCADE;
			DROP VIEW IF EXISTS takim_gorev_maddeleri CASCADE;
			DROP VIEW IF EXISTS takim_gorev_yorumlari CASCADE;
			DROP VIEW IF EXISTS takim_gorev_aktivite CASCADE;
			DROP VIEW IF EXISTS etkinlikler CASCADE;
			DROP VIEW IF EXISTS etkinlik_kayitlari CASCADE;
			DROP VIEW IF EXISTS yoklamalar CASCADE;
			DROP VIEW IF EXISTS butce_kayitlari CASCADE;
			DROP VIEW IF EXISTS dosyalar CASCADE;
			DROP VIEW IF EXISTS tutanaklar_kararlar CASCADE;
			DROP VIEW IF EXISTS haberler CASCADE;
			DROP VIEW IF EXISTS sertifikalar CASCADE;
			DROP VIEW IF EXISTS envanter CASCADE;
			DROP VIEW IF EXISTS envanter_hareketleri CASCADE;
			DROP VIEW IF EXISTS kullanici_notlari CASCADE;
			DROP VIEW IF EXISTS kullanici_not_klasorleri CASCADE;
			DROP VIEW IF EXISTS sistem_ayarlari CASCADE;
			DROP VIEW IF EXISTS sohbet_odalari CASCADE;
			DROP VIEW IF EXISTS sohbet_mesajlari CASCADE;
			DROP VIEW IF EXISTS sohbet_uyeleri CASCADE;
			DROP VIEW IF EXISTS eposta_dogrulama CASCADE;
			DROP VIEW IF EXISTS sistem_loglari CASCADE;
			DROP VIEW IF EXISTS projeler CASCADE;
			DROP VIEW IF EXISTS proje_begenileri CASCADE;
			DROP VIEW IF EXISTS sohbet_anketleri CASCADE;
			DROP VIEW IF EXISTS sohbet_anket_secenekleri CASCADE;
			DROP VIEW IF EXISTS sohbet_anket_oylari CASCADE;
			DROP VIEW IF EXISTS guvenlik_engelleri CASCADE;
		`);
	});

	await runMigrationStep('2026_30_user_workspace_preferences', 'Create user workspace preferences table for cross-device desktop state synchronization', async () => {
		await client.query(`
			CREATE TABLE IF NOT EXISTS user_workspace_preferences (
				user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
				state JSONB NOT NULL DEFAULT '{}'::jsonb,
				updated_at BIGINT NOT NULL
			);
			CREATE INDEX IF NOT EXISTS idx_workspace_pref_updated_at ON user_workspace_preferences(updated_at DESC);
		`);
	});

	await runMigrationStep('2026_31_index_unindexed_foreign_keys', 'Create indexes for unindexed foreign keys to prevent sequential scans', async () => {
		const fkIndexes: [string, string, string][] = [
			['attendances', 'kaydedenid', 'idx_attendances_kaydedenid'],
			['attendances', 'userid', 'idx_attendances_userid'],
			['budget_records', 'guncelleyenid', 'idx_budget_records_guncelleyenid'],
			['budget_records', 'kaydedenid', 'idx_budget_records_kaydedenid'],
			['certificates', 'etkinlikid', 'idx_certificates_etkinlikid'],
			['certificates', 'userid', 'idx_certificates_userid'],
			['chat_members', 'userid', 'idx_chat_members_userid'],
			['chat_messages', 'gonderenid', 'idx_chat_messages_gonderenid'],
			['chat_poll_votes', 'secenekid', 'idx_chat_poll_votes_secenekid'],
			['chat_polls', 'olusturanid', 'idx_chat_polls_olusturanid'],
			['committee_meetings', 'created_by', 'idx_committee_meetings_created_by'],
			['decisions', 'olusturanid', 'idx_decisions_olusturanid'],
			['email_change_requests', 'user_id', 'idx_email_change_requests_user_id'],
			['event_registrations', 'userid', 'idx_event_registrations_userid'],
			['events', 'created_by', 'idx_events_created_by'],
			['events', 'olusturanid', 'idx_events_olusturanid'],
			['files', 'yukleyenid', 'idx_files_yukleyenid'],
			['inventory', 'oduncalanid', 'idx_inventory_oduncalanid'],
			['inventory_activities', 'aktorid', 'idx_inventory_activities_aktorid'],
			['inventory_activities', 'userid', 'idx_inventory_activities_userid'],
			['invitations', 'created_by', 'idx_invitations_created_by'],
			['invitations', 'used_by', 'idx_invitations_used_by'],
			['legal_document_versions', 'archived_by', 'idx_legal_document_versions_archived_by'],
			['mail_messages', 'gonderenid', 'idx_mail_messages_gonderenid'],
			['mail_outbox', 'approved_by', 'idx_mail_outbox_approved_by'],
			['mail_outbox', 'requested_by', 'idx_mail_outbox_requested_by'],
			['mail_outbox', 'target_user_id', 'idx_mail_outbox_target_user_id'],
			['mail_threads', 'olusturanid', 'idx_mail_threads_olusturanid'],
			['member_field_values', 'field_id', 'idx_member_field_values_field_id'],
			['membership_applications', 'reapply_of', 'idx_membership_applications_reapply_of'],
			['membership_applications', 'user_id', 'idx_membership_applications_user_id'],
			['news', 'yazarid', 'idx_news_yazarid'],
			['oauth_auth_codes', 'userid', 'idx_oauth_auth_codes_userid'],
			['oauth_clients', 'olusturanid', 'idx_oauth_clients_olusturanid'],
			['oauth_consents', 'clientid', 'idx_oauth_consents_clientid'],
			['project_likes', 'userid', 'idx_project_likes_userid'],
			['projects', 'created_by', 'idx_projects_created_by'],
			['projects', 'olusturanid', 'idx_projects_olusturanid'],
			['projects', 'teamid', 'idx_projects_teamid'],
			['team_application_decisions', 'userid', 'idx_team_application_decisions_userid'],
			['team_members', 'userid', 'idx_team_members_userid'],
			['team_task_activities', 'aktorid', 'idx_team_task_activities_aktorid'],
			['team_task_comments', 'userid', 'idx_team_task_comments_userid'],
			['team_tasks', 'atananuyeid', 'idx_team_tasks_atananuyeid'],
			['team_tasks', 'olusturanid', 'idx_team_tasks_olusturanid'],
			['team_tasks', 'teamid', 'idx_team_tasks_teamid'],
			['teams', 'liderid', 'idx_teams_liderid'],
			['users', 'role_id', 'idx_users_role_id'],
		];

		for (const [table, column, indexName] of fkIndexes) {
			try {
				const tbl = await client.query(
					`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
					[table]
				);
				if ((tbl.rowCount ?? 0) === 0) continue;

				const col = await client.query(
					`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND lower(column_name) = $2`,
					[table, column.toLowerCase()]
				);
				if ((col.rowCount ?? 0) === 0 || !col.rows[0]?.column_name) continue;

				const actualCol = col.rows[0].column_name;
				await client.query(`CREATE INDEX IF NOT EXISTS "${indexName}" ON "${table}" ("${actualCol}")`);
			} catch (err: unknown) {
				console.warn(`[Migration 2026_31] Failed indexing ${table}.${column}:`, errorMessage(err));
			}
		}
	});

	await runMigrationStep('2026_32_index_fk_completeness', 'Create full indexes for lifecycle foreign keys and roles to eliminate partial-index seq scan hazards', async () => {
		await client.query(`
			CREATE INDEX IF NOT EXISTS idx_email_change_requests_user_id ON email_change_requests (user_id);
			CREATE INDEX IF NOT EXISTS idx_membership_applications_user_id ON membership_applications (user_id);
			CREATE INDEX IF NOT EXISTS idx_users_role_id ON users (role_id);
		`);
	});

	await runMigrationStep('2026_33_user_preferred_language', 'Add preferred_language to users table for bilingual notifications', async () => {
		await client.query(`
			ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'tr';
		`);
	});
}

