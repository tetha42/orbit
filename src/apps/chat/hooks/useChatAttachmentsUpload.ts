'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/core/i18n';
import type { ChatAttachmentItem } from '../types';
import type { VoiceRecorderError } from './useVoiceRecorder';

export function formatVoiceDuration(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins}:${String(secs).padStart(2, '0')}`;
}

interface VoiceController {
	isRecording: boolean;
	error: VoiceRecorderError;
	stop: () => Promise<File | null>;
	cancel: () => Promise<void>;
}

export function useChatAttachmentsUpload({
	roomId,
	isEditing,
	voice,
	onSendMessage,
}: {
	roomId?: string | null;
	isEditing: boolean;
	voice: VoiceController;
	onSendMessage: (text: string, attachments?: ChatAttachmentItem[]) => Promise<boolean>;
}) {
	const { t } = useI18n();
	const [attachments, setAttachments] = useState<ChatAttachmentItem[]>([]);
	const [isUploading, setIsUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const previousRoomRef = useRef(roomId);
	const uploadEpochRef = useRef(0);
	const voiceRef = useRef(voice);

	useEffect(() => {
		voiceRef.current = voice;
	}, [voice]);

	useEffect(() => {
		if (previousRoomRef.current !== roomId) {
			previousRoomRef.current = roomId;
			uploadEpochRef.current += 1;
			setAttachments([]);
			setUploadError(null);
			setIsUploading(false);
			if (voiceRef.current.isRecording) {
				void voiceRef.current.cancel();
			}
		}
	}, [roomId]);

	const isSameUploadContext = (targetRoomId: string | null | undefined, uploadEpoch: number) =>
		uploadEpochRef.current === uploadEpoch && previousRoomRef.current === (targetRoomId ?? null);

	const uploadOne = async (
		file: File,
		targetRoomId: string | null | undefined = roomId
	): Promise<ChatAttachmentItem | null> => {
		if (!targetRoomId) return null;
		const formData = new FormData();
		formData.set('roomId', targetRoomId);
		formData.set('file', file);
		const res = await fetch('/api/chat/upload', { method: 'POST', body: formData });
		const data = await res.json();
		if (!res.ok || !data.ok) {
			throw new Error(data.error || t('chatUploadFailed'));
		}
		return data.attachment as ChatAttachmentItem;
	};

	const uploadFiles = async (files: FileList | null) => {
		const targetRoomId = roomId;
		const uploadEpoch = uploadEpochRef.current;
		if (!files || !targetRoomId || isEditing) return;
		setUploadError(null);
		setIsUploading(true);
		try {
			for (const file of Array.from(files).slice(0, 6)) {
				const attachment = await uploadOne(file, targetRoomId);
				if (!isSameUploadContext(targetRoomId, uploadEpoch)) return;
				if (attachment) setAttachments((previous) => [...previous, attachment]);
			}
		} catch (err) {
			if (isSameUploadContext(targetRoomId, uploadEpoch)) {
				setUploadError(err instanceof Error && err.message ? err.message : t('chatUploadFailed'));
			}
		} finally {
			if (isSameUploadContext(targetRoomId, uploadEpoch)) {
				setIsUploading(false);
			}
			if (fileInputRef.current) fileInputRef.current.value = '';
		}
	};

	const finishVoice = async () => {
		const targetRoomId = roomId;
		const uploadEpoch = uploadEpochRef.current;
		const file = await voice.stop();
		if (!isSameUploadContext(targetRoomId, uploadEpoch)) return;
		if (!file) {
			setUploadError(t('chatVoiceFailed', 'The voice recording could not be created.'));
			return;
		}
		if (!targetRoomId) return;
		setUploadError(null);
		setIsUploading(true);
		try {
			const attachment = await uploadOne(file, targetRoomId);
			if (!isSameUploadContext(targetRoomId, uploadEpoch)) return;
			if (attachment) {
				const ok = await onSendMessage('', [attachment]);
				if (!ok && isSameUploadContext(targetRoomId, uploadEpoch)) {
					setAttachments((previous) => [...previous, attachment]);
				}
			}
		} catch (err) {
			if (isSameUploadContext(targetRoomId, uploadEpoch)) {
				setUploadError(err instanceof Error && err.message ? err.message : t('chatUploadFailed'));
			}
		} finally {
			if (isSameUploadContext(targetRoomId, uploadEpoch)) {
				setIsUploading(false);
			}
		}
	};

	const removeAttachment = (index: number) => {
		setAttachments((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
	};

	const clearAttachments = () => setAttachments([]);

	const voiceError =
		voice.error === 'insecure'
			? t('chatVoiceInsecureContext')
			: voice.error === 'unsupported'
				? t('chatVoiceUnsupported')
				: voice.error === 'permission'
					? t('chatVoicePermission')
					: voice.error === 'not_found'
						? t('chatVoiceNotFound')
						: voice.error === 'in_use'
							? t('chatVoiceInUse')
							: voice.error === 'failed'
								? t('chatVoiceFailed')
								: null;

	return {
		attachments,
		isUploading,
		uploadError,
		fileInputRef,
		uploadFiles,
		finishVoice,
		removeAttachment,
		clearAttachments,
		voiceError,
	};
}
