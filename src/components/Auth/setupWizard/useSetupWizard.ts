import { useState, useEffect, useCallback } from 'react';
import { DEFAULT_ARCHETYPE, type OrganizationArchetype } from '@/lib/archetypes';
import { clearWorkspaceSession } from '@/lib/client/indexedDB';
import type { DetectedCandidate, WizardStep } from './setupTypes';
import { validateWizardStep } from './setupValidators';
import { useSetupUnlock } from './useSetupUnlock';
import {
	createGeneratedDbPassword,
	fetchAutoDetectCandidates,
	fetchInitialSetupProbe,
	redirectHomeOrComplete,
	requestCompleteSetup,
	requestDbTest,
} from './setupApi';

export function useSetupWizard(onComplete: () => void) {
	const [currentStep, setCurrentStep] = useState<WizardStep>(1);
	const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());
	const [loading, setLoading] = useState(false);
	const [testingDb, setTestingDb] = useState(false);
	const [dbTestResult, setDbTestResult] = useState<{ ok: boolean; message: string } | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [launching, setLaunching] = useState(false);

	const [dbUrl, setDbUrl] = useState('');
	const [dbConnected, setDbConnected] = useState(false);
	const [dbName, setDbName] = useState('');
	const [scanningDb, setScanningDb] = useState(false);
	const [detectedCandidates, setDetectedCandidates] = useState<DetectedCandidate[]>([]);
	const [generatedDbPassword] = useState(createGeneratedDbPassword);

	const [archetype, setArchetype] = useState<OrganizationArchetype>(DEFAULT_ARCHETYPE);
	const [studioName, setStudioName] = useState('tetha42');
	const [communityName, setCommunityName] = useState('Orbit Community');
	const [domain, setDomain] = useState('orbit.local');

	const [name, setName] = useState('Orbit');
	const [surname, setSurname] = useState('Admin');
	const [email, setEmail] = useState('admin@orbit.local');
	const [password, setPassword] = useState('');
	const [passwordConfirm, setPasswordConfirm] = useState('');

	const [smtpHost, setSmtpHost] = useState('');
	const [smtpPort, setSmtpPort] = useState('465');
	const [smtpUser, setSmtpUser] = useState('');
	const [smtpPassword, setSmtpPassword] = useState('');
	const [smtpFrom, setSmtpFrom] = useState('');

	const markStepDone = (step: WizardStep) => setCompletedSteps((prev) => new Set(prev).add(step));

	const scanDatabases = useCallback(async () => {
		setScanningDb(true);
		try {
			const candidates = await fetchAutoDetectCandidates();
			setDetectedCandidates(candidates);
			const envCandidate = candidates.find((c) => c.type === 'env');
			if (envCandidate) {
				if (envCandidate.url) setDbUrl((prev) => prev || envCandidate.url || '');
				setDbConnected(true);
				if (envCandidate.dbName) setDbName((prev) => prev || envCandidate.dbName);
				markStepDone(1);
			}
		} catch {
			// Ignore auto-probe failure
		} finally {
			setScanningDb(false);
		}
	}, []);

	const unlock = useSetupUnlock(scanDatabases);

	useEffect(() => {
		fetchInitialSetupProbe()
			.then((probe) => {
				if (!probe) return;
				if (probe.ready) return redirectHomeOrComplete(onComplete);
				if (probe.dbConnected) {
					setDbConnected(true);
					if (probe.dbName) setDbName(probe.dbName);
					markStepDone(1);
				}
				if (probe.brand) {
					if (probe.brand.studioName) setStudioName(probe.brand.studioName);
					if (probe.brand.communityName) setCommunityName(probe.brand.communityName);
					if (probe.brand.domain) setDomain(probe.brand.domain);
					if (probe.brand.archetype) setArchetype(probe.brand.archetype);
				}
			})
			.catch(() => {
				/* Initial probe remains optional until DB is connected */
			});
	}, [onComplete]);

	const runDbProbe = async (
		body: { url: string } | { candidateId: string; type: string } | { useConfigured: true; type: string },
		okFallback: string,
		errFallback: string
	) => {
		setError(null);
		setDbTestResult(null);
		setTestingDb(true);
		try {
			const outcome = await requestDbTest(body, okFallback, errFallback);
			if (outcome.requiresUnlock) {
				unlock.requireUnlock('Setup session expired. Please enter the setup token again.');
				return;
			}
			setDbTestResult({ ok: outcome.ok, message: outcome.message });
			if (outcome.ok) {
				if (outcome.databaseName) setDbName(outcome.databaseName);
				setDbConnected(true);
				markStepDone(1);
				if (outcome.alreadyInitialized) setTimeout(() => redirectHomeOrComplete(onComplete), 900);
			}
		} catch {
			setDbTestResult({ ok: false, message: errFallback });
		} finally {
			setTestingDb(false);
		}
	};

	const handleSelectCandidate = async (candidate: DetectedCandidate) => {
		if (candidate.url) setDbUrl(candidate.url);
		const body = candidate.id
			? { candidateId: candidate.id, type: candidate.type }
			: candidate.url
				? { url: candidate.url }
				: { useConfigured: true as const, type: candidate.type };
		await runDbProbe(body, 'Detected database connected and verified!', 'Connection failed.');
	};

	const handleTestDb = async () => {
		const targetUrl = dbUrl.trim();
		if (!targetUrl) {
			setDbTestResult(null);
			return setError('Please enter a PostgreSQL connection string.');
		}
		await runDbProbe({ url: targetUrl }, 'PostgreSQL connection verified successfully!', 'Connection could not be established.');
	};

	const validateStep = (step: WizardStep): boolean => {
		const err = validateWizardStep(step, { dbConnected, dbUrl, studioName, communityName, domain, name, surname, email, password, passwordConfirm });
		setError(err);
		if (err) return false;
		markStepDone(step);
		return true;
	};

	const goToStep = (target: WizardStep) => {
		if (target < currentStep) {
			setError(null);
			setCurrentStep(target);
		} else if (validateStep(currentStep)) {
			setCurrentStep(target);
		}
	};

	const nextStep = () => {
		if (validateStep(currentStep)) setCurrentStep(Math.min(5, currentStep + 1) as WizardStep);
	};

	const prevStep = () => {
		setError(null);
		setCurrentStep((prev) => Math.max(1, prev - 1) as WizardStep);
	};

	const handleCompleteSetup = async () => {
		setError(null);
		setLoading(true);
		setLaunching(true);
		try {
			const result = await requestCompleteSetup({
				dbUrl: dbUrl.trim() || undefined,
				archetype,
				studioName: studioName.trim(),
				communityName: communityName.trim(),
				domain: domain.trim(),
				name: name.trim(),
				surname: surname.trim(),
				email: email.trim(),
				password,
				smtpHost: smtpHost.trim() || undefined,
				smtpPort: Number(smtpPort) || 465,
				smtpUser: smtpUser.trim() || undefined,
				smtpPassword: smtpPassword || undefined,
				smtpFrom: smtpFrom.trim() || undefined,
			});
			if (!result.ok) {
				if (result.requiresUnlock) {
					setLoading(false);
					setLaunching(false);
					unlock.requireUnlock('Setup session expired. Please enter the setup token again.');
					return;
				}
				setError(result.error);
				setLoading(false);
				setLaunching(false);
				const lower = result.error.toLowerCase();
				if (lower.includes('already complete') || lower.includes('already exists')) {
					setTimeout(() => redirectHomeOrComplete(onComplete), 1000);
				}
				return;
			}
			await clearWorkspaceSession().catch(() => {
				/* IndexedDB cache clear failure is non-fatal during completion */
			});
			markStepDone(5);
			setTimeout(() => redirectHomeOrComplete(onComplete), 1200);
		} catch {
			setError('An error occurred while connecting to the setup endpoint.');
			setLoading(false);
			setLaunching(false);
		}
	};

	return {
		authChecking: unlock.authChecking,
		setupUnlocked: unlock.setupUnlocked,
		unlocking: unlock.unlocking,
		unlockError: unlock.unlockError,
		handleUnlockSetup: unlock.handleUnlockSetup,
		currentStep, completedSteps, loading, testingDb, dbTestResult, error, launching,
		dbUrl, setDbUrl, dbConnected, dbName, scanningDb, detectedCandidates, generatedDbPassword,
		archetype, setArchetype, studioName, setStudioName, communityName, setCommunityName, domain, setDomain,
		name, setName, surname, setSurname, email, setEmail, password, setPassword, passwordConfirm, setPasswordConfirm,
		smtpHost, setSmtpHost, smtpPort, setSmtpPort, smtpUser, setSmtpUser, smtpPassword, setSmtpPassword, smtpFrom, setSmtpFrom,
		scanDatabases, handleSelectCandidate, handleTestDb, goToStep, nextStep, prevStep, handleCompleteSetup,
	};
}
