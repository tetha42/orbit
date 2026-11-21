export interface FirstRunSetupWizardProps {
	onComplete: () => void;
}

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export interface DetectedCandidate {
	id?: string;
	url?: string;
	label: string;
	host: string;
	dbName: string;
	type: string;
}

export interface StepMeta {
	number: WizardStep;
	navTitle: string;
	navSubtitle: string;
	title: string;
	description: string;
	nextLabel: string;
}

export const STEP_METAS: Record<WizardStep, StepMeta> = {
	1: {
		number: 1,
		navTitle: 'Database Engine',
		navSubtitle: 'PostgreSQL instance & auto-detect',
		title: 'Configure Database Engine',
		description:
			'Orbit Community OS requires a PostgreSQL instance. Connect to a local container, Docker Compose network, or baremetal host. Zero external config files are required.',
		nextLabel: 'Next: Workspace Identity',
	},
	2: {
		number: 2,
		navTitle: 'Workspace Identity',
		navSubtitle: 'Studio, community & domain routing',
		title: 'Customize Workspace & Domain Identity',
		description:
			'Define your studio entity, community workspace name, and public domain for reverse proxy routing. Settings are persisted directly to system_settings.',
		nextLabel: 'Next: Root Administrator',
	},
	3: {
		number: 3,
		navTitle: 'Root Administrator',
		navSubtitle: 'Initial superuser account credentials',
		title: 'Create Root Administrator Account',
		description:
			'Set up the primary superuser account to manage community members, role permissions, and autonomous cybersecurity defense policies.',
		nextLabel: 'Next: Outbound Mail (SMTP)',
	},
	4: {
		number: 4,
		navTitle: 'Outbound Mail (SMTP)',
		navSubtitle: 'Email relay & notification alerts',
		title: 'Configure Outbound Mail Services',
		description:
			'Set up an optional SMTP relay for automated verification emails, notifications, and password resets. You can skip this step and configure it later.',
		nextLabel: 'Next: Review & Launch',
	},
	5: {
		number: 5,
		navTitle: 'Review & Launch',
		navSubtitle: 'Verify parameters & bootstrap workspace',
		title: 'Review & Initialize Workspace',
		description:
			'All installation parameters are validated. Initializing will provision the PostgreSQL database schema and launch Orbit Community OS.',
		nextLabel: 'Initialize & Launch Orbit OS',
	},
};
