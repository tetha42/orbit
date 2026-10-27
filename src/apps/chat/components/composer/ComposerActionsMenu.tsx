'use client';

import React, { useEffect, useRef } from 'react';
import { useI18n } from '@/core/i18n';
import { COMPOSER_ACTIONS, type ComposerActionItem } from './ComposerActionsRegistry';
import s from '../../Chat.module.css';

interface ComposerActionsMenuProps {
	isOpen: boolean;
	onClose: () => void;
	onSelectAction: (actionId: string) => void;
	isAdmin: boolean;
}

export function ComposerActionsMenu({
	isOpen,
	onClose,
	onSelectAction,
	isAdmin,
}: ComposerActionsMenuProps) {
	const { t } = useI18n();
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onClose();
			}
		};

		const handlePointerDown = (e: PointerEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onClose();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		document.addEventListener('pointerdown', handlePointerDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			document.removeEventListener('pointerdown', handlePointerDown);
		};
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	const availableActions = COMPOSER_ACTIONS.filter((action) => {
		if (action.adminOnly && !isAdmin) return false;
		return true;
	});

	return (
		<div
			ref={menuRef}
			className={s.composerActionsMenu}
			role="menu"
			aria-label={t('chatActionsMenu') || 'Eylemler Menüsü'}
		>
			{availableActions.length === 0 ? (
				<div className={s.composerActionEmpty}>
					{t('chatNoAvailableActions') || 'Kullanılabilir ek eylem yok'}
				</div>
			) : (
				availableActions.map((action: ComposerActionItem) => {
					const Icon = action.icon;
					return (
						<button
							key={action.id}
							type="button"
							className={s.composerActionItem}
							onClick={() => {
								onSelectAction(action.id);
								onClose();
							}}
							role="menuitem"
						>
							<div className={s.composerActionIconWrapper}>
								<Icon size={16} />
							</div>
							<div className={s.composerActionText}>
								<span className={s.composerActionLabel}>{t(action.labelKey)}</span>
								{action.descriptionKey && (
									<span className={s.composerActionDesc}>{t(action.descriptionKey)}</span>
								)}
							</div>
						</button>
					);
				})
			)}
		</div>
	);
}
