export type OrganizationArchetype =
    | 'academic_club'
    | 'dao_collective'
    | 'research_lab'
    | 'professional_guild';

export interface ArchetypeUnitCategory {
    key: string;
    labelEn: string;
    labelTr: string;
}

export interface ArchetypePreset {
    id: OrganizationArchetype;
    name: { en: string; tr: string };
    description: { en: string; tr: string };
    parentEntityLabel: { en: string; tr: string };
    handleLabel: { en: string; tr: string };
    trackLabel: { en: string; tr: string };
    levelLabel: { en: string; tr: string };
    unitLabel: { en: string; tr: string };
    governanceLabel: { en: string; tr: string };
    defaultTracks: string[];
    defaultLevels: string[];
    defaultUnitCategories: ArchetypeUnitCategory[];
}

export const DEFAULT_ARCHETYPE: OrganizationArchetype = 'academic_club';

export const ORGANIZATION_ARCHETYPES: readonly OrganizationArchetype[] = [
    'academic_club',
    'dao_collective',
    'research_lab',
    'professional_guild',
] as const;
