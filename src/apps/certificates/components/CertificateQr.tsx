'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';

/** A real, scannable QR for the certificate's public verification page. */
export function CertificateQr({ url, size = 72 }: { url: string; size?: number }) {
	const [src, setSrc] = useState('');
	useEffect(() => {
		let live = true;
		QRCode.toDataURL(url, { margin: 0, width: size * 3, errorCorrectionLevel: 'M' }).then((d) => live && setSrc(d));
		return () => {
			live = false;
		};
	}, [url, size]);
	return src ? (
		<Image src={src} alt="" width={size} height={size} unoptimized data-verify-url={url} style={{ borderRadius: 4 }} />
	) : (
		<div style={{ width: size, height: size }} />
	);
}
