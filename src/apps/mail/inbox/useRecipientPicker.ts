'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { MailRecipient } from '@/lib/messages';

interface UseRecipientPickerArgs {
	initialRecipientId?: string | null;
	onPrefillFocus?: () => void;
}

export function useRecipientPicker({ initialRecipientId, onPrefillFocus }: UseRecipientPickerArgs) {
	const [query, setQuery] = useState('');
	const [options, setOptions] = useState<MailRecipient[]>([]);
	const [isSuggestion, setIsSuggestion] = useState(false);
	const [loadedQuery, setLoadedQuery] = useState<string | null>(null);
	const [recipients, setRecipients] = useState<MailRecipient[]>([]);
	const [activeIndex, setActiveIndex] = useState(-1);
	const requestId = useRef(0);
	const onPrefillFocusRef = useRef(onPrefillFocus);

	useEffect(() => {
		onPrefillFocusRef.current = onPrefillFocus;
	});

	useEffect(() => {
		if (!initialRecipientId) return;
		let cancelled = false;
		fetch(`/api/messages/recipients?id=${encodeURIComponent(initialRecipientId)}`, { cache: 'no-store' })
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (cancelled) return;
				const list = Array.isArray(data?.recipients) ? (data.recipients as MailRecipient[]) : [];
				const found = list.find((item) => item.id === initialRecipientId && item.reachable);
				if (found) {
					setRecipients((cur) => (cur.some((r) => r.id === found.id) ? cur : [...cur, found]));
					onPrefillFocusRef.current?.();
				}
			})
			.catch(() => null);
		return () => {
			cancelled = true;
		};
	}, [initialRecipientId]);

	useEffect(() => {
		const trimmed = query.trim();
		const handle = setTimeout(() => {
			const req = ++requestId.current;
			fetch(`/api/messages/recipients?q=${encodeURIComponent(trimmed)}`, { cache: 'no-store' })
				.then((res) => (res.ok ? res.json() : null))
				.then((data) => {
					if (req !== requestId.current) return;
					setOptions(Array.isArray(data?.recipients) ? data.recipients : []);
					setIsSuggestion(Boolean(data?.suggestion));
					setLoadedQuery(trimmed);
				})
				.catch(() => {
					if (req !== requestId.current) return;
					setOptions([]);
					setIsSuggestion(false);
					setLoadedQuery(trimmed);
				});
		}, 140);
		return () => clearTimeout(handle);
	}, [query]);

	const visibleOptions = useMemo(
		() => options.filter((o) => !recipients.some((r) => r.id === o.id)),
		[options, recipients]
	);

	const selectableIndices = useMemo(
		() => visibleOptions.map((o, i) => (o.reachable ? i : -1)).filter((i) => i >= 0),
		[visibleOptions]
	);

	useEffect(() => {
		setActiveIndex(selectableIndices.length > 0 ? selectableIndices[0] : -1);
	}, [selectableIndices]);

	const addRecipient = useCallback((person: MailRecipient) => {
		if (!person.reachable) return;
		setRecipients((current) => (current.some((r) => r.id === person.id) ? current : [...current, person]));
		setQuery('');
	}, []);

	const removeRecipient = useCallback((id: string) => {
		setRecipients((current) => current.filter((r) => r.id !== id));
	}, []);

	const onInputKeyDown = useCallback(
		(e: KeyboardEvent<HTMLInputElement>) => {
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				if (selectableIndices.length === 0) return;
				e.preventDefault();
				const pos = selectableIndices.indexOf(activeIndex);
				const step = e.key === 'ArrowDown' ? 1 : -1;
				const nextPos = pos < 0 ? 0 : (pos + step + selectableIndices.length) % selectableIndices.length;
				setActiveIndex(selectableIndices[nextPos]);
				return;
			}
			if (e.key === 'Enter' && activeIndex >= 0) {
				const selected = visibleOptions[activeIndex];
				if (selected?.reachable) {
					e.preventDefault();
					addRecipient(selected);
				}
				return;
			}
			if (e.key === 'Backspace' && !query && recipients.length > 0) {
				e.preventDefault();
				setRecipients((current) => current.slice(0, -1));
			}
		},
		[activeIndex, addRecipient, query, recipients.length, selectableIndices, visibleOptions]
	);

	const trimmedQuery = query.trim();
	const showEmpty = Boolean(trimmedQuery && loadedQuery === trimmedQuery && visibleOptions.length === 0);

	return {
		query,
		setQuery,
		recipients,
		visibleOptions,
		isSuggestion: !trimmedQuery && isSuggestion && visibleOptions.length > 0,
		showEmpty,
		activeIndex,
		addRecipient,
		removeRecipient,
		onInputKeyDown,
	};
}
