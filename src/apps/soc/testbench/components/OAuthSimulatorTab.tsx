'use client';

import React from 'react';
import type { OAuthSimulateResult, OAuthClientOption } from '../types';
import { OAuthConfigCard } from './OAuthConfigCard';
import { OAuthFlowTrace } from './OAuthFlowTrace';
import { OAuthTokenInspectorCard } from './OAuthTokenInspectorCard';

interface OAuthSimulatorTabProps {
	clients: OAuthClientOption[];
	selectedClientId: string;
	onSelectClientId: (id: string) => void;
	selectedScopes: string[];
	onToggleScope: (scope: string) => void;
	oauthLoading: boolean;
	oauthResult: OAuthSimulateResult | null;
	onRunSimulation: () => void;
	tokenInput: string;
	onTokenInputChange: (val: string) => void;
	inspectResult: {
		valid: boolean;
		payload: Record<string, unknown> | null;
		error: string | null;
	} | null;
	isInspecting: boolean;
	onInspectToken: (token?: string) => void;
}

export function OAuthSimulatorTab({
	clients,
	selectedClientId,
	onSelectClientId,
	selectedScopes,
	onToggleScope,
	oauthLoading,
	oauthResult,
	onRunSimulation,
	tokenInput,
	onTokenInputChange,
	inspectResult,
	isInspecting,
	onInspectToken,
}: OAuthSimulatorTabProps) {
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
			<OAuthConfigCard
				clients={clients}
				selectedClientId={selectedClientId}
				onSelectClientId={onSelectClientId}
				selectedScopes={selectedScopes}
				onToggleScope={onToggleScope}
				oauthLoading={oauthLoading}
				oauthResult={oauthResult}
				onRunSimulation={onRunSimulation}
			/>

			{oauthResult && <OAuthFlowTrace oauthResult={oauthResult} />}

			<OAuthTokenInspectorCard
				tokenInput={tokenInput}
				onTokenInputChange={onTokenInputChange}
				simulatedAccessToken={oauthResult?.tokenResponse?.access_token}
				inspectResult={inspectResult}
				isInspecting={isInspecting}
				onInspectToken={onInspectToken}
			/>
		</div>
	);
}
