'use client';

/**
 * Host-level federated mini-app embeds.
 *
 * Mini-apps under `src/apps/<appA>/` must never import directly from another
 * mini-app `src/apps/<appB>/`. Cross-app embeddable surfaces are mediated
 * through this top-level registry bridge (`@/apps/embeds`).
 */
export { TeamChatEmbed } from '@/apps/chat/components/TeamChatEmbed';
export { VaultPanel, type VaultPanelProps } from '@/apps/budget/components/VaultPanel';
