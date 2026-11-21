'use client';

import { useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { optionLabel, type FormFieldOption } from '@/lib/formFields';
import { CompactField } from '../AuthControls';
import styles from '../AuthPortal.module.css';

interface RegisterTrackPickerProps {
	label: string;
	placeholder: string;
	options: FormFieldOption[];
	value: string;
	isOpen: boolean;
	onToggleOpen: () => void;
	onClose: () => void;
	onSelect: (value: string) => void;
}

export function RegisterTrackPicker({
	label,
	placeholder,
	options,
	value,
	isOpen,
	onToggleOpen,
	onClose,
	onSelect,
}: RegisterTrackPickerProps) {
	const { t, language } = useI18n();
	const [trackSearch, setTrackSearch] = useState('');

	const selectedTrack = options.find((option) => option.value === value);
	const filteredOptions = options.filter((option) => {
		const query = trackSearch.trim().toLowerCase();
		if (!query) return true;
		return (
			option.labelTr.toLowerCase().includes(query) ||
			option.labelEn.toLowerCase().includes(query) ||
			option.value.toLowerCase().includes(query)
		);
	});

	return (
		<div className={styles.fieldGrow}>
			<CompactField label={label}>
				<div style={{ position: 'relative', width: '100%' }}>
					<button
						type="button"
						onClick={onToggleOpen}
						className={styles.select}
						style={{
							width: '100%',
							minHeight: '38px',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							textAlign: 'left',
							cursor: 'pointer',
						}}
					>
						<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
							{selectedTrack ? optionLabel(selectedTrack, language) : placeholder}
						</span>
						<ChevronDown size={14} style={{ marginLeft: '8px', flexShrink: 0 }} />
					</button>

					{isOpen && (
						<>
							<div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
							<div
								tabIndex={0}
								onWheel={(e) => {
									const target = e.currentTarget as HTMLElement;
									target.scrollTop += e.deltaY;
								}}
								style={{
									position: 'absolute',
									top: 'calc(100% + 4px)',
									left: 0,
									right: 0,
									zIndex: 999,
									backgroundColor: '#111113',
									borderRadius: '8px',
									border: '1px solid #27272a',
									padding: '6px',
									display: 'flex',
									flexDirection: 'column',
									gap: '6px',
									maxHeight: '260px',
									overflowY: 'auto',
								}}
							>
								<div
									style={{
										display: 'flex',
										alignItems: 'center',
										padding: '6px 8px',
										backgroundColor: '#09090b',
										borderRadius: '6px',
										border: '1px solid #27272a',
									}}
								>
									<Search size={13} style={{ color: '#a1a1aa', marginRight: '6px', flexShrink: 0 }} />
									<input
										type="text"
										placeholder={t('authTrackSearchPh', 'Search track...')}
										value={trackSearch}
										onChange={(e) => setTrackSearch(e.target.value)}
										style={{
											width: '100%',
											backgroundColor: 'transparent',
											fontSize: '11.5px',
											color: '#fafafa',
											outline: 'none',
											border: 'none',
										}}
										autoFocus
									/>
								</div>
								<div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
									{filteredOptions.map((option) => (
										<button
											key={option.value}
											type="button"
											onClick={() => {
												onSelect(option.value);
												onClose();
												setTrackSearch('');
											}}
											style={{
												width: '100%',
												textAlign: 'left',
												padding: '6px 8px',
												borderRadius: '6px',
												fontSize: '11.5px',
												border: 'none',
												cursor: 'pointer',
												display: 'flex',
												flexDirection: 'column',
												gap: '1px',
												backgroundColor: value === option.value ? '#fafafa' : 'transparent',
												color: value === option.value ? '#09090b' : '#d4d4d8',
											}}
										>
											<span
												style={{
													fontWeight: 600,
													overflow: 'hidden',
													textOverflow: 'ellipsis',
													whiteSpace: 'nowrap',
												}}
											>
												{optionLabel(option, language)}
											</span>
										</button>
									))}
								</div>
							</div>
						</>
					)}
				</div>
			</CompactField>
		</div>
	);
}
