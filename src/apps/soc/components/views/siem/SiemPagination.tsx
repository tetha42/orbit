'use client';

import React from 'react';
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';
import { fill } from '@/lib/text';
import type { SIEM_I18N } from './i18nSiem';
import s from '../../../SocSiem.module.css';

interface SiemPaginationProps {
	siemPage: number;
	siemLimit: number;
	siemTotalCount: number;
	siemTotalPages: number;
	pageJump: string;
	setPageJump: (val: string) => void;
	copy: (typeof SIEM_I18N)['en'] | (typeof SIEM_I18N)['tr'];
	onLimitChange: (limit: number) => void;
	onPageChange: (page: number) => void;
	onPageJumpSubmit: () => void;
}

export function SiemPagination({
	siemPage,
	siemLimit,
	siemTotalCount,
	siemTotalPages,
	pageJump,
	setPageJump,
	copy,
	onLimitChange,
	onPageChange,
	onPageJumpSubmit,
}: SiemPaginationProps) {
	const from = Math.min(siemTotalCount, (siemPage - 1) * siemLimit + 1);
	const to = Math.min(siemTotalCount, siemPage * siemLimit);

	return (
		<div className={s.siemPaginationBar}>
			<div className={s.siemPaginationInfo}>
				<span>{copy.rowsPerPage}</span>
				<select
					className={s.siemPageSelect}
					value={siemLimit}
					onChange={(e) => onLimitChange(Number(e.target.value))}
				>
					<option value={25}>25</option>
					<option value={50}>50</option>
					<option value={100}>100</option>
					<option value={250}>250</option>
					<option value={500}>500</option>
				</select>
				<span style={{ marginLeft: 8 }}>
					{fill(copy.showingRange, {
						from,
						to,
						total: siemTotalCount.toLocaleString(),
					})}
				</span>
			</div>

			<div className={s.siemPaginationControls}>
				<button
					type="button"
					className={s.siemPageBtn}
					disabled={siemPage <= 1}
					onClick={() => onPageChange(1)}
					title={copy.firstPage}
				>
					<ChevronsLeft size={14} />
				</button>
				<button
					type="button"
					className={s.siemPageBtn}
					disabled={siemPage <= 1}
					onClick={() => onPageChange(siemPage - 1)}
					title={copy.prevPage}
				>
					<ChevronLeft size={14} />
				</button>

				<span style={{ margin: '0 6px', fontSize: 11.5, color: 'var(--text-secondary)' }}>
					{copy.pageLabel} <strong style={{ color: 'var(--text-primary)' }}>{siemPage}</strong> /{' '}
					{siemTotalPages || 1}
				</span>

				<button
					type="button"
					className={s.siemPageBtn}
					disabled={siemPage >= siemTotalPages}
					onClick={() => onPageChange(siemPage + 1)}
					title={copy.nextPage}
				>
					<ChevronRight size={14} />
				</button>
				<button
					type="button"
					className={s.siemPageBtn}
					disabled={siemPage >= siemTotalPages}
					onClick={() => onPageChange(siemTotalPages)}
					title={copy.lastPage}
				>
					<ChevronsRight size={14} />
				</button>

				<div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 10 }}>
					<span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{copy.goToLabel}</span>
					<input
						type="number"
						min={1}
						max={siemTotalPages || 1}
						className={s.siemPageJumpInput}
						value={pageJump}
						placeholder={String(siemPage)}
						onChange={(e) => setPageJump(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') onPageJumpSubmit();
						}}
					/>
				</div>
			</div>
		</div>
	);
}
