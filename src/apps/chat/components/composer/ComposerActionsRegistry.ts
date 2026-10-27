import type { LucideIcon } from 'lucide-react';
import { BarChart2 } from 'lucide-react';

export interface ComposerActionItem {
	id: string;
	labelKey: string;
	icon: LucideIcon;
	adminOnly?: boolean;
	descriptionKey?: string;
}

export const COMPOSER_ACTIONS: ComposerActionItem[] = [
	{
		id: 'poll',
		labelKey: 'chatCreatePoll',
		descriptionKey: 'chatCreatePollDesc',
		icon: BarChart2,
		adminOnly: true,
	},
];
