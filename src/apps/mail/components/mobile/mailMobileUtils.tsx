'use client';

import React from 'react';
import {
	Inbox,
	Star,
	Send as SendIcon,
	FileText,
	Trash2,
	AlertOctagon,
	Folder as FolderIcon,
} from 'lucide-react';
import type { MailFolderInfo } from '../../types';

export function getFolderIcon(role: MailFolderInfo['role']) {
	switch (role) {
		case 'inbox':
			return <Inbox size={17} color="var(--accent)" />;
		case 'starred':
			return <Star size={17} color="var(--warning)" fill="var(--warning)" />;
		case 'sent':
			return <SendIcon size={17} color="var(--accent)" />;
		case 'drafts':
			return <FileText size={17} color="var(--text-muted)" />;
		case 'trash':
			return <Trash2 size={17} color="var(--danger)" />;
		case 'spam':
			return <AlertOctagon size={17} color="var(--warning)" />;
		default:
			return <FolderIcon size={17} color="var(--text-secondary)" />;
	}
}

export function buildIframeSrcDoc(messageHtml: string, loadRemoteImages: boolean, hasRemoteImages: boolean): string {
	if (!messageHtml) return '';
	let processed = messageHtml;
	if (!loadRemoteImages && hasRemoteImages) {
		processed = processed.replace(
			/<img([^>]*?)src=(["'])(https?:\/\/[^"']+)\2/gi,
			'<img$1data-blocked-src=$2$3$2 style="display:none !important;"'
		);
	}
	processed = processed.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

	return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<base target="_blank" rel="noopener noreferrer" />
<style>
  html, body {
    margin: 0;
    padding: 14px 16px;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
    font-size: 13.5px;
    line-height: 1.5;
    color: #1c1c1e;
    background: #ffffff;
    word-wrap: break-word;
    overflow-x: auto;
  }
  img { max-width: 100% !important; height: auto !important; }
  a { color: var(--accent); text-decoration: none; }
  pre { white-space: pre-wrap; word-break: break-word; }
  table { max-width: 100% !important; }
</style>
</head>
<body>${processed}</body>
</html>`;
}
