import {
	FileText,
	ListChecks,
	UserRound,
	UserPlus,
	Users,
	Image as ImageIcon,
	Sparkles,
	Globe,
	ShieldAlert,
	ShieldCheck,
	KeyRound,
	Mail,
	Network,
	Building2,
	type LucideIcon,
} from 'lucide-react';
import type { SettingsTabId } from '@/configs/settings.config';

export interface SettingMeta {
	bg: string;
	icon: LucideIcon;
}

export const IOS_SETTING_META: Record<SettingsTabId, SettingMeta> = {
	account: { bg: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, var(--contrast-dark)))', icon: UserRound },
	wallpaper: { bg: 'linear-gradient(135deg, var(--cyan), color-mix(in srgb, var(--cyan) 70%, var(--contrast-dark)))', icon: ImageIcon },
	appearance: { bg: 'linear-gradient(135deg, var(--indigo), color-mix(in srgb, var(--indigo) 65%, var(--contrast-dark)))', icon: Sparkles },
	language: { bg: 'linear-gradient(135deg, var(--warning), color-mix(in srgb, var(--warning) 75%, var(--contrast-dark)))', icon: Globe },
	security: { bg: 'linear-gradient(135deg, var(--success), color-mix(in srgb, var(--success) 75%, var(--contrast-dark)))', icon: ShieldCheck },
	community: { bg: 'linear-gradient(135deg, var(--indigo), color-mix(in srgb, var(--indigo) 72%, var(--contrast-dark)))', icon: Building2 },
	membership: { bg: 'linear-gradient(135deg, var(--info), color-mix(in srgb, var(--info) 70%, var(--contrast-dark)))', icon: UserPlus },
	legal: { bg: 'linear-gradient(135deg, var(--info), color-mix(in srgb, var(--info) 70%, var(--contrast-dark)))', icon: FileText },
	forms: { bg: 'linear-gradient(135deg, var(--success), color-mix(in srgb, var(--success) 75%, var(--contrast-dark)))', icon: ListChecks },
	teams: { bg: 'linear-gradient(135deg, var(--info), color-mix(in srgb, var(--info) 70%, var(--contrast-dark)))', icon: Users },
	roles: { bg: 'linear-gradient(135deg, var(--danger), color-mix(in srgb, var(--danger) 75%, var(--contrast-dark)))', icon: KeyRound },
	privacy: { bg: 'linear-gradient(135deg, var(--danger), color-mix(in srgb, var(--danger) 55%, var(--contrast-dark)))', icon: ShieldAlert },
	smtp: { bg: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, var(--contrast-dark)))', icon: Mail },
	integrations: { bg: 'linear-gradient(135deg, var(--purple), color-mix(in srgb, var(--purple) 70%, var(--contrast-dark)))', icon: Network },
};
