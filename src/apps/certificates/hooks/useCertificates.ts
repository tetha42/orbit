'use client';

import { useState } from 'react';
import { useSession } from '@/core/session';
import { useSound } from '@/core/sound';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { useJsonResource } from '@/core/data/useJsonResource';
import { useFocusTarget } from '@/lib/client/useFocusTarget';
import { fill } from '@/lib/text';
import { seviye } from '@/lib/profile';
import type { KulupBilgileri } from '@/db';
import type { Certificate, MemberRankItem } from '../types';

export function useCertificates() {
	const { currentUserId, currentUser, canManageApp, canUseApp } = useSession();
	const { t, language } = useI18n();
	const { playSystemSound } = useSound();
	const dialog = useDialog();
	const isManager = canManageApp('certificates');

	const { data: certificatesData, refetch: fetchCerts } = useJsonResource<Certificate[]>('/api/certificates');
	const certificates = certificatesData ?? [];
	const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
	const [copied, setCopied] = useState(false);
	const [activeTab, setActiveTab] = useState<'certificates' | 'all' | 'leaderboard'>('certificates');
	const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

	const [isIssuing, setIsIssuing] = useState(false);
	const [issueUserId, setIssueUserId] = useState('');
	const [issueBaslik, setIssueBaslik] = useState(t('certsPresetTeknofest'));
	const [issueEtkinlikId, setIssueEtkinlikId] = useState('');
	const [issueCategory, setIssueCategory] = useState<'achievement' | 'participation' | 'service' | 'honor'>('achievement');
	const [issueLang, setIssueLang] = useState<'tr' | 'en'>('tr');
	const [issueContext, setIssueContext] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	const { data: eventsData } = useJsonResource<{ etkinlikler: Array<{ id: string; baslik: string; katilimciSayisi: number }> }>('/api/events');
	const events = eventsData?.etkinlikler ?? [];
	const { data: kulup, refetch: refetchKulup } = useJsonResource<KulupBilgileri>('/api/community');
	const [editingSignatories, setEditingSignatories] = useState(false);
	const [issueMode, setIssueMode] = useState<'single' | 'bulk'>('single');
	const verifyUrl = (kod: string) => (typeof window === 'undefined' ? `/dogrula/${kod}` : `${window.location.origin}/dogrula/${kod}`);

	const { data: uyelerData } = useJsonResource<{
		members: MemberRankItem[];
	}>(canUseApp('members') ? '/api/members' : null);
	const members = uyelerData?.members ?? [];
	const topMembers = [...members].sort((a, b) => (b.xp || 0) - (a.xp || 0)).slice(0, 10);

	const myCerts = certificates.filter((c) => c.userId === currentUserId);
	const displayedCerts = activeTab === 'all' && isManager ? certificates : myCerts;

	useFocusTarget('certificates', {
		ready: certificatesData !== null,
		apply: (target) => setActiveTab(isManager && target.section === 'all' ? 'all' : 'certificates'),
		refetch: fetchCerts,
	});

	const handleCopyVerification = (kod: string) => {
		const url = `${window.location.origin}/dogrula/${kod}`;
		navigator.clipboard.writeText(url);
		setCopied(true);
		playSystemSound();
		setTimeout(() => setCopied(false), 2500);
	};

	const handleAddToLinkedIn = (cert: Certificate) => {
		const certDate = new Date(cert.verilisTarihi);
		const year = certDate.getFullYear();
		const month = certDate.getMonth() + 1;
		const certUrl = `${window.location.origin}/dogrula/${cert.verificationCode}`;
		const linkedInUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(cert.baslik)}&organizationName=${encodeURIComponent(t('newsShareClubSuffix'))}&issueYear=${year}&issueMonth=${month}&certUrl=${encodeURIComponent(certUrl)}&certId=${encodeURIComponent(cert.verificationCode)}`;
		window.open(linkedInUrl, '_blank', 'noopener,noreferrer');
	};

	const handleIssueCertificate = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!issueBaslik.trim()) return;
		if (issueMode === 'single' ? !issueUserId : !issueEtkinlikId) return;

		try {
			setIsSubmitting(true);
			const res = await fetch('/api/certificates', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(
					issueMode === 'bulk'
						? {
								action: 'bulk',
								etkinlikId: issueEtkinlikId,
								baslik: issueBaslik.trim(),
								kategori: issueCategory,
								dil: issueLang,
								aciklama: issueContext.trim() || undefined,
						  }
						: {
								userId: issueUserId,
								baslik: issueBaslik.trim(),
								etkinlikId: issueEtkinlikId || undefined,
								kategori: issueCategory,
								dil: issueLang,
								aciklama: issueContext.trim() || undefined,
						  }
				),
			});

			const data = await res.json();
			if (res.ok) {
				playSystemSound();
				setMessage({ text: data.message || t('certsCreatedToast'), type: 'success' });
				setIsIssuing(false);
				setIssueUserId('');
				await fetchCerts();
			} else {
				setMessage({ text: data.error || t('certsCreateFailed'), type: 'error' });
			}
		} catch {
			setMessage({ text: t('connError'), type: 'error' });
		} finally {
			setIsSubmitting(false);
			setTimeout(() => setMessage(null), 4000);
		}
	};

	const handleRevokeCertificate = async (cert: Certificate) => {
		const confirmed = await dialog.confirm({
			message: fill(t('certsRevokeConfirmMsg'), { title: cert.baslik, code: cert.verificationCode }),
			tone: 'danger',
			confirmLabel: t('dlgRevoke'),
		});
		if (!confirmed) return;
		try {
			const res = await fetch(`/api/certificates?id=${cert.id}`, { method: 'DELETE' });
			const data = await res.json();
			if (res.ok) {
				playSystemSound();
				setMessage({ text: t('certsRevokedToast'), type: 'success' });
				if (selectedCert?.id === cert.id) setSelectedCert(null);
				await fetchCerts();
			} else {
				setMessage({ text: data.error || t('actionFailed'), type: 'error' });
			}
		} catch {
			setMessage({ text: t('connError'), type: 'error' });
		} finally {
			setTimeout(() => setMessage(null), 4000);
		}
	};

	const userXP = Number(currentUser?.xp) || 0;
	const level = seviye(userXP);
	const userLevel = level.seviye;

	return {
		currentUserId,
		currentUser,
		isManager,
		certificates,
		myCerts,
		displayedCerts,
		selectedCert,
		setSelectedCert,
		copied,
		activeTab,
		setActiveTab,
		message,
		isIssuing,
		setIsIssuing,
		issueUserId,
		setIssueUserId,
		issueBaslik,
		setIssueBaslik,
		issueEtkinlikId,
		setIssueEtkinlikId,
		issueCategory,
		setIssueCategory,
		issueLang,
		setIssueLang,
		issueContext,
		setIssueContext,
		isSubmitting,
		events,
		kulup: kulup ?? null,
		refetchKulup,
		editingSignatories,
		setEditingSignatories,
		issueMode,
		setIssueMode,
		verifyUrl,
		members,
		topMembers,
		userXP,
		userLevel,
		level,
		handleCopyVerification,
		handleAddToLinkedIn,
		handleIssueCertificate,
		handleRevokeCertificate,
		t,
		language,
	};
}
