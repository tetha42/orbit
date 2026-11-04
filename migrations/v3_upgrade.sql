-- ============================================================================
-- Orbit Community OS: v2 to v3 Production Upgrade Migration
-- Zero-Backward-Compatibility Canonical SQL Migration Script
-- Safe, atomic, and idempotent upgrade from legacy Orbit schema to Pure v3
-- ============================================================================

BEGIN;

-- 1. DROP ALL OBSOLETE DUAL-WRITE TRIGGERS & FUNCTIONS
DROP TRIGGER IF EXISTS sync_users_to_normalized ON users;
DROP TRIGGER IF EXISTS trg_sync_users_on_insert ON users;
DROP TRIGGER IF EXISTS sync_users_on_update ON users;
DROP FUNCTION IF EXISTS sync_users_to_normalized_fn() CASCADE;
DROP FUNCTION IF EXISTS sync_users_trigger() CASCADE;

-- 2. CREATE HELPER TO SAFELY RENAME COLUMNS IF THEY EXIST
CREATE OR REPLACE FUNCTION _orbit_rename_col_if_exists(
    t_name text,
    old_col text,
    new_col text
) RETURNS void AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = t_name AND column_name = lower(old_col)
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = t_name AND column_name = lower(new_col)
    ) THEN
        EXECUTE format('ALTER TABLE %I RENAME COLUMN %I TO %I', t_name, lower(old_col), lower(new_col));
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. RENAME UNQUOTED / TURKISH COLUMNS IN CORE TABLES
-- users
SELECT _orbit_rename_col_if_exists('users', 'ad', 'first_name');
SELECT _orbit_rename_col_if_exists('users', 'soyad', 'last_name');
SELECT _orbit_rename_col_if_exists('users', 'ogrencino', 'handle');
SELECT _orbit_rename_col_if_exists('users', 'bolum', 'department');
SELECT _orbit_rename_col_if_exists('users', 'sinif', 'grade');
SELECT _orbit_rename_col_if_exists('users', 'rolid', 'role_id');
SELECT _orbit_rename_col_if_exists('users', 'profilfoto', 'avatar_url');
SELECT _orbit_rename_col_if_exists('users', 'olusturma', 'created_at');
SELECT _orbit_rename_col_if_exists('users', 'durum', 'status');
SELECT _orbit_rename_col_if_exists('users', 'songiristarihi', 'last_login_at');
SELECT _orbit_rename_col_if_exists('users', 'songirisip', 'last_login_ip');
SELECT _orbit_rename_col_if_exists('users', 'songirisuseragent', 'last_login_user_agent');
SELECT _orbit_rename_col_if_exists('users', 'sonaktifip', 'last_active_ip');
SELECT _orbit_rename_col_if_exists('users', 'sonaktiftarihi', 'last_active_at');
SELECT _orbit_rename_col_if_exists('users', 'oturumtoken', 'session_token');
SELECT _orbit_rename_col_if_exists('users', 'oturumbitis', 'session_expires_at');
SELECT _orbit_rename_col_if_exists('users', 'totpsecret', 'totp_secret');
SELECT _orbit_rename_col_if_exists('users', 'totpenabled', 'totp_enabled');
SELECT _orbit_rename_col_if_exists('users', 'totprecoverycodes', 'totp_recovery_codes');
SELECT _orbit_rename_col_if_exists('users', 'totpconfirmedat', 'totp_confirmed_at');
SELECT _orbit_rename_col_if_exists('users', 'totplaststep', 'totp_last_step');
SELECT _orbit_rename_col_if_exists('users', 'mailbildirim', 'mail_notifications_enabled');
SELECT _orbit_rename_col_if_exists('users', 'preferredlanguage', 'preferred_language');

-- roles
SELECT _orbit_rename_col_if_exists('roles', 'ad', 'name');
SELECT _orbit_rename_col_if_exists('roles', 'renk', 'color');
SELECT _orbit_rename_col_if_exists('roles', 'aciklama', 'description');
SELECT _orbit_rename_col_if_exists('roles', 'sistem', 'is_system');
SELECT _orbit_rename_col_if_exists('roles', 'ikiadimzorunlu', 'require_2fa');
SELECT _orbit_rename_col_if_exists('roles', 'olusturma', 'created_at');
SELECT _orbit_rename_col_if_exists('roles', 'izinler', 'permissions');

-- teams
SELECT _orbit_rename_col_if_exists('teams', 'ad', 'name');
SELECT _orbit_rename_col_if_exists('teams', 'aciklama', 'description');
SELECT _orbit_rename_col_if_exists('teams', 'kategori', 'category');
SELECT _orbit_rename_col_if_exists('teams', 'liderid', 'lead_id');
SELECT _orbit_rename_col_if_exists('teams', 'kontenjan', 'capacity');
SELECT _orbit_rename_col_if_exists('teams', 'katilimturu', 'join_policy');
SELECT _orbit_rename_col_if_exists('teams', 'olusturma', 'created_at');
SELECT _orbit_rename_col_if_exists('teams', 'durum', 'status');

-- team_members
SELECT _orbit_rename_col_if_exists('team_members', 'takimid', 'team_id');
SELECT _orbit_rename_col_if_exists('team_members', 'userid', 'user_id');
SELECT _orbit_rename_col_if_exists('team_members', 'takimrolu', 'role_title');
SELECT _orbit_rename_col_if_exists('team_members', 'durum', 'status');
SELECT _orbit_rename_col_if_exists('team_members', 'basvurunotu', 'application_note');
SELECT _orbit_rename_col_if_exists('team_members', 'oyhakki', 'voting_right');
SELECT _orbit_rename_col_if_exists('team_members', 'katilimtarihi', 'joined_at');

-- team_tasks
SELECT _orbit_rename_col_if_exists('team_tasks', 'takimid', 'team_id');
SELECT _orbit_rename_col_if_exists('team_tasks', 'baslik', 'title');
SELECT _orbit_rename_col_if_exists('team_tasks', 'aciklama', 'description');
SELECT _orbit_rename_col_if_exists('team_tasks', 'durum', 'status');
SELECT _orbit_rename_col_if_exists('team_tasks', 'oncelik', 'priority');
SELECT _orbit_rename_col_if_exists('team_tasks', 'atananuyeid', 'assignee_id');
SELECT _orbit_rename_col_if_exists('team_tasks', 'teslimtarihi', 'due_at');
SELECT _orbit_rename_col_if_exists('team_tasks', 'sira', 'position');
SELECT _orbit_rename_col_if_exists('team_tasks', 'etiketler', 'labels');
SELECT _orbit_rename_col_if_exists('team_tasks', 'xpodulu', 'xp_awarded');
SELECT _orbit_rename_col_if_exists('team_tasks', 'olusturanid', 'created_by');
SELECT _orbit_rename_col_if_exists('team_tasks', 'tamamlanmatarihi', 'completed_at');
SELECT _orbit_rename_col_if_exists('team_tasks', 'olusturma', 'created_at');
SELECT _orbit_rename_col_if_exists('team_tasks', 'guncellenme', 'updated_at');

-- events
SELECT _orbit_rename_col_if_exists('events', 'baslik', 'title');
SELECT _orbit_rename_col_if_exists('events', 'aciklama', 'description');
SELECT _orbit_rename_col_if_exists('events', 'kategori', 'category');
SELECT _orbit_rename_col_if_exists('events', 'konum', 'location');
SELECT _orbit_rename_col_if_exists('events', 'baslangictarihi', 'starts_at');
SELECT _orbit_rename_col_if_exists('events', 'bitistarihi', 'ends_at');
SELECT _orbit_rename_col_if_exists('events', 'kontenjan', 'capacity');
SELECT _orbit_rename_col_if_exists('events', 'durum', 'status');
SELECT _orbit_rename_col_if_exists('events', 'yoklamaacik', 'checkin_open');
SELECT _orbit_rename_col_if_exists('events', 'yoklamakodu', 'checkin_code');
SELECT _orbit_rename_col_if_exists('events', 'xpodulu', 'xp_reward');
SELECT _orbit_rename_col_if_exists('events', 'takimid', 'owner_team_id');
SELECT _orbit_rename_col_if_exists('events', 'sahipid', 'owner_user_id');
SELECT _orbit_rename_col_if_exists('events', 'olusturanid', 'created_by');
SELECT _orbit_rename_col_if_exists('events', 'olusturma', 'created_at');

-- budget_records
SELECT _orbit_rename_col_if_exists('budget_records', 'tarih', 'date');
SELECT _orbit_rename_col_if_exists('budget_records', 'tur', 'entry_type');
SELECT _orbit_rename_col_if_exists('budget_records', 'kategori', 'category');
SELECT _orbit_rename_col_if_exists('budget_records', 'tutarkurus', 'amount_minor');
SELECT _orbit_rename_col_if_exists('budget_records', 'aciklama', 'description');
SELECT _orbit_rename_col_if_exists('budget_records', 'fisfotourl', 'receipt_url');
SELECT _orbit_rename_col_if_exists('budget_records', 'takimid', 'team_id');
SELECT _orbit_rename_col_if_exists('budget_records', 'aktarimid', 'transfer_pair_id');
SELECT _orbit_rename_col_if_exists('budget_records', 'kaydedenid', 'recorded_by');
SELECT _orbit_rename_col_if_exists('budget_records', 'guncelleyenid', 'updated_by');
SELECT _orbit_rename_col_if_exists('budget_records', 'olusturma', 'created_at');
SELECT _orbit_rename_col_if_exists('budget_records', 'guncelleme', 'updated_at');

-- decisions
SELECT _orbit_rename_col_if_exists('decisions', 'kararno', 'reference_no');
SELECT _orbit_rename_col_if_exists('decisions', 'belgeturu', 'record_type');
SELECT _orbit_rename_col_if_exists('decisions', 'kararturu', 'decision_type');
SELECT _orbit_rename_col_if_exists('decisions', 'organid', 'body_id');
SELECT _orbit_rename_col_if_exists('decisions', 'baslik', 'title');
SELECT _orbit_rename_col_if_exists('decisions', 'tarih', 'date');
SELECT _orbit_rename_col_if_exists('decisions', 'gundem', 'agenda');
SELECT _orbit_rename_col_if_exists('decisions', 'metin', 'content');
SELECT _orbit_rename_col_if_exists('decisions', 'durum', 'status');
SELECT _orbit_rename_col_if_exists('decisions', 'kamuyaacikmi', 'is_public');
SELECT _orbit_rename_col_if_exists('decisions', 'kilitlimi', 'is_locked');
SELECT _orbit_rename_col_if_exists('decisions', 'yeterlibulundumu', 'quorum_met');
SELECT _orbit_rename_col_if_exists('decisions', 'kabuloy', 'votes_for');
SELECT _orbit_rename_col_if_exists('decisions', 'redoy', 'votes_against');
SELECT _orbit_rename_col_if_exists('decisions', 'cekimseroy', 'votes_abstain');
SELECT _orbit_rename_col_if_exists('decisions', 'katilanlar', 'attendees');
SELECT _orbit_rename_col_if_exists('decisions', 'ekler', 'attachments');
SELECT _orbit_rename_col_if_exists('decisions', 'olusturanid', 'created_by');
SELECT _orbit_rename_col_if_exists('decisions', 'yayintarihi', 'published_at');
SELECT _orbit_rename_col_if_exists('decisions', 'olusturma', 'created_at');
SELECT _orbit_rename_col_if_exists('decisions', 'guncelleme', 'updated_at');

-- news
SELECT _orbit_rename_col_if_exists('news', 'baslik', 'title');
SELECT _orbit_rename_col_if_exists('news', 'ozet', 'summary');
SELECT _orbit_rename_col_if_exists('news', 'icerik', 'content');
SELECT _orbit_rename_col_if_exists('news', 'kategori', 'category');
SELECT _orbit_rename_col_if_exists('news', 'sabitlimi', 'is_pinned');
SELECT _orbit_rename_col_if_exists('news', 'resimurl', 'cover_url');
SELECT _orbit_rename_col_if_exists('news', 'yayintarihi', 'published_at');
SELECT _orbit_rename_col_if_exists('news', 'yazarid', 'author_id');
SELECT _orbit_rename_col_if_exists('news', 'olusturma', 'created_at');
SELECT _orbit_rename_col_if_exists('news', 'guncelleme', 'updated_at');

-- inventory
SELECT _orbit_rename_col_if_exists('inventory', 'kod', 'code');
SELECT _orbit_rename_col_if_exists('inventory', 'ad', 'name');
SELECT _orbit_rename_col_if_exists('inventory', 'kategori', 'category');
SELECT _orbit_rename_col_if_exists('inventory', 'konum', 'location');
SELECT _orbit_rename_col_if_exists('inventory', 'durum', 'status');
SELECT _orbit_rename_col_if_exists('inventory', 'aciklama', 'description');
SELECT _orbit_rename_col_if_exists('inventory', 'serino', 'serial_number');
SELECT _orbit_rename_col_if_exists('inventory', 'oduncalanid', 'holder_user_id');
SELECT _orbit_rename_col_if_exists('inventory', 'odunctarihi', 'borrowed_at');
SELECT _orbit_rename_col_if_exists('inventory', 'iadetarihi', 'due_at');

-- user_notes
SELECT _orbit_rename_col_if_exists('user_notes', 'userid', 'user_id');
SELECT _orbit_rename_col_if_exists('user_notes', 'baslik', 'title');
SELECT _orbit_rename_col_if_exists('user_notes', 'icerik', 'content');
SELECT _orbit_rename_col_if_exists('user_notes', 'renk', 'color');
SELECT _orbit_rename_col_if_exists('user_notes', 'sabitlimi', 'is_pinned');
SELECT _orbit_rename_col_if_exists('user_notes', 'klasorid', 'folder_id');
SELECT _orbit_rename_col_if_exists('user_notes', 'coptemi', 'is_trashed');
SELECT _orbit_rename_col_if_exists('user_notes', 'guncelleme', 'updated_at');
SELECT _orbit_rename_col_if_exists('user_notes', 'olusturma', 'created_at');

-- projects
SELECT _orbit_rename_col_if_exists('projects', 'baslik', 'title');
SELECT _orbit_rename_col_if_exists('projects', 'ozet', 'summary');
SELECT _orbit_rename_col_if_exists('projects', 'aciklama', 'description');
SELECT _orbit_rename_col_if_exists('projects', 'repourl', 'repo_url');
SELECT _orbit_rename_col_if_exists('projects', 'canliurl', 'live_url');
SELECT _orbit_rename_col_if_exists('projects', 'teknolojiler', 'tech_stack');
SELECT _orbit_rename_col_if_exists('projects', 'takimid', 'team_id');
SELECT _orbit_rename_col_if_exists('projects', 'sahiptakimid', 'owner_team_id');
SELECT _orbit_rename_col_if_exists('projects', 'sahipid', 'owner_user_id');
SELECT _orbit_rename_col_if_exists('projects', 'olusturanid', 'created_by');
SELECT _orbit_rename_col_if_exists('projects', 'durum', 'status');
SELECT _orbit_rename_col_if_exists('projects', 'onecikan', 'is_featured');
SELECT _orbit_rename_col_if_exists('projects', 'begeniler', 'starred_by');
SELECT _orbit_rename_col_if_exists('projects', 'olusturma', 'created_at');
SELECT _orbit_rename_col_if_exists('projects', 'guncelleme', 'updated_at');

-- chat_rooms, members, messages
SELECT _orbit_rename_col_if_exists('chat_rooms', 'tur', 'room_type');
SELECT _orbit_rename_col_if_exists('chat_rooms', 'takimid', 'team_id');
SELECT _orbit_rename_col_if_exists('chat_rooms', 'ad', 'name');
SELECT _orbit_rename_col_if_exists('chat_rooms', 'olusturanid', 'created_by');
SELECT _orbit_rename_col_if_exists('chat_rooms', 'olusturma', 'created_at');

SELECT _orbit_rename_col_if_exists('chat_members', 'odaid', 'room_id');
SELECT _orbit_rename_col_if_exists('chat_members', 'userid', 'user_id');
SELECT _orbit_rename_col_if_exists('chat_members', 'klasor', 'folder');
SELECT _orbit_rename_col_if_exists('chat_members', 'yildizli', 'is_starred');
SELECT _orbit_rename_col_if_exists('chat_members', 'sonokuma', 'last_read_at');
SELECT _orbit_rename_col_if_exists('chat_members', 'katilma', 'joined_at');

SELECT _orbit_rename_col_if_exists('chat_messages', 'odaid', 'room_id');
SELECT _orbit_rename_col_if_exists('chat_messages', 'gonderenid', 'sender_id');
SELECT _orbit_rename_col_if_exists('chat_messages', 'gonderenad', 'sender_name');
SELECT _orbit_rename_col_if_exists('chat_messages', 'gonderenfoto', 'sender_avatar');
SELECT _orbit_rename_col_if_exists('chat_messages', 'icerik', 'content');
SELECT _orbit_rename_col_if_exists('chat_messages', 'ekler', 'attachments');
SELECT _orbit_rename_col_if_exists('chat_messages', 'tarih', 'date');
SELECT _orbit_rename_col_if_exists('chat_messages', 'silinmetarihi', 'deleted_at');
SELECT _orbit_rename_col_if_exists('chat_messages', 'duzenlenmetarihi', 'edited_at');
SELECT _orbit_rename_col_if_exists('chat_messages', 'yanitlananmesajid', 'reply_to_id');
SELECT _orbit_rename_col_if_exists('chat_messages', 'yanitlananmesaj', 'reply_snapshot');
SELECT _orbit_rename_col_if_exists('chat_messages', 'iletildimi', 'is_delivered');

-- audit_logs
SELECT _orbit_rename_col_if_exists('audit_logs', 'zaman', 'timestamp');
SELECT _orbit_rename_col_if_exists('audit_logs', 'yapanid', 'actor_id');
SELECT _orbit_rename_col_if_exists('audit_logs', 'yapanad', 'actor_name');
SELECT _orbit_rename_col_if_exists('audit_logs', 'islem', 'action');
SELECT _orbit_rename_col_if_exists('audit_logs', 'hedeftur', 'target_type');
SELECT _orbit_rename_col_if_exists('audit_logs', 'hedefid', 'target_id');
SELECT _orbit_rename_col_if_exists('audit_logs', 'hedefad', 'target_name');
SELECT _orbit_rename_col_if_exists('audit_logs', 'onceki', 'before_state');
SELECT _orbit_rename_col_if_exists('audit_logs', 'sonraki', 'after_state');

-- system_logs
SELECT _orbit_rename_col_if_exists('system_logs', 'zaman', 'timestamp');
SELECT _orbit_rename_col_if_exists('system_logs', 'seviye', 'level');
SELECT _orbit_rename_col_if_exists('system_logs', 'servis', 'service');
SELECT _orbit_rename_col_if_exists('system_logs', 'mesaj', 'message');
SELECT _orbit_rename_col_if_exists('system_logs', 'detay', 'details');
SELECT _orbit_rename_col_if_exists('system_logs', 'userid', 'user_id');

-- audit_logs: rewrite stored Turkish action / target_type values to the English vocabulary
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'action') THEN
        UPDATE audit_logs SET action = CASE action
            WHEN 'rol.olustur' THEN 'role.create'      WHEN 'role.olustur' THEN 'role.create'
            WHEN 'rol.duzenle' THEN 'role.edit'        WHEN 'role.duzenle' THEN 'role.edit'
            WHEN 'rol.sil' THEN 'role.delete'          WHEN 'role.sil' THEN 'role.delete'
            WHEN 'rol.varsayilan' THEN 'role.default'  WHEN 'role.varsayilan' THEN 'role.default'
            WHEN 'uye.rol_ata' THEN 'member.role_grant'
            WHEN 'uye.rol_kaldir' THEN 'member.role_revoke'
            WHEN 'uye.sil' THEN 'member.delete'
            WHEN 'uye.mezun' THEN 'member.graduate'
            WHEN 'uye.aktif' THEN 'member.activate'
            WHEN 'uye.status' THEN 'member.status'
            WHEN 'uye.profil' THEN 'member.profile'
            WHEN 'uye.email' THEN 'member.email'
            WHEN 'uye.anonimlestir' THEN 'member.anonymize'
            WHEN 'uye.sifre_sifirlama' THEN 'member.password_reset'
            WHEN 'basvuru.onayla' THEN 'application.approve'
            WHEN 'basvuru.reddet' THEN 'application.reject'
            WHEN 'ayar.smtp' THEN 'setting.smtp'
            WHEN 'guvenlik.2fa_kapat' THEN 'security.2fa_disable'
            ELSE action END
        WHERE action IN ('rol.olustur','role.olustur','rol.duzenle','role.duzenle','rol.sil','role.sil','rol.varsayilan','role.varsayilan',
            'uye.rol_ata','uye.rol_kaldir','uye.sil','uye.mezun','uye.aktif','uye.status','uye.profil','uye.email','uye.anonimlestir',
            'uye.sifre_sifirlama','basvuru.onayla','basvuru.reddet','ayar.smtp','guvenlik.2fa_kapat');
        -- snapshot keys that never had an English twin (keys that were written twice, e.g. rolId + roleId, are left as recorded)
        UPDATE audit_logs SET
            before_state = replace(replace(replace(replace(replace(replace(replace(before_state,
                '"tasinanUyeSayisi"', '"movedCount"'), '"tasinanRolId"', '"movedToRoleId"'), '"tasinanRolAd"', '"movedToRoleName"'),
                '"varsayilanRolKaldirildi"', '"defaultRoleCleared"'), '"uyeEklendi"', '"memberAdded"'), '"ikiAdim":"acik"', '"twoFactor":"on"'), '"ikiAdim":"kapali"', '"twoFactor":"off"'),
            after_state = replace(replace(replace(replace(replace(replace(replace(after_state,
                '"tasinanUyeSayisi"', '"movedCount"'), '"tasinanRolId"', '"movedToRoleId"'), '"tasinanRolAd"', '"movedToRoleName"'),
                '"varsayilanRolKaldirildi"', '"defaultRoleCleared"'), '"uyeEklendi"', '"memberAdded"'), '"ikiAdim":"acik"', '"twoFactor":"on"'), '"ikiAdim":"kapali"', '"twoFactor":"off"')
        WHERE before_state LIKE '%tasinan%' OR after_state LIKE '%tasinan%' OR after_state LIKE '%uyeEklendi%'
           OR after_state LIKE '%varsayilanRolKaldirildi%' OR before_state LIKE '%ikiAdim"%' OR after_state LIKE '%ikiAdim"%';
        UPDATE audit_logs SET target_type = CASE target_type
            WHEN 'rol' THEN 'role' WHEN 'uye' THEN 'member' WHEN 'ayar' THEN 'setting' ELSE target_type END
        WHERE target_type IN ('rol','uye','ayar');
    END IF;
END $$;

-- Clean up helper
DROP FUNCTION IF EXISTS _orbit_rename_col_if_exists(text, text, text);

-- 4. MIGRATE & CONSOLIDATE UNIFIED TABLES
-- Create event_participants if missing
CREATE TABLE IF NOT EXISTS event_participants (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'registered',
    checkin_method TEXT,
    registered_at BIGINT NOT NULL,
    attended_at BIGINT,
    recorded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (event_id, user_id)
);

-- Backfill event_participants from legacy event_registrations and attendances
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_registrations') THEN
        INSERT INTO event_participants (id, event_id, user_id, status, registered_at)
        SELECT 
            id,
            event_id,
            user_id,
            CASE status WHEN 'kayitli' THEN 'registered' WHEN 'yedek' THEN 'waitlisted' WHEN 'iptal' THEN 'cancelled' ELSE status END,
            COALESCE(created_at, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
        FROM event_registrations
        ON CONFLICT (event_id, user_id) DO UPDATE SET
            status = EXCLUDED.status;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attendances') THEN
        INSERT INTO event_participants (id, event_id, user_id, status, checkin_method, registered_at, attended_at, recorded_by)
        SELECT 
            id,
            event_id,
            user_id,
            'attended',
            COALESCE(checkin_method, 'manual'),
            COALESCE(attended_at, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
            COALESCE(attended_at, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
            recorded_by
        FROM attendances
        ON CONFLICT (event_id, user_id) DO UPDATE SET
            status = 'attended',
            attended_at = EXCLUDED.attended_at,
            checkin_method = EXCLUDED.checkin_method,
            recorded_by = EXCLUDED.recorded_by;
    END IF;
END $$;

-- 5. CANONICAL ROLE IDS AND ENUMS MIGRATION
UPDATE roles SET id = 'role_admin' WHERE id = 'rol_admin';
UPDATE roles SET id = 'role_member' WHERE id = 'rol_uye';
UPDATE roles SET id = 'role_management_board' WHERE id = 'rol_yonetim_kurulu';
UPDATE roles SET id = 'role_alumni' WHERE id = 'rol_mezun';

UPDATE users SET role_id = 'role_admin' WHERE role_id = 'rol_admin';
UPDATE users SET role_id = 'role_member' WHERE role_id = 'rol_uye';
UPDATE users SET role_id = 'role_management_board' WHERE role_id = 'rol_yonetim_kurulu';
UPDATE users SET role_id = 'role_alumni' WHERE role_id = 'rol_mezun';

UPDATE invitations SET role_id = 'role_admin' WHERE role_id = 'rol_admin';
UPDATE invitations SET role_id = 'role_member' WHERE role_id = 'rol_uye';
UPDATE invitations SET role_id = 'role_management_board' WHERE role_id = 'rol_yonetim_kurulu';
UPDATE invitations SET role_id = 'role_alumni' WHERE role_id = 'rol_mezun';

-- Normalize permissions JSONB inside roles: 'yok' -> 'none', 'kullan' -> 'use', 'yonet' -> 'manage'
DO $$
BEGIN
    UPDATE roles
    SET permissions = (
        SELECT jsonb_object_agg(
            key,
            CASE trim(both '"' from value::text)
                WHEN 'yok' THEN to_jsonb('none'::text)
                WHEN 'kullan' THEN to_jsonb('use'::text)
                WHEN 'yonet' THEN to_jsonb('manage'::text)
                ELSE value
            END
        )
        FROM jsonb_each(permissions)
    )
    WHERE permissions IS NOT NULL AND permissions != '{}'::jsonb;
END $$;

-- Normalize user status enums
UPDATE users SET status = 'active' WHERE status = 'aktif';
UPDATE users SET status = 'pending' WHERE status = 'beklemede';
UPDATE users SET status = 'rejected' WHERE status = 'reddedildi';
UPDATE users SET status = 'alumni' WHERE status = 'mezun';

-- 6. PURGE ALL 28 OBSOLETE ZOMBIE & REDUNDANT TABLES
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS memberships CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS kullanicilar CASCADE;
DROP TABLE IF EXISTS roller CASCADE;
DROP TABLE IF EXISTS takimlar CASCADE;
DROP TABLE IF EXISTS takim_uyeleri CASCADE;
DROP TABLE IF EXISTS takim_gorevleri CASCADE;
DROP TABLE IF EXISTS etkinlikler CASCADE;
DROP TABLE IF EXISTS etkinlik_kayitlari CASCADE;
DROP TABLE IF EXISTS yoklamalar CASCADE;
DROP TABLE IF EXISTS sertifikalar CASCADE;
DROP TABLE IF EXISTS butce_kayitlari CASCADE;
DROP TABLE IF EXISTS tutanaklar_kararlar CASCADE;
DROP TABLE IF EXISTS haberler CASCADE;
DROP TABLE IF EXISTS envanter CASCADE;
DROP TABLE IF EXISTS kullanici_notlari CASCADE;
DROP TABLE IF EXISTS projeler CASCADE;
DROP TABLE IF EXISTS sohbet_odalar CASCADE;
DROP TABLE IF EXISTS sohbet_uyeler CASCADE;
DROP TABLE IF EXISTS sohbet_mesajlar CASCADE;
DROP TABLE IF EXISTS sistem_ayarlari CASCADE;
DROP TABLE IF EXISTS guvenlik_engeller CASCADE;
DROP TABLE IF EXISTS soc_olaylar CASCADE;
DROP TABLE IF EXISTS posta_kuyrugu CASCADE;
DROP TABLE IF EXISTS gorev_maddeleri CASCADE;
DROP TABLE IF EXISTS gorev_yorumlari CASCADE;
DROP TABLE IF EXISTS gorev_aktiviteleri CASCADE;
DROP TABLE IF EXISTS proje_begenileri CASCADE;
DROP TABLE IF EXISTS schema_migrations CASCADE;
DROP TABLE IF EXISTS team_task_items CASCADE;
DROP TABLE IF EXISTS team_task_comments CASCADE;
DROP TABLE IF EXISTS team_task_activities CASCADE;
DROP TABLE IF EXISTS committee_meetings CASCADE;
DROP TABLE IF EXISTS project_likes CASCADE;
DROP TABLE IF EXISTS inventory_activities CASCADE;
DROP TABLE IF EXISTS user_note_folders CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS oauth_auth_codes CASCADE;
DROP TABLE IF EXISTS oauth_consents CASCADE;
DROP TABLE IF EXISTS attendances CASCADE;
DROP TABLE IF EXISTS event_registrations CASCADE;

-- 7. CLEAN UP ZOMBIE ROWS
DELETE FROM system_logs WHERE timestamp IS NULL;

COMMIT;

-- ============================================================================
-- VERIFICATION NOTIFICATION
-- ============================================================================
DO $$
DECLARE
    table_count INT;
BEGIN
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    RAISE NOTICE 'Orbit Community OS v3.0 Migration Completed. Total Public Tables: %', table_count;
END $$;
