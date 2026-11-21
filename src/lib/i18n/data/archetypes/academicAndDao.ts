import type { ArchetypePreset } from './types.ts';

export const ACADEMIC_CLUB_PRESET: ArchetypePreset = {
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
};

export const DAO_COLLECTIVE_PRESET: ArchetypePreset = {
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
};
