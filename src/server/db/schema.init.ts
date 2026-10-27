import type { PoolClient } from 'pg';
import { errorMessage } from '@/lib/errors';
import { slugify, uniqueSlug } from '@/lib/text';

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
			mail_notifications_enabled INTEGER NOT NULL DEFAULT 0,
			role_id TEXT,
			created_at BIGINT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_users_session_token ON users (session_token);

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
			takimRolu TEXT NOT NULL DEFAULT 'Geliştirici',
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

		-- Backwards-compatible updatable views for legacy Turkish names
		DROP VIEW IF EXISTS kullanicilar CASCADE;
		CREATE VIEW kullanicilar AS
		SELECT id,
		       first_name AS ad,
		       first_name,
		       last_name AS soyad,
		       last_name,
		       email AS email,
		       password_hash AS sifrehash,
		       password_hash,
		       handle AS ogrencino,
		       handle,
		       department AS bolum,
		       department,
		       grade AS sinif,
		       grade,
		       role_id AS rolid,
		       role_id AS roleid,
		       role_id,
		       avatar_url AS profilfoto,
		       avatar_url,
		       bio,
		       xp,
		       status AS status,
		       session_token AS aktifoturumtoken,
		       session_token,
		       last_login_at AS songiristarihi,
		       last_login_at,
		       last_login_ip AS songirisip,
		       last_login_ip,
		       last_login_user_agent AS songirisuseragent,
		       last_login_user_agent,
		       last_active_ip AS sonaktifip,
		       last_active_ip,
		       last_active_at AS sonaktiftarihi,
		       last_active_at,
		       totp_secret AS totpsecret,
		       totp_secret,
		       totp_enabled AS totpenabled,
		       totp_enabled,
		       totp_recovery_codes AS totprecoverycodes,
		       totp_recovery_codes,
		       totp_confirmed_at AS totpconfirmedat,
		       totp_confirmed_at,
		       totp_last_step AS totpsonadim,
		       totp_last_step,
		       session_expires_at AS oturumbitis,
		       session_expires_at,
		       mail_notifications_enabled AS postaeposta,
		       mail_notifications_enabled,
		       created_at AS olusturma,
		       created_at
		FROM users;

		DROP VIEW IF EXISTS takimlar CASCADE; CREATE VIEW takimlar AS SELECT * FROM teams;
		DROP VIEW IF EXISTS takim_uyeleri CASCADE; CREATE VIEW takim_uyeleri AS SELECT * FROM team_members;
		DROP VIEW IF EXISTS takim_basvuru_kararlari CASCADE; CREATE VIEW takim_basvuru_kararlari AS SELECT * FROM team_application_decisions;
		DROP VIEW IF EXISTS takim_gorevleri CASCADE; CREATE VIEW takim_gorevleri AS SELECT * FROM team_tasks;
		DROP VIEW IF EXISTS takim_gorev_maddeleri CASCADE; CREATE VIEW takim_gorev_maddeleri AS SELECT * FROM team_task_items;
		DROP VIEW IF EXISTS takim_gorev_yorumlari CASCADE; CREATE VIEW takim_gorev_yorumlari AS SELECT * FROM team_task_comments;
		DROP VIEW IF EXISTS takim_gorev_aktivite CASCADE; CREATE VIEW takim_gorev_aktivite AS SELECT * FROM team_task_activities;
		DROP VIEW IF EXISTS etkinlikler CASCADE; CREATE VIEW etkinlikler AS SELECT *, endtime AS bitis FROM events;
		DROP VIEW IF EXISTS etkinlik_kayitlari CASCADE; CREATE VIEW etkinlik_kayitlari AS SELECT * FROM event_registrations;
		DROP VIEW IF EXISTS yoklamalar CASCADE; CREATE VIEW yoklamalar AS SELECT * FROM attendances;
		DROP VIEW IF EXISTS butce_kayitlari CASCADE; CREATE VIEW butce_kayitlari AS SELECT * FROM budget_records;
		DROP VIEW IF EXISTS dosyalar CASCADE; CREATE VIEW dosyalar AS SELECT * FROM files;
		DROP VIEW IF EXISTS tutanaklar_kararlar CASCADE; CREATE VIEW tutanaklar_kararlar AS SELECT * FROM decisions;
		DROP VIEW IF EXISTS haberler CASCADE; CREATE VIEW haberler AS SELECT * FROM news;
		DROP VIEW IF EXISTS sertifikalar CASCADE; CREATE VIEW sertifikalar AS SELECT * FROM certificates;
		DROP VIEW IF EXISTS envanter CASCADE; CREATE VIEW envanter AS SELECT * FROM inventory;
		DROP VIEW IF EXISTS envanter_hareketleri CASCADE; CREATE VIEW envanter_hareketleri AS SELECT * FROM inventory_activities;
		DROP VIEW IF EXISTS kullanici_notlari CASCADE; CREATE VIEW kullanici_notlari AS SELECT * FROM user_notes;
		DROP VIEW IF EXISTS kullanici_not_klasorleri CASCADE; CREATE VIEW kullanici_not_klasorleri AS SELECT * FROM user_note_folders;
		DROP VIEW IF EXISTS sistem_ayarlari CASCADE;
		CREATE VIEW sistem_ayarlari AS SELECT key AS anahtar, value AS deger, updated_at AS guncellenme FROM system_settings;
		DROP VIEW IF EXISTS sohbet_odalari CASCADE; CREATE VIEW sohbet_odalari AS SELECT * FROM chat_rooms;
		DROP VIEW IF EXISTS sohbet_mesajlari CASCADE; CREATE VIEW sohbet_mesajlari AS SELECT * FROM chat_messages;
		DROP VIEW IF EXISTS sohbet_uyeleri CASCADE; CREATE VIEW sohbet_uyeleri AS SELECT * FROM chat_members;
		DROP VIEW IF EXISTS eposta_dogrulama CASCADE;
		CREATE VIEW eposta_dogrulama AS
		SELECT email AS email, code AS kod, type AS tur, expires_at AS songecerlilik, created_at AS olusturma
		FROM email_verifications;
		DROP VIEW IF EXISTS sistem_loglari CASCADE;
		CREATE VIEW sistem_loglari AS SELECT * FROM system_logs;
		DROP VIEW IF EXISTS projeler CASCADE; CREATE VIEW projeler AS SELECT * FROM projects;
		DROP VIEW IF EXISTS proje_begenileri CASCADE; CREATE VIEW proje_begenileri AS SELECT * FROM project_likes;
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
		await client.query(`UPDATE kullanicilar SET profilFoto = NULL WHERE profilFoto LIKE '/purus-profile/%'`);
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
			await client.query(`UPDATE takim_gorevleri SET xpVerildi = 1 WHERE status = 'tamamlandi'`);
		});
	}

	await runMigrationStep('2026_05_takim_gorevleri_sira', 'Backfill task ordering and timestamps', async () => {
		await client.query(
			`UPDATE takim_gorevleri
			 SET sira = COALESCE(sira, -olusturma),
			     guncellenme = COALESCE(guncellenme, olusturma),
			     tamamlanma = CASE WHEN status = 'tamamlandi' THEN COALESCE(tamamlanma, olusturma) ELSE tamamlanma END
			 WHERE sira IS NULL OR guncellenme IS NULL`
		);
	});

	await runMigrationStep('2026_06_etkinlik_kayitlari', 'Migrate attendance to registrations', async () => {
		await client.query(
			`INSERT INTO etkinlik_kayitlari (etkinlikId, userId, olusturma)
			 SELECT etkinlikId, userId, katilimZamani FROM yoklamalar
			 WHERE yontem NOT IN ('qr', 'bilet', 'manuel')
			 ON CONFLICT DO NOTHING`
		);
		await client.query(`DELETE FROM yoklamalar WHERE yontem NOT IN ('qr', 'bilet', 'manuel')`);
	});

	await runMigrationStep('2026_07_sertifikalar_bigint', 'Cast certificate timestamps to BIGINT', async () => {
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

			DROP VIEW IF EXISTS sohbet_anketleri CASCADE; CREATE VIEW sohbet_anketleri AS SELECT * FROM chat_polls;
			DROP VIEW IF EXISTS sohbet_anket_secenekleri CASCADE; CREATE VIEW sohbet_anket_secenekleri AS SELECT * FROM chat_poll_options;
			DROP VIEW IF EXISTS sohbet_anket_oylari CASCADE; CREATE VIEW sohbet_anket_oylari AS SELECT * FROM chat_poll_votes;
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
			CREATE VIEW guvenlik_engelleri AS
			SELECT ip, status AS status, reason AS neden, threat_score AS tehditpuani,
			       violations AS ihlaller, creator_id AS olusturanid,
			       expires_at AS bitistarihi, created_at AS olusturma, updated_at AS guncellenme
			FROM security_blocks;
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

		// Create backwards-compatible updatable views for legacy queries
		await client.query(`
			DROP VIEW IF EXISTS kullanicilar CASCADE;
			CREATE VIEW kullanicilar AS
			SELECT id,
			       first_name AS ad,
			       first_name,
			       last_name AS soyad,
			       last_name,
			       email AS email,
			       password_hash AS sifrehash,
			       password_hash,
			       handle AS ogrencino,
			       handle,
			       department AS bolum,
			       department,
			       grade AS sinif,
			       grade,
			       role_id AS rolid,
			       role_id AS roleid,
			       role_id,
			       avatar_url AS profilfoto,
			       avatar_url,
			       bio,
			       xp,
			       status AS status,
			       session_token AS aktifoturumtoken,
			       session_token,
			       last_login_at AS songiristarihi,
			       last_login_at,
			       last_login_ip AS songirisip,
			       last_login_ip,
			       last_login_user_agent AS songirisuseragent,
			       last_login_user_agent,
			       last_active_ip AS sonaktifip,
			       last_active_ip,
			       last_active_at AS sonaktiftarihi,
			       last_active_at,
			       totp_secret AS totpsecret,
			       totp_secret,
			       totp_enabled AS totpenabled,
			       totp_enabled,
			       totp_recovery_codes AS totprecoverycodes,
			       totp_recovery_codes,
			       totp_confirmed_at AS totpconfirmedat,
			       totp_confirmed_at,
			       totp_last_step AS totpsonadim,
			       totp_last_step,
			       session_expires_at AS oturumbitis,
			       session_expires_at,
			       mail_notifications_enabled AS postaeposta,
			       mail_notifications_enabled,
			       created_at AS olusturma,
			       created_at
			FROM users;

			DROP VIEW IF EXISTS etkinlikler CASCADE;
			CREATE VIEW etkinlikler AS
			SELECT *, endtime AS bitis
			FROM events;

			DROP VIEW IF EXISTS sistem_ayarlari CASCADE;
			CREATE VIEW sistem_ayarlari AS
			SELECT key AS anahtar, value AS deger, updated_at AS guncellenme
			FROM system_settings;

			DROP VIEW IF EXISTS guvenlik_engelleri CASCADE;
			CREATE VIEW guvenlik_engelleri AS
			SELECT ip, status AS status, reason AS neden, threat_score AS tehditpuani,
			       violations AS ihlaller, creator_id AS olusturanid,
			       expires_at AS bitistarihi, created_at AS olusturma, updated_at AS guncellenme
			FROM security_blocks;

			DROP VIEW IF EXISTS eposta_dogrulama CASCADE;
			CREATE VIEW eposta_dogrulama AS
			SELECT email AS email, code AS kod, type AS tur, expires_at AS songecerlilik, created_at AS olusturma
			FROM email_verifications;

			DROP VIEW IF EXISTS sistem_loglari CASCADE;
			CREATE VIEW sistem_loglari AS
			SELECT * FROM system_logs;
		`);
	});
}

