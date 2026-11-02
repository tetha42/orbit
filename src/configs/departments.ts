// Orbit Community OS — Community Tracks & Experience Levels
export interface DepartmentItem {
	id: string;
	name: string;
	faculty: string;
	type: string;
}

export interface ExperienceLevelItem {
	value: number;
	label: string;
}

export const DEPARTMENTS: DepartmentItem[] = [
	{ id: 'software-engineering', name: 'Software Engineering & Architecture', faculty: 'Engineering & Systems', type: 'Track' },
	{ id: 'cybersecurity-defense', name: 'Cybersecurity & Defense', faculty: 'Security & Operations', type: 'Track' },
	{ id: 'ai-data-science', name: 'Artificial Intelligence & Data Science', faculty: 'Data & Intelligence', type: 'Track' },
	{ id: 'cloud-devops', name: 'Cloud & DevOps Infrastructure', faculty: 'Platform & Reliability', type: 'Track' },
	{ id: 'hardware-iot-robotics', name: 'Hardware, IoT & Robotics', faculty: 'Embedded & Robotics', type: 'Track' },
	{ id: 'product-design-uiux', name: 'Product Design & UI/UX', faculty: 'Design & Experience', type: 'Track' },
	{ id: 'community-ops-growth', name: 'Community Operations & Growth', faculty: 'Governance & Growth', type: 'Track' },
	{ id: 'open-source-research', name: 'Open Source & Research', faculty: 'Research & Standards', type: 'Track' },
];

export const EXPERIENCE_LEVELS: ExperienceLevelItem[] = [
	{ value: 1, label: 'Core Member' },
	{ value: 2, label: 'Contributor' },
	{ value: 3, label: 'Maintainer' },
	{ value: 4, label: 'Track Lead' },
	{ value: 5, label: 'Mentor / Advisor' },
	{ value: 6, label: 'Alumni / Fellow' },
];

export const BOLUMLER: string[] = DEPARTMENTS.map((d) => d.name);
export const SINIFLAR: ExperienceLevelItem[] = EXPERIENCE_LEVELS;
