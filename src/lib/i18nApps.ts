/**
 * Mini-app UI translations extracted from inline ternaries across `src/apps/**`.
 * Every key in `tr` must have a matching non-empty entry in `en`.
 */
export const APP_TRANSLATIONS = {
	tr: {
		chatMobileRoomsBack: 'Sohbetler',
		identityChangesImmediateHint: 'Değişiklikler tüm sayfalara anında yansır.',
		formPreviewEditingBadge: 'Düzenleniyor',
	},
	en: {
		chatMobileRoomsBack: 'Chats',
		identityChangesImmediateHint: 'Changes apply across all pages immediately.',
		formPreviewEditingBadge: 'Editing',
	},
} as const;
