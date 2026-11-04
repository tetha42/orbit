/**
 * Which app each notification belongs to, and the level needed to receive it —
 * declared by the apps' manifests (`notifications`).
 * The server filters every notification through this table, so a member gets
 * exactly the notifications of the apps their role opens: an admin gets them
 * all, a role that only reads news gets only news. Pure.
 */
import { ALL_MANIFESTS, type NotificationKind, type PermissionApp } from '../../apps/index.ts';
import type { Level } from '../permissions/index.ts';

export const NOTIFICATION_KINDS = Object.fromEntries(
	ALL_MANIFESTS.flatMap((m) => Object.entries(m.notifications ?? {}).map(([kind, level]) => [kind, { appId: m.id, level }]))
) as Record<NotificationKind, { appId: PermissionApp; level: Level }>;
