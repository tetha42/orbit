'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import { Printer } from 'lucide-react';
import ui from '@/core/ui/ui.module.css';
import { escapeHtml } from '@/core/text/escape';
import { openPrintWindow } from '@/core/data/print';
import { useI18n } from '@/core/i18n';
import s from './Inventory.module.css';
import type { InventoryItem } from '../types';

export function ItemDetailQrBox({ item }: { item: InventoryItem }) {
	const { t } = useI18n();
	const [qr, setQr] = useState('');

	useEffect(() => {
		let live = true;
		QRCode.toDataURL(item.code, { margin: 1, width: 320, errorCorrectionLevel: 'M' }).then(
			(url) => live && setQr(url)
		);
		return () => {
			live = false;
		};
	}, [item.code]);

	const printLabel = () => {
		const labelCss =
			'body{display:grid;place-items:center;min-height:90vh}' +
			'.label{border:1px dashed #999;padding:14px 18px;text-align:center;width:220px}' +
			'.kod{font:700 16px ui-monospace,monospace;margin-top:6px}';
		const labelBody =
			`<div class="label"><img src="${qr}" width="160" height="160" alt="">` +
			`<div class="kod">${escapeHtml(item.code)}</div>` +
			`<div style="font-size:11px;margin-top:4px">${escapeHtml(item.name)}</div>` +
			`<div class="muted" style="font-size:10px;margin-top:2px">${escapeHtml(item.location)}</div></div>`;
		openPrintWindow({
			title: item.code,
			width: 420,
			height: 520,
			css: labelCss,
			body: labelBody,
		});
	};

	return (
		<div className={s.qrBox}>
			{qr ? (
				<Image src={qr} alt={`${item.code} QR`} width={150} height={150} unoptimized />
			) : (
				<div style={{ width: 150, height: 150 }} />
			)}
			<strong style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>{item.code}</strong>
			<button
				type="button"
				className={ui.btn}
				onClick={printLabel}
				disabled={!qr}
				style={{ color: '#111', background: '#f2f2f7' }}
			>
				<Printer size={13} /> {t('invPrintQr')}
			</button>
		</div>
	);
}
