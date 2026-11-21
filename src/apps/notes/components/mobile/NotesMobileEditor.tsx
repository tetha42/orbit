'use client';

import React, { useState } from 'react';
import { ImagePlus, Loader2, Eye, Edit3, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSound } from '@/core/sound';
import notesContract from '../../notes.contract.json';
import { useNoteImageUpload } from '../../hooks/useNoteImageUpload';
import type { AppleNote, NoteColors } from '../../types';
import { NoteMarkdownPreview } from '../NoteMarkdownPreview';
import { NotesMobileHeader, NotesMobileFormatBar } from './NotesMobileToolbar';

interface NotesMobileEditorProps {
	activeNote: AppleNote;
	syncStatus: 'saved' | 'saving' | 'offline';
	colors: NoteColors;
	titleInputRef: React.RefObject<HTMLInputElement | null>;
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
	onBack: () => void;
	onDeleteNote: (id: string) => void;
	onTogglePin: (id: string) => void;
	onUpdateTitle: (title: string) => void;
	onUpdateBody: (body: string) => void;
}

export function NotesMobileEditor({
	activeNote,
	syncStatus,
	colors,
	titleInputRef,
	textareaRef,
	onBack,
	onDeleteNote,
	onTogglePin,
	onUpdateTitle,
	onUpdateBody,
}: NotesMobileEditorProps) {
	const { t } = useI18n();
	const { playSystemSound } = useSound();
	const [preview, setPreview] = useState(false);
	const {
		fileInputRef, isUploading, uploadError, clearUploadError,
		openFilePicker, handleFileInputChange, handlePaste, handleDragOver, handleDragLeave, handleDrop,
	} = useNoteImageUpload({ activeNote, syncStatus, textareaRef, onUpdateBody });

	const insertMarkdown = (prefix: string, suffix = '') => {
		playSystemSound();
		const el = textareaRef.current;
		if (!el) {
			onUpdateBody(`${activeNote.body}${prefix}${suffix}`);
			return;
		}
		const start = el.selectionStart;
		const end = el.selectionEnd;
		const selected = activeNote.body.substring(start, end);
		const newBody = activeNote.body.substring(0, start) + `${prefix}${selected}${suffix}` + activeNote.body.substring(end);
		onUpdateBody(newBody);
		setTimeout(() => {
			el.focus();
			el.setSelectionRange(start + prefix.length, end + prefix.length);
		}, 30);
	};

	const toggleChecklist = (lineIndex: number) => {
		const lines = activeNote.body.split('\n');
		const line = lines[lineIndex];
		if (!line) return;
		if (line.includes('- [ ]')) lines[lineIndex] = line.replace('- [ ]', '- [x]');
		else if (line.includes('- [x]')) lines[lineIndex] = line.replace('- [x]', '- [ ]');
		onUpdateBody(lines.join('\n'));
	};

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				height: '100%',
				width: '100%',
				background: colors.editorBg,
				color: colors.editorText,
				overflow: 'hidden',
			}}
		>
			<NotesMobileHeader
				activeNote={activeNote}
				syncStatus={syncStatus}
				colors={colors}
				playSound={playSystemSound}
				onBack={onBack}
				onDeleteNote={onDeleteNote}
				onTogglePin={onTogglePin}
			/>

			<div style={{ padding: '16px 16px 8px 16px' }}>
				<input
					ref={titleInputRef}
					type="text"
					placeholder={t('notesTitleInputPlaceholder')}
					value={activeNote.title}
					onChange={(e) => onUpdateTitle(e.target.value)}
					style={{
						width: '100%',
						background: 'transparent',
						border: 'none',
						outline: 'none',
						color: colors.editorTitleText,
						fontSize: '22px',
						fontWeight: 700,
						lineHeight: 1.25,
					}}
				/>
			</div>

			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '16px', borderBottom: `1px solid ${colors.borderSubtle}` }}>
				<div style={{ flex: 1 }}>
					<NotesMobileFormatBar colors={colors} onInsertMarkdown={insertMarkdown} />
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
					{!activeNote.isDeleted && !preview && (
						<>
							<input
								ref={fileInputRef}
								type="file"
								accept="image/png,image/jpeg,image/webp,image/gif"
								onChange={handleFileInputChange}
								style={{ display: 'none' }}
							/>
							<button
								type="button"
								onClick={openFilePicker}
								disabled={isUploading}
								title={t('notesUploadImage')}
								style={{
									background: 'rgba(255, 255, 255, 0.06)',
									border: 'none',
									borderRadius: '6px',
									padding: '5px 8px',
									color: 'inherit',
									cursor: 'pointer',
									display: 'inline-flex',
									alignItems: 'center',
								}}
							>
								{isUploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
							</button>
						</>
					)}
					<button
						type="button"
						onClick={() => setPreview((v) => !v)}
						title={preview ? t('notesEditMode') : t('notesPreviewMode')}
						style={{
							background: 'rgba(255, 255, 255, 0.06)',
							border: 'none',
							borderRadius: '6px',
							padding: '5px 8px',
							color: 'inherit',
							cursor: 'pointer',
							display: 'inline-flex',
							alignItems: 'center',
						}}
					>
						{preview ? <Edit3 size={14} /> : <Eye size={14} />}
					</button>
				</div>
			</div>

			{uploadError && (
				<div
					style={{
						margin: '8px 16px 0',
						padding: '6px 10px',
						borderRadius: '7px',
						fontSize: '12px',
						color: 'var(--danger)',
						background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						gap: '8px',
					}}
				>
					<span>{uploadError}</span>
					<button type="button" onClick={clearUploadError} style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', padding: 0 }}>
						<X size={13} />
					</button>
				</div>
			)}

			<div
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				style={{ flex: 1, minHeight: 0, padding: '12px 16px 24px 16px', display: 'flex', overflowY: 'auto' }}
			>
				{preview ? (
					<div style={{ width: '100%' }}>
						<NoteMarkdownPreview body={activeNote.body} colors={colors} onToggleChecklistItem={toggleChecklist} />
					</div>
				) : (
					<textarea
						ref={textareaRef}
						placeholder={t('notesBodyInputPlaceholder')}
						value={activeNote.body}
						maxLength={notesContract.limits.maxNoteLength}
						onChange={(e) => onUpdateBody(e.target.value)}
						onPaste={handlePaste}
						style={{
							flex: 1,
							width: '100%',
							background: 'transparent',
							border: 'none',
							outline: 'none',
							resize: 'none',
							color: colors.editorText,
							fontSize: '15px',
							lineHeight: 1.6,
							fontFamily: 'inherit',
						}}
					/>
				)}
			</div>
		</div>
	);
}
