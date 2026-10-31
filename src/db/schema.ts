import type { NewsVisibility } from '@/types/news';
import type { InventoryStatus } from '@/types/inventory';
import type { BudgetRecordCategory } from '@/types/budget';
import type { TaskStatus, TaskPriority } from '@/lib/kanban';
import type { ProjectStatus } from '@/lib/projects';

/**
 * Default `sistem_ayarlari` rows.
 *
 * Defined once so both the SQLite and Postgres backends hand callers the same
 * shape — previously only SQLite pre-populated these, so a fresh Postgres install
 * returned an empty object and every consumer had to carry its own fallbacks.
 */
export const SYSTEM_SETTINGS_DEFAULTS: Record<string, string> = {
	smtp_host: process.env.SMTP_HOST || '',
	smtp_port: process.env.SMTP_PORT || '465',
	smtp_secure: 'true',
	smtp_user: process.env.SMTP_USER || '',
	smtp_pass: process.env.SMTP_PASS || '',
	smtp_from: process.env.SMTP_FROM || '',
	kulup_adi: process.env.CLUB_NAME || 'Orbit Community',
	kulup_domain: process.env.CLUB_DOMAIN || 'orbit.local',
	// Printed on certificates; editable by the board in the Certificates/Settings app.
	universite: process.env.CLUB_UNIVERSITY || 'tetha42',
	imza1_ad: process.env.CLUB_PRESIDENT_NAME || '',
	imza1_unvan: process.env.CLUB_PRESIDENT_TITLE || 'Topluluk Lideri',
	imza2_ad: process.env.CLUB_ADVISOR_NAME || '',
	imza2_unvan: process.env.CLUB_ADVISOR_TITLE || 'Stüdyo Koordinatörü',
};

/**
 * Member roster for the directory app: every member plus their first team name
 * and attendance count. No bind parameters, so SQLite and PostgreSQL run the
 * exact same statement.
 */
export const MEMBER_ROSTER_SQL = `
	SELECT
		k.id,
		k.first_name AS "ad",
		k.last_name AS "soyad",
		k.email AS "email",
		k.handle AS "ogrenciNo",
		k.department AS "bolum",
		k.grade AS "sinif",
		k.role_id AS "roleId",
		r.ad AS "rolAd",
		r.renk AS "rolRenk",
		k.avatar_url AS "profilFoto",
		k.bio,
		k.xp,
		k.status AS "status",
		k.created_at AS "olusturma",
		(
			SELECT STRING_AGG(DISTINCT t.ad, ', ' ORDER BY t.ad)
			FROM teams t
			LEFT JOIN team_members tu ON tu.teamId = t.id AND (tu.status = 'aktif' OR tu.status = 'active' OR tu.status IS NULL)
			WHERE tu.userId = k.id OR t.liderId = k.id
		) AS "takimAdi",
		(
			-- One row per team. A leader can also have a team_members row; without
			-- DISTINCT ON that produced two JSON objects with the same id.
			SELECT COALESCE(
				JSON_AGG(
					JSONB_BUILD_OBJECT(
						'id', x.id,
						'ad', x.ad,
						'kategori', x.kategori,
						'liderMi', (x.liderId = k.id),
						'role', x.role
					)
				),
				'[]'::json
			)
			FROM (
				SELECT DISTINCT ON (t.id)
					t.id, t.ad, t.kategori, t.liderId,
					CASE WHEN t.liderId = k.id THEN NULL ELSE tu.takimRolu END AS role
				FROM teams t
				LEFT JOIN team_members tu ON tu.teamId = t.id
					AND tu.userId = k.id
					AND (tu.status = 'aktif' OR tu.status = 'active' OR tu.status IS NULL)
				WHERE tu.userId = k.id OR t.liderId = k.id
				ORDER BY t.id, (t.liderId = k.id) DESC, tu.katilimTarihi ASC NULLS LAST
			) x
		) AS "takimlar",
		(
			SELECT COUNT(*)::int
			FROM attendances y
			WHERE y.userId = k.id
		) AS "yoklamaSayisi"
	FROM users k
	LEFT JOIN roles r ON r.id = k.role_id
	ORDER BY
		r.sistem DESC NULLS LAST,
		r.olusturma ASC NULLS LAST,
		k.created_at ASC
`;

/** A roster row: a member plus the derived directory columns. */
export interface MemberRosterRow extends User {
	/** Community-defined extra fields, with password values masked. */
	customFields?: Record<string, string>;
	rolAd?: string | null;
	rolRenk?: string | null;
	takimAdi?: string | null;
	takimlar?: Array<{ id: string; ad: string; kategori?: string; liderMi?: boolean; role?: string }> | null;
	yoklamaSayisi?: number;
	diskUsageBytes?: number;
	fileCount?: number;
}

export interface User {
	id: string;
	ad: string;
	soyad: string;
	email: string;
	passwordHash: string;
	ogrenciNo: string;
	bolum: string;
	sinif: number;
	/** Role from the `roller` table; null = no role yet (personal settings only). */
	roleId?: string | null;
	profilFoto?: string;
	bio?: string;
	xp: number;
	status: 'aktif' | 'beklemede' | 'reddedildi' | 'mezun';
	preferredLanguage?: 'tr' | 'en';
	/** How the current session authenticated: password only, password+TOTP, or a passkey. */
	authMethod?: 'password' | 'totp' | 'passkey';
	aktifOturumToken?: string;
	sonGirisTarihi?: number;
	sonGirisIp?: string | null;
	sonGirisUserAgent?: string | null;
	sonAktifIp?: string | null;
	sonAktifTarihi?: number | null;
	/** Base32 TOTP secret. Only trusted once `totpEnabled` is 1 — before that it is a pending setup. */
	totpSecret?: string | null;
	/** 1 when the member has confirmed a code from their authenticator app. */
	totpEnabled?: number;
	/** JSON array of bcrypt hashes for one-time recovery codes. */
	totpRecoveryCodes?: string | null;
	totpConfirmedAt?: number | null;
	/**
	 * The last TOTP time-step accepted for this account.
	 *
	 * Rejecting any code whose step is not greater than this makes each code
	 * single-use — without it, a captured code stays valid for its whole window
	 * and can satisfy two separate sign-ins.
	 */
	totpSonAdim?: number | null;
	/**
	 * Session expiry, epoch millis.
	 *
	 * The cookie's max-age is a client-side hint that a caller can ignore; this is
	 * what actually bounds a session's life.
	 */
	oturumBitis?: number | null;
	olusturma: number;
}

export interface Team {
	id: string;
	ad: string;
	slug: string;
	aciklama: string;
	/** One of TAKIM_KATEGORILERI; older rows may hold a free-form value. */
	kategori: string;
	liderId: string;
	liderAdSoyad?: string;
	kontenjan: number;
	aktifUyeSayisi?: number;
	repoUrl?: string;
	status: 'aktif' | 'tamamlandi' | 'askida';
	/** `acik`: join at once; `onayli`: apply, and the captain decides. */
	katilimTuru?: 'acik' | 'onayli';
	/** `working_group` (default) or the decision body `committee`. */
	type?: 'working_group' | 'committee';
	/** Quorum for a committee, 0 when unspecified. */
	quorum?: number;
	olusturma: number;
}

export interface TeamMember {
	id: string;
	teamId: string;
	userId: string;
	kullaniciAdSoyad?: string;
	kullaniciBolum?: string;
	takimRolu: string;
	status: 'aktif' | 'basvurdu';
	/** What the applicant wrote with an application. */
	basvuruNotu?: string | null;
	katilimTarihi: number;
	/** Committee members only. */
	votingRight?: number;
	termStart?: number | null;
	termEnd?: number | null;
}

// Kanban vocabulary lives in a pure module the board shares with the API.
export type { TaskStatus, TaskPriority } from '@/lib/kanban';

export interface TeamTask {
	id: string;
	teamId: string;
	baslik: string;
	aciklama?: string;
	status: TaskStatus;
	oncelik: TaskPriority;
	atananUyeId?: string;
	atananAdSoyad?: string;
	teslimTarihi?: number;
	/** Position within its column; smaller sorts higher. */
	sira?: number;
	/** Free-form labels ("frontend", "donanım"); stored as a JSON array. */
	etiketler?: string[];
	olusturanId?: string | null;
	olusturanAdSoyad?: string | null;
	guncellenme?: number;
	/** When it last reached `tamamlandi`; null while it is open. */
	tamamlanma?: number | null;
	/** Checklist progress and discussion size, for the card face. */
	maddeSayisi?: number;
	tamamMaddeSayisi?: number;
	yorumSayisi?: number;
	olusturma: number;
}

/** One checklist line of a task. */
export interface TeamTaskItem {
	id: string;
	gorevId: string;
	metin: string;
	tamamMi: number;
	sira: number;
	olusturma: number;
}

/** A comment in a task's discussion. */
export interface TeamTaskComment {
	id: string;
	gorevId: string;
	userId: string | null;
	kullaniciAdSoyad?: string | null;
	icerik: string;
	olusturma: number;
}

/**
 * What happened to a task, as facts: the client writes the sentence. `detay` is
 * a small JSON object whose shape depends on `tur` (e.g. `{ "from": "suruyor", "to": "inceleme" }`).
 */
export type TaskActivityType =
	| 'olusturuldu'
	| 'tasindi'
	| 'duzenlendi'
	| 'atandi'
	| 'madde_eklendi'
	| 'madde_tamamlandi'
	| 'yorum';

export interface TeamTaskActivity {
	id: string;
	gorevId: string;
	aktorId: string | null;
	aktorAdSoyad?: string | null;
	tur: TaskActivityType;
	detay: Record<string, string | number | null> | null;
	olusturma: number;
}

/** Everything the task detail sheet shows. */
export interface TeamTaskDetail {
	task: TeamTask;
	maddeler: TeamTaskItem[];
	yorumlar: TeamTaskComment[];
	aktivite: TeamTaskActivity[];
}

/** An open task assigned to a member, with the project it belongs to. */
export interface UpcomingTask {
	id: string;
	teamId: string;
	takimAdi: string;
	baslik: string;
	oncelik: TeamTask['oncelik'];
	teslimTarihi: number;
}

/** An inventory item on loan to a member, with the date it is due back. */
export interface YaklasanIade {
	id: string;
	kod: string;
	ad: string;
	iadeTarihi: number;
}

export interface CommunityEvent {
	id: string;
	slug: string;
	baslik: string;
	tur: 'atolye' | 'seminer' | 'yarisma' | 'toplanti';
	aciklama: string;
	konum: string;
	baslangic: number;
	endTime: number;
	kapasite: number;
	kayitliSayisi?: number;
	status: 'taslak' | 'yayinda' | 'tamamlandi' | 'iptal';
	olusturanId: string;
	ownerTeamId?: string | null;
	ownerUserId?: string | null;
	createdBy?: string | null;
	ownerTeamAd?: string | null;
	ownerUserAdSoyad?: string | null;
	olusturma: number;
}

export interface Attendance {
	id: string;
	etkinlikId: string;
	userId: string;
	yontem: 'qr' | 'manuel';
	katilimZamani: number;
}

export interface BudgetRecord {
	id: string;
	date: number;
	tur: 'gelir' | 'gider';
	kategori: BudgetRecordCategory;
	tutarKurus: number; // Kuruş cinsinden (150000 = 1.500,00 TL)
	aciklama: string;
	fisFotoUrl?: string;
	kaydedenId: string;
	kaydedenAdSoyad?: string;
	/** The project (takım) whose kasa this row belongs to; null/absent = the general kasa. */
	teamId?: string | null;
	olusturma: number;
	/** Shared by the two rows of an allocation between kasas; they are deleted together. */
	aktarimId?: string | null;
	/** The other kasa of an allocation (`null` = general kasa), filled in on read. */
	karsiKasaAd?: string | null;
	/** Last correction of the description, category, date or receipt. */
	guncelleyenId?: string | null;
	guncelleyenAdSoyad?: string | null;
	guncellenme?: number | null;
}

/** Ownership record for an uploaded receipt; the bytes live under UPLOAD_DIR. */
export interface StoredFile {
	ad: string;
	yukleyenId: string | null;
	mime: string;
	boyut: number;
	/** 1 for files every signed-in member may read (profile photos). */
	herkeseAcik?: number;
	/** Set for chat attachments; read access follows the room. */
	sohbetOdaId?: string | null;
	olusturma: number;
}

export interface Decision {
	id: string;
	kararNo: number; // Örn: 2026001
	belgeTuru?: string; // 'karar' | 'salon_tahsisi' | 'etkinlik_izni' | 'malzeme_talep' | 'ust_yazi'
	baslik: string;
	date: number;
	gundem: string;
	icerik: string; // Markdown destekli karar metni
	kamuyaAcikMi: number; // 1: Üyeler görebilir, 0: Sadece YK
	kilitliMi: number;
	olusturanId: string;
	olusturanAdSoyad?: string;
	olusturma: number;
	/** Committee that issued the decision, if any. */
	bodyId?: string | null;
	bodyAd?: string | null;
	decisionType?: string;
	quorumMet?: number;
	votesFor?: number;
	votesAgainst?: number;
	votesAbstain?: number;
	publishedAt?: number | null;
}

export interface NewsItem {
	id: string;
	/** Stable, human-readable address of the article in the public API: `/news?s=<slug>`. */
	slug: string;
	baslik: string;
	ozet: string;
	icerik: string;
	kategori: string;
	onemliMi: number;
	resimUrl?: string;
	/** Who can read it: `taslak` (management), `uyeler` (signed-in members), `yayinda` (everyone). */
	publishStatus: NewsVisibility;
	/** When it first became visible beyond management; null while it is still a draft. */
	yayinTarihi: number | null;
	yazarId?: string;
	yazarAdSoyad?: string;
	olusturma: number;
	guncellenme: number;
}

export interface Certificate {
	id: string;
	verificationCode: string; // Örn: "BEU-2026-NXT-9042"
	userId: string;
	kullaniciAdSoyad?: string;
	etkinlikId?: string;
	baslik: string;
	kategori?: string | null;
	dil?: string | null;
	aciklama?: string | null;
	verilisTarihi: number;
	pdfUrl?: string;
	olusturma: number;
}

export interface InventoryItem {
	id: string;
	kod: string; // Örn: "LAB-RPI-004"
	ad: string;
	kategori: 'Gömülü Sistem' | 'Sensör' | 'Geliştirme Kartı' | 'Test Ekipmanı' | string;
	/** Canonical status vocabulary — see src/types/inventory.ts. */
	status: InventoryStatus;
	konum: string;
	oduncAlanId?: string;
	oduncAlanAdSoyad?: string;
	iadeTarihi?: number;
	/** When the current loan started; extensions are limited from here. */
	oduncTarihi?: number | null;
	aciklama?: string | null;
	seriNo?: string | null;
}

export interface UserNote {
	id: string;
	userId: string;
	baslik: string;
	icerik: string;
	renk?: string;
	sabitliMi?: boolean;
	klasorId?: string;
	copteMi?: boolean;
	guncellenme: number;
	olusturma: number;
}

export interface UserNoteFolder {
	id: string;
	userId: string;
	ad: string;
	renk?: string;
	sira?: number;
	olusturma: number;
}

export interface SystemSetting {
	anahtar: string;
	deger: string;
	guncellenme: number;
}

export interface WebauthnCredential {
	/** base64url credential id — the primary key the authenticator reports. */
	id: string;
	userId: string;
	/** base64url COSE public key. */
	publicKey: string;
	/** Signature counter, used to detect cloned authenticators. */
	counter: number;
	/** Comma-separated transport hints reported at registration. */
	transports?: string | null;
	deviceType?: string | null;
	backedUp?: number;
	/** Member-supplied label, e.g. "iPhone" or "YubiKey". */
	nickname?: string | null;
	olusturma: number;
	sonKullanma?: number | null;
}

export interface WebauthnChallenge {
	id: string;
	/** Null for a sign-in challenge, which happens before the member is identified. */
	userId?: string | null;
	challenge: string;
	tur: 'registration' | 'giris';
	olusturma: number;
}



/** A project in the showcase (Projeler app). */
export interface Project {
	id: string;
	slug: string;
	baslik: string;
	/** One or two sentences for the card. */
	ozet: string;
	/** The long write-up shown in the detail view. */
	aciklama: string;
	repoUrl: string | null;
	canliUrl: string | null;
	teknolojiler: string[];
	/** The R&D team behind it, if any. */
	teamId: string | null;
	takimAdi?: string | null;
	olusturanId: string | null;
	olusturanAdSoyad?: string | null;
	ownerTeamId?: string | null;
	ownerUserId?: string | null;
	createdBy?: string | null;
	ownerTeamAd?: string | null;
	ownerUserAdSoyad?: string | null;
	status: ProjectStatus;
	/** Pinned to the top of the showcase by management. */
	oneCikan: number;
	begeniSayisi?: number;
	/** Whether the member asking has starred it. */
	begendimMi?: boolean;
	olusturma: number;
	guncellenme: number;
}
