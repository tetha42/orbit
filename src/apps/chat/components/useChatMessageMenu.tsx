'use client';

import React, { useMemo, useCallback } from 'react';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { useContextMenu } from '@/core/shell';
import { copyToClipboard } from '@/lib/clipboard';
import { Pencil, Trash2, Reply, Forward, Copy } from 'lucide-react';
import type { MenuItem } from '@/types/workspace';
import type { ChatMessageItem } from '../types';

export function useChatMessageMenu({
	msg,
	isMine,
	isAdmin,
	isDeleted,
	onStartEdit,
	onDelete,
	onReply,
	onForward,
}: {
	msg: ChatMessageItem;
	isMine: boolean;
	isAdmin: boolean;
	isDeleted: boolean;
	onStartEdit?: (message: ChatMessageItem) => void;
	onDelete?: (messageId: string) => void;
	onReply?: (message: ChatMessageItem) => void;
	onForward?: (message: ChatMessageItem) => void;
}) {
	const { t } = useI18n();
	const dialog = useDialog();

	const confirmDelete = useCallback(async () => {
		if (!onDelete) return;
		if (await dialog.confirm({ message: t('chatDeleteConfirm'), tone: 'danger' })) {
			onDelete(msg.id);
		}
	}, [dialog, t, onDelete, msg.id]);

	const menuItems = useMemo<MenuItem[]>(() => {
		if (isDeleted) return [];

		const items: MenuItem[] = [
			{
				id: `copy-${msg.id}`,
				label: t('ctxChatCopy'),
				icon: <Copy size={13} />,
				action: () => {
					void copyToClipboard(msg.content);
				},
			},
		];

		if (onReply && !msg.poll) {
			items.push({
				id: `reply-${msg.id}`,
				label: t('ctxChatReply'),
				icon: <Reply size={13} />,
				action: () => onReply(msg),
			});
		}

		if (onForward && !msg.poll) {
			items.push({
				id: `forward-${msg.id}`,
				label: t('ctxChatForward'),
				icon: <Forward size={13} />,
				action: () => onForward(msg),
			});
		}

		if (isMine && !msg.poll && onStartEdit) {
			items.push({
				id: `edit-${msg.id}`,
				label: t('ctxChatEdit'),
				icon: <Pencil size={13} />,
				action: () => onStartEdit(msg),
			});
		}

		if ((isMine || isAdmin) && onDelete) {
			items.push(
				{ id: `sep-${msg.id}`, label: '', separator: true },
				{
					id: `delete-${msg.id}`,
					label: t('ctxChatDelete'),
					icon: <Trash2 size={13} />,
					danger: true,
					action: confirmDelete,
				}
			);
		}

		return items;
	}, [isDeleted, msg, onReply, onForward, isMine, onStartEdit, isAdmin, onDelete, confirmDelete, t]);

	const contextMenuProps = useContextMenu({ items: menuItems, disabled: isDeleted });

	return { contextMenuProps, confirmDelete };
}
