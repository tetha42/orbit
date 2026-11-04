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

export const ARCHETYPE_PRESETS: Record<OrganizationArchetype, ArchetypePreset> = {
    academic_club: {
        id: 'academic_club',
        name: {
            en: 'Academic Club / Student Society',
            tr: 'Akademik Kulüp / Öğrenci Topluluğu',
        },
        description: {
            en: 'University student societies, IEEE branches, robotics clubs, and campus organizations.',
            tr: 'Üniversite öğrenci toplulukları, IEEE kolları, robotik kulüpleri ve kampüs organizasyonları.',
        },
        parentEntityLabel: {
            en: 'Faculty / School',
            tr: 'Fakülte / Yüksekokul',
        },
        handleLabel: {
            en: 'Student ID',
            tr: 'Öğrenci No',
        },
        trackLabel: {
            en: 'Department / Major',
            tr: 'Bölüm / Program',
        },
        levelLabel: {
            en: 'Academic Year',
            tr: 'Sınıf / Akademik Yıl',
        },
        unitLabel: {
            en: 'Team / Committee',
            tr: 'Takım / Komite',
        },
        governanceLabel: {
            en: 'Board Decisions',
            tr: 'Yönetim Kurulu Kararları',
        },
        defaultTracks: [
            'Computer Engineering',
            'Electrical & Electronics Engineering',
            'Mechanical Engineering',
            'Industrial Engineering',
            'Software Engineering',
            'Business Administration',
            'Industrial Design',
        ],
        defaultLevels: [
            'Prep',
            '1st Year',
            '2nd Year',
            '3rd Year',
            '4th Year',
            'Graduate (MSc)',
            'Doctorate (PhD)',
            'Alumni',
        ],
        defaultUnitCategories: [
            { key: 'technical', labelEn: 'Technical Team', labelTr: 'Teknik Takım' },
            { key: 'committee', labelEn: 'Committee', labelTr: 'Komite' },
            { key: 'operations', labelEn: 'Operations & Coordination', labelTr: 'Operasyon ve Koordinasyon' },
            { key: 'media', labelEn: 'Media & Communications', labelTr: 'Medya ve İletişim' },
        ],
    },
    dao_collective: {
        id: 'dao_collective',
        name: {
            en: 'DAO / Web3 Collective',
            tr: 'DAO / Web3 Kolektifi',
        },
        description: {
            en: 'Decentralized autonomous organizations, open-source collectives, protocol guilds, and digital cooperatives.',
            tr: 'Merkeziyetsiz otonom organizasyonlar, açık kaynak kolektifleri, protokol loncaları ve dijital kooperatifler.',
        },
        parentEntityLabel: {
            en: 'Ecosystem / Network',
            tr: 'Ekosistem / Ağ',
        },
        handleLabel: {
            en: 'Wallet / ENS / Handle',
            tr: 'Cüzdan / ENS / Kullanıcı Adı',
        },
        trackLabel: {
            en: 'Discipline / Guild Track',
            tr: 'Disiplin / Uzmanlık Alanı',
        },
        levelLabel: {
            en: 'Contributor Tier',
            tr: 'Katkıcı Seviyesi',
        },
        unitLabel: {
            en: 'Pod / Working Group',
            tr: 'Çalışma Grubu / Pod',
        },
        governanceLabel: {
            en: 'Governance Proposals (DIPs)',
            tr: 'Yönetişim Önerileri',
        },
        defaultTracks: [
            'Protocol Engineering',
            'Smart Contracts & Security',
            'Tokenomics & Treasury',
            'Governance & Operations',
            'Community & Growth',
            'Design & Product',
        ],
        defaultLevels: [
            'Explorer',
            'Contributor',
            'Core Contributor',
            'Steward',
            'Council Member',
        ],
        defaultUnitCategories: [
            { key: 'working_group', labelEn: 'Working Group', labelTr: 'Çalışma Grubu' },
            { key: 'pod', labelEn: 'Execution Pod', labelTr: 'Uygulama Podu' },
            { key: 'council', labelEn: 'Steward Council', labelTr: 'Temsilci Konseyi' },
            { key: 'treasury', labelEn: 'Treasury & Grants', labelTr: 'Hazine ve Hibeler' },
        ],
    },
    research_lab: {
        id: 'research_lab',
        name: {
            en: 'Research Lab / Institute',
            tr: 'Araştırma Laboratuvarı / Enstitü',
        },
        description: {
            en: 'Academic and independent research laboratories, R&D centers, and scientific think tanks.',
            tr: 'Akademik ve bağımsız araştırma laboratuvarları, Ar-Ge merkezleri ve bilimsel düşünce kuruluşları.',
        },
        parentEntityLabel: {
            en: 'Institute / Division',
            tr: 'Enstitü / Bölüm',
        },
        handleLabel: {
            en: 'ORCID / Researcher ID',
            tr: 'ORCID / Araştırmacı No',
        },
        trackLabel: {
            en: 'Research Stream',
            tr: 'Araştırma Alanı',
        },
        levelLabel: {
            en: 'Academic Rank / Fellowship',
            tr: 'Akademik Unvan / Kıdem',
        },
        unitLabel: {
            en: 'Research Group / Lab Unit',
            tr: 'Araştırma Grubu / Birim',
        },
        governanceLabel: {
            en: 'Scientific Board Protocols',
            tr: 'Bilim Kurulu Protokolleri',
        },
        defaultTracks: [
            'Artificial Intelligence & ML',
            'Autonomous Systems & Robotics',
            'Quantum Computing',
            'Bioengineering & Computational Biology',
            'Human-Computer Interaction',
            'Systems & Networking',
        ],
        defaultLevels: [
            'Undergraduate Researcher',
            'Graduate Researcher (MSc)',
            'Doctoral Fellow (PhD)',
            'Postdoctoral Researcher',
            'Senior Research Scientist',
            'Principal Investigator (PI)',
        ],
        defaultUnitCategories: [
            { key: 'research_group', labelEn: 'Research Group', labelTr: 'Araştırma Grubu' },
            { key: 'facility', labelEn: 'Lab Facility & Equipment', labelTr: 'Laboratuvar Altyapısı' },
            { key: 'ethics_board', labelEn: 'Review & Ethics Committee', labelTr: 'Etik ve İnceleme Kurulu' },
            { key: 'publications', labelEn: 'Publications & Grants', labelTr: 'Yayınlar ve Projeler' },
        ],
    },
    professional_guild: {
        id: 'professional_guild',
        name: {
            en: 'Professional Guild / NGO / Association',
            tr: 'Meslek Birliği / STK / Dernek',
        },
        description: {
            en: 'Professional associations, foundations, non-governmental organizations, and industry chapters.',
            tr: 'Meslek odaları, vakıflar, sivil toplum kuruluşları, dernekler ve sektör temsilcilikleri.',
        },
        parentEntityLabel: {
            en: 'Chapter / Region',
            tr: 'Şube / Bölge',
        },
        handleLabel: {
            en: 'Member Registry ID',
            tr: 'Üye Sicil No',
        },
        trackLabel: {
            en: 'Practice Area / Sector',
            tr: 'Uzmanlık / Sektör',
        },
        levelLabel: {
            en: 'Seniority / Membership Tier',
            tr: 'Kıdem / Üyelik Kademesi',
        },
        unitLabel: {
            en: 'Commission / Chapter Unit',
            tr: 'Komisyon / Çalışma Birimi',
        },
        governanceLabel: {
            en: 'General Assembly & Board Resolutions',
            tr: 'Genel Kurul ve Yönetim Kararları',
        },
        defaultTracks: [
            'Engineering & Technology',
            'Law & Policy',
            'Finance & Economics',
            'Design & Architecture',
            'Social Impact & Sustainability',
            'Education & Mentorship',
        ],
        defaultLevels: [
            'Associate Member',
            'Full Member',
            'Senior Fellow',
            'Committee Chair',
            'Board Member',
            'Honorary Member',
        ],
        defaultUnitCategories: [
            { key: 'commission', labelEn: 'Standing Commission', labelTr: 'Uzmanlık Komisyonu' },
            { key: 'chapter', labelEn: 'Regional Chapter', labelTr: 'Bölge Temsilciliği' },
            { key: 'board', labelEn: 'Executive & Supervisory Board', labelTr: 'Yönetim ve Denetim Kurulu' },
            { key: 'events', labelEn: 'Events & Public Relations', labelTr: 'Etkinlik ve Halkla İlişkiler' },
        ],
    },
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
