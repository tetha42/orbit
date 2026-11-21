import type { ArchetypePreset } from './types.ts';

export const RESEARCH_LAB_PRESET: ArchetypePreset = {
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
};

export const PROFESSIONAL_GUILD_PRESET: ArchetypePreset = {
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
};
