import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

export type CertificateCategory = 'achievement' | 'participation' | 'service' | 'honor';

export interface CertificatePDFData {
	kullaniciAdSoyad: string;
	baslik: string;
	verificationCode: string;
	verilisTarihi: number;
	/** University line, club name and the two signatories, from `/api/kulup`. */
	universite: string;
	kulupAdi: string;
	imzalar: { ad: string; unvan: string }[];
	/** Absolute verification address, e.g. `https://portal.example.org/dogrula/BEU-2026-K7QM-3XRA`. */
	dogrulamaUrl: string;
	/** Category of certificate for specific styling and titling. */
	category?: CertificateCategory;
	/** Language of output PDF ('tr' | 'en'). Defaults to 'tr'. */
	lang?: 'tr' | 'en';
	/** Custom context description line. */
	customContext?: string;
}

const FONT = 'DejaVuSerif';

/**
 * The PDF's built-in fonts only cover Latin-1, so Ş, Ğ, İ and ı came out wrong
 * and every Turkish string had to be written without them. A Unicode TrueType
 * font (DejaVu Serif, free licence, served from /fonts/pdf) is fetched once,
 * when the first certificate is generated.
 */
let fontData: Promise<[string, string]> | null = null;

async function toBase64(url: string): Promise<string> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`font ${url}: ${res.status}`);
	const bytes = new Uint8Array(await res.arrayBuffer());
	let binary = '';
	for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(binary);
}

function loadFonts(): Promise<[string, string]> {
	fontData ??= Promise.all([toBase64('/fonts/pdf/DejaVuSerif.ttf'), toBase64('/fonts/pdf/DejaVuSerif-Bold.ttf')]).catch((err) => {
		fontData = null; // let the next attempt retry
		throw err;
	});
	return fontData;
}

export async function generateCertificatePDF(data: CertificatePDFData): Promise<void> {
	const [regular, bold] = await loadFonts();
	// A4 Landscape: 297mm x 210mm
	const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
	doc.addFileToVFS('DejaVuSerif.ttf', regular);
	doc.addFont('DejaVuSerif.ttf', FONT, 'normal');
	doc.addFileToVFS('DejaVuSerif-Bold.ttf', bold);
	doc.addFont('DejaVuSerif-Bold.ttf', FONT, 'bold');

	const width = 297;
	const height = 210;
	const center = width / 2;
	const tr = (s: string) => s.toLocaleUpperCase('tr-TR');

	// Background (ivory) and a gold double border
	doc.setFillColor(253, 251, 247);
	doc.rect(0, 0, width, height, 'F');
	doc.setDrawColor(212, 175, 55);
	doc.setLineWidth(2);
	doc.rect(10, 10, width - 20, height - 20);
	doc.setLineWidth(0.6);
	doc.rect(13, 13, width - 26, height - 26);

	// Institution
	doc.setFont(FONT, 'bold');
	doc.setFontSize(14);
	doc.setTextColor(184, 134, 11);
	doc.text(tr(data.universite), center, 28, { align: 'center' });
	doc.setFont(FONT, 'normal');
	doc.setFontSize(11);
	doc.setTextColor(80, 80, 80);
	doc.text(tr(data.kulupAdi), center, 35, { align: 'center' });

	const isEn = data.lang === 'en';
	const category = data.category || 'achievement';

	// Category Header & Subheader titles
	let mainTitle = 'BAŞARI VE KATILIM SERTİFİKASI';
	let givenToText = 'Bu belge, aşağıdaki programı başarıyla tamamlayan öğrencimize verilmiştir:';
	let completionText = 'programındaki çalışmaları başarı ve gayretle tamamlamıştır.';

	if (isEn) {
		if (category === 'achievement') {
			mainTitle = 'CERTIFICATE OF ACHIEVEMENT';
			givenToText = 'This certificate is proudly presented to:';
			completionText = 'for outstanding performance and high distinction in the program.';
		} else if (category === 'service') {
			mainTitle = 'CERTIFICATE OF OUTSTANDING SERVICE';
			givenToText = 'This certificate of service is awarded to:';
			completionText = 'in recognition of dedicated contributions and distinguished leadership.';
		} else if (category === 'honor') {
			mainTitle = 'CERTIFICATE OF HONOR';
			givenToText = 'This certificate of honor is proudly bestowed upon:';
			completionText = 'for exemplary dedication and honorable service to the organization.';
		} else {
			mainTitle = 'CERTIFICATE OF PARTICIPATION';
			givenToText = 'This certificate is awarded to:';
			completionText = 'for successful active participation in the program.';
		}
	} else {
		if (category === 'achievement') {
			mainTitle = 'ÜSTÜN BAŞARI BELGESİ';
			givenToText = 'Bu belge, üstün gayret ve başarı gösteren üyemize verilmiştir:';
			completionText = 'programındaki çalışmaları üstün başarı ve gayretle tamamlamıştır.';
		} else if (category === 'service') {
			mainTitle = 'ÜSTÜN HİZMET BELGESİ';
			givenToText = 'Bu belge, topluluğumuza değerli katkılarından dolayı üyemize takdim edilmiştir:';
			completionText = 'topluluk yönetimindeki özverili çalışmaları ve liderliği ile değer katmıştır.';
		} else if (category === 'honor') {
			mainTitle = 'ONUR BELGESİ';
			givenToText = 'Bu belge, topluluğumuzun örnek temsilcisi olan üyemize verilmiştir:';
			completionText = 'örnek duruşu ve teknoloji geliştirme süreçlerindeki üstün çabası takdir edilmiştir.';
		} else {
			mainTitle = 'KATILIM VE BAŞARI SERTİFİKASI';
			givenToText = 'Bu belge, aşağıdaki programı başarıyla tamamlayan üyemize verilmiştir:';
			completionText = 'programındaki çalışmaları başarı ve gayretle tamamlamıştır.';
		}
	}

	if (data.customContext?.trim()) {
		completionText = data.customContext.trim();
	}

	// Title
	doc.setFont(FONT, 'bold');
	doc.setFontSize(24);
	doc.setTextColor(139, 101, 8);
	doc.text(mainTitle, center, 54, { align: 'center' });
	doc.setDrawColor(212, 175, 55);
	doc.setLineWidth(0.8);
	doc.line(65, 58, width - 65, 58);

	doc.setFont(FONT, 'normal');
	doc.setFontSize(12);
	doc.setTextColor(100, 100, 100);
	doc.text(givenToText, center, 70, { align: 'center' });

	// Recipient
	doc.setFont(FONT, 'bold');
	doc.setFontSize(24);
	doc.setTextColor(20, 20, 20);
	doc.text(isEn ? data.kullaniciAdSoyad.toUpperCase() : tr(data.kullaniciAdSoyad), center, 88, { align: 'center' });
	doc.setDrawColor(212, 175, 55);
	doc.setLineWidth(0.5);
	doc.line(80, 92, width - 80, 92);

	// Programme — long titles wrap rather than run off the page
	doc.setFont(FONT, 'normal');
	doc.setFontSize(13);
	doc.setTextColor(50, 50, 50);
	const titleLines: string[] = doc.splitTextToSize(`“${data.baslik}”`, 200);
	doc.text(titleLines, center, 104, { align: 'center' });
	const afterTitle = 104 + (titleLines.length - 1) * 6;
	doc.setFontSize(11);
	doc.setTextColor(80, 80, 80);
	doc.text(completionText, center, afterTitle + 9, { align: 'center' });

	doc.setFontSize(10);
	doc.setTextColor(120, 120, 120);
	const dateStr = isEn
		? `Date: ${new Date(data.verilisTarihi).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`
		: `Veriliş tarihi: ${new Date(data.verilisTarihi).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
	doc.text(dateStr, center, afterTitle + 20, {
		align: 'center',
	});

	// Signatures
	const ySign = 170;
	const signature = (x: number, imza: { ad: string; unvan: string } | undefined) => {
		if (!imza) return;
		doc.setDrawColor(180, 180, 180);
		doc.setLineWidth(0.3);
		doc.line(x - 28, ySign - 5, x + 28, ySign - 5);
		if (imza.ad) {
			doc.setFont(FONT, 'bold');
			doc.setFontSize(12);
			doc.setTextColor(30, 30, 30);
			doc.text(imza.ad, x, ySign, { align: 'center' });
		}
		doc.setFont(FONT, 'normal');
		doc.setFontSize(10);
		doc.setTextColor(100, 100, 100);
		doc.text(imza.unvan, x, imza.ad ? ySign + 6 : ySign, { align: 'center' });
	};
	signature(60, data.imzalar[0]);
	signature(width - 60, data.imzalar[1]);

	// Verification: a scannable code and the human-readable one
	const qr = await QRCode.toDataURL(data.dogrulamaUrl, { margin: 0, width: 240, errorCorrectionLevel: 'M' });
	doc.addImage(qr, 'PNG', center - 13, ySign - 24, 26, 26);
	doc.setFont(FONT, 'bold');
	doc.setFontSize(9.5);
	doc.setTextColor(50, 50, 50);
	doc.text(data.verificationCode, center, ySign + 7, { align: 'center' });
	doc.setFont(FONT, 'normal');
	doc.setFontSize(7.5);
	doc.setTextColor(120, 120, 120);
	doc.text(data.dogrulamaUrl.replace(/^https?:\/\//, ''), center, ySign + 12, { align: 'center' });

	doc.save(`Sertifika_${data.verificationCode}.pdf`);
}
