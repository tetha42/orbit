import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { useIdentity } from '@/core/identity';
import { useSound } from '@/core/sound';
import {
	DEFAULT_ARCHETYPE,
	isOrganizationArchetype,
	type OrganizationArchetype,
} from '@/lib/archetypes';
import { errorMessage } from '@/lib/errors';

export interface CommunityStatusMessage {
	text: string;
	type: 'success' | 'error';
}

export function useCommunitySettings() {
	const { t } = useI18n();
	const tRef = useRef(t);
	useEffect(() => {
		tRef.current = t;
	}, [t]);
	const { identity, refreshIdentity } = useIdentity();
	const { playSystemSound } = useSound();

	const [siteName, setSiteName] = useState('');
	const [shortName, setShortName] = useState('');
	const [descriptionTr, setDescriptionTr] = useState('');
	const [descriptionEn, setDescriptionEn] = useState('');
	const [domain, setDomain] = useState('');
	const [archetype, setArchetype] = useState<OrganizationArchetype>(DEFAULT_ARCHETYPE);
	const [signature1Name, setSignature1Name] = useState('');
	const [signature1Rank, setSignature1Rank] = useState('');
	const [signature2Name, setSignature2Name] = useState('');
	const [signature2Rank, setSignature2Rank] = useState('');
	const [iconUrl, setIconUrl] = useState<string | null>(identity.iconUrl);
	const [iconBusy, setIconBusy] = useState(false);

	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [status, setStatus] = useState<CommunityStatusMessage | null>(null);

	useEffect(() => {
		let cancelled = false;
		const loadSettings = async () => {
			try {
				const [idRes, comRes] = await Promise.all([
					fetch('/api/settings/identity', { cache: 'no-store' }),
					fetch('/api/settings/community', { cache: 'no-store' }),
				]);
				if (cancelled) return;
				if (idRes.ok) {
					const idData = await idRes.json();
					const site = idData.identity;
					if (site) {
						setSiteName(site.siteName || '');
						setShortName(site.siteShortName || '');
						setDescriptionTr(site.descriptionTr || '');
						setDescriptionEn(site.descriptionEn || '');
						setIconUrl(site.iconUrl ?? null);
					}
				}
				if (comRes.ok) {
					const communityData = await comRes.json();
					setDomain(communityData.clubDomain || '');
					if (isOrganizationArchetype(communityData.archetype)) {
						setArchetype(communityData.archetype);
					}
					setSignature1Name(communityData.signature1Name || '');
					setSignature1Rank(communityData.signature1Rank || '');
					setSignature2Name(communityData.signature2Name || '');
					setSignature2Rank(communityData.signature2Rank || '');
				}
			} catch (error: unknown) {
				if (!cancelled) {
					setStatus({
						text: errorMessage(error, tRef.current('identitySaveFailed')),
						type: 'error',
					});
				}
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		};
		void loadSettings();
		return () => {
			cancelled = true;
		};
	}, []);

	const uploadIcon = async (file: File) => {
		if (iconBusy || isSaving) return;
		setIconBusy(true);
		setStatus(null);
		try {
			const form = new FormData();
			form.append('file', file);
			const res = await fetch('/api/settings/identity/icon', {
				method: 'POST',
				body: form,
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || t('identityIconUploadFailed'));
			setIconUrl(data.iconUrl ?? null);
			await refreshIdentity();
			playSystemSound();
			setStatus({ text: t('identityIconSaved'), type: 'success' });
		} catch (error: unknown) {
			setStatus({
				text: errorMessage(error, t('identityIconUploadFailed')),
				type: 'error',
			});
		} finally {
			setIconBusy(false);
		}
	};

	const removeIcon = async () => {
		if (iconBusy || isSaving) return;
		setIconBusy(true);
		setStatus(null);
		try {
			const res = await fetch('/api/settings/identity/icon', { method: 'DELETE' });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || t('identityIconRemoveFailed'));
			setIconUrl(null);
			await refreshIdentity();
			playSystemSound();
			setStatus({ text: t('identityIconRemoved'), type: 'success' });
		} catch (error: unknown) {
			setStatus({
				text: errorMessage(error, t('identityIconRemoveFailed')),
				type: 'error',
			});
		} finally {
			setIconBusy(false);
		}
	};

	const handleSave = async (event: React.FormEvent) => {
		event.preventDefault();
		if (isSaving || iconBusy) return;
		setIsSaving(true);
		setStatus(null);
		try {
			const idRes = await fetch('/api/settings/identity', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					siteName,
					shortName,
					descriptionTr,
					descriptionEn,
				}),
			});
			const idData = await idRes.json();
			if (!idRes.ok) throw new Error(idData.error || t('identitySaveFailed'));

			const comRes = await fetch('/api/settings/community', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					clubDomain: domain,
					archetype,
					signature1Name,
					signature1Rank,
					signature2Name,
					signature2Rank,
				}),
			});
			const comData = await comRes.json();
			if (!comRes.ok) throw new Error(comData.error || t('identitySaveFailed'));

			await refreshIdentity();
			playSystemSound();
			setStatus({ text: t('identitySaveSuccess'), type: 'success' });
		} catch (error: unknown) {
			setStatus({
				text: errorMessage(error, t('identitySaveFailed')),
				type: 'error',
			});
		} finally {
			setIsSaving(false);
		}
	};

	return {
		identity,
		siteName,
		setSiteName,
		shortName,
		setShortName,
		descriptionTr,
		setDescriptionTr,
		descriptionEn,
		setDescriptionEn,
		domain,
		setDomain,
		archetype,
		setArchetype,
		signature1Name,
		setSignature1Name,
		signature1Rank,
		setSignature1Rank,
		signature2Name,
		setSignature2Name,
		signature2Rank,
		setSignature2Rank,
		iconUrl,
		iconBusy,
		isLoading,
		isSaving,
		status,
		uploadIcon,
		removeIcon,
		handleSave,
	};
}
