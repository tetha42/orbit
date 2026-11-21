import {
    type ArchetypePreset,
    DEFAULT_ARCHETYPE,
    type OrganizationArchetype,
    ORGANIZATION_ARCHETYPES,
} from './i18n/data/archetypes/types.ts';
import { ACADEMIC_CLUB_PRESET, DAO_COLLECTIVE_PRESET } from './i18n/data/archetypes/academicAndDao.ts';
import { PROFESSIONAL_GUILD_PRESET, RESEARCH_LAB_PRESET } from './i18n/data/archetypes/researchAndGuild.ts';

export type {
    OrganizationArchetype,
    ArchetypeUnitCategory,
    ArchetypePreset,
} from './i18n/data/archetypes/types.ts';
export { DEFAULT_ARCHETYPE, ORGANIZATION_ARCHETYPES } from './i18n/data/archetypes/types.ts';

export const ARCHETYPE_PRESETS: Record<OrganizationArchetype, ArchetypePreset> = {
    academic_club: ACADEMIC_CLUB_PRESET,
    dao_collective: DAO_COLLECTIVE_PRESET,
    research_lab: RESEARCH_LAB_PRESET,
    professional_guild: PROFESSIONAL_GUILD_PRESET,
};

export function isOrganizationArchetype(value: unknown): value is OrganizationArchetype {
    return (
        typeof value === 'string' &&
        (ORGANIZATION_ARCHETYPES as readonly string[]).includes(value)
    );
}

export function getArchetypePreset(archetype?: string | null): ArchetypePreset {
    if (archetype && isOrganizationArchetype(archetype)) {
        return ARCHETYPE_PRESETS[archetype];
    }
    return ARCHETYPE_PRESETS[DEFAULT_ARCHETYPE];
}
