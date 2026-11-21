'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import s from '../../Database.module.css';

interface DatabaseGridPaginationProps {
	page: number;
	totalPages: number;
	totalRows: number;
	pageSize: number;
	isLoading: boolean;
	onPageChange: (newPage: number) => void;
	onPageSizeChange: (newPageSize: number) => void;
}

export function DatabaseGridPagination({
	page,
	totalPages,
	totalRows,
	pageSize,
	isLoading,
	onPageChange,
	onPageSizeChange,
}: DatabaseGridPaginationProps) {
	const { t } = useI18n();
	const [pageJump, setPageJump] = useState<string>('');
	const from = (page - 1) * pageSize + 1;
	const to = Math.min(page * pageSize, totalRows);

	const commitPageJump = () => {
		const num = parseInt(pageJump, 10);
		if (!isNaN(num) && num >= 1 && num <= totalPages && num !== page) {
			onPageChange(num);
		}
		setPageJump('');
	};

	return (
		<div className={s.paginationBar}>
			<div className={s.paginationInfo}>
				<span>
					{totalRows > 0
						? fill(t('dbPaginationShowing'), { total: totalRows.toLocaleString(), from, to })
						: t('dbNoRecords')}
				</span>
				<span style={{ opacity: 0.3 }}>|</span>
				<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
					<span>{t('dbRowsPerPage')}</span>
					<select
						className={s.pageSizeSelect}
						value={pageSize}
						onChange={(e) => onPageSizeChange(Number(e.target.value))}
						disabled={isLoading}
					>
						{[25, 50, 100, 250, 500].map((n) => (
							<option key={n} value={n}>
								{fill(t('dbRowsOption'), { n })}
							</option>
						))}
					</select>
				</div>
			</div>

			<div className={s.paginationControls}>
				<button
					type="button"
					className={s.pageBtn}
					disabled={page <= 1 || isLoading}
					onClick={() => onPageChange(1)}
					title={t('dbFirstPage')}
				>
					<ChevronsLeft size={13} />
				</button>

				<button
					type="button"
					className={s.pageBtn}
					disabled={page <= 1 || isLoading}
					onClick={() => onPageChange(page - 1)}
					title={t('dbPrev')}
				>
					<ChevronLeft size={13} />
				</button>

				<div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '0 4px', fontSize: 11.5 }}>
					<span>{t('dbPage')}</span>
					<input
						type="text"
						className={s.pageJumpInput}
						value={pageJump !== '' ? pageJump : page}
						onChange={(e) => setPageJump(e.target.value.replace(/\D/g, ''))}
						onBlur={commitPageJump}
						onKeyDown={(e) => {
							if (e.key === 'Enter') commitPageJump();
						}}
					/>
					<span>/ {totalPages || 1}</span>
				</div>

				<button
					type="button"
					className={s.pageBtn}
					disabled={page >= totalPages || isLoading}
					onClick={() => onPageChange(page + 1)}
					title={t('dbNext')}
				>
					<ChevronRight size={13} />
				</button>

				<button
					type="button"
					className={s.pageBtn}
					disabled={page >= totalPages || isLoading}
					onClick={() => onPageChange(totalPages)}
					title={t('dbLastPage')}
				>
					<ChevronsRight size={13} />
				</button>
			</div>
		</div>
	);
}
