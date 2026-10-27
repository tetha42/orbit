/**
 * Which app each notification belongs to, and the level needed to receive it —
 * declared by the apps' manifests (`notifications`).
 * The server filters every notification through this table, so a member gets
 * exactly the notifications of the apps their role opens: an admin gets them
 * all, a role that only reads news gets only news. Pure.
 */
import { ALL_MANIFESTS, type NotificationKind, type YetkiUygulamasi } from '../../apps/index.ts';
import type { Seviye } from '../permissions/index.ts';

export const BILDIRIM_TURLERI = Object.fromEntries(
	ALL_MANIFESTS.flatMap((m) => Object.entries(m.notifications ?? {}).map(([kind, seviye]) => [kind, { appId: m.id, seviye }]))
) as Record<NotificationKind, { appId: YetkiUygulamasi; seviye: Seviye }>;
