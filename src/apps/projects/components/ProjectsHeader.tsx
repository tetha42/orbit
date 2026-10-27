import React from 'react';
import { FolderGit2, Plus } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import ui from '@/core/ui/ui.module.css';
import styles from './Projects.module.css';

interface Props {
	manage: boolean;
	countYayinda: number;
	onOpenForm: () => void;
}

export function ProjectsHeader({ manage, countYayinda, onOpenForm }: Props) {
	const { t } = useI18n();

	return (
		<div className={styles.header}>
			<div className={styles.brand}>
				<div className={styles.brandIcon}>
					<FolderGit2 size={21} />
				</div>
				<div>
					<h1 className={styles.title}>{t('pjTitle')}</h1>
					<p className={styles.subtitle}>{fill(t('pjSubtitle'), { n: countYayinda })}</p>
				</div>
			</div>
			<button type="button" className={ui.primaryBtn} onClick={onOpenForm}>
				<Plus size={15} />
				{manage ? t('pjAdd') : t('pjPropose')}
			</button>
		</div>
	);
}
