'use client';

import React from 'react';
import { useFormDesigner } from './formDesigner/useFormDesigner';
import { FieldListSidebar } from './formDesigner/FieldListSidebar';
import { FieldEditorPane } from './formDesigner/FieldEditorPane';
import { FieldPreviewPane } from './formDesigner/FieldPreviewPane';
import { FormDesignerHeader } from './formDesigner/FormDesignerHeader';

export function FormDesignerPanel() {
	const state = useFormDesigner();
	const {
		t,
		language,
		isMobile,
		mobileTab,
		setMobileTab,
		fields,
		activeId,
		draft,
		setDraft,
		isLoading,
		isSaving,
		status,
		searchQuery,
		setSearchQuery,
		previewContext,
		setPreviewContext,
		activeTab,
		setActiveTab,
		activeLangTab,
		setActiveLangTab,
		isCoreExpanded,
		setIsCoreExpanded,
		presets,
		selectField,
		startNew,
		duplicateField,
		updateOption,
		addOption,
		removeOption,
		applyPreset,
		save,
		removeField,
		moveField,
		toggleFieldEnabled,
		canSave,
		filteredFields,
		previewFields,
	} = state;

	if (isLoading) {
		return <div style={{ padding: 40, textAlign: 'center', opacity: 0.55 }}>{t('loading')}</div>;
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
			<FormDesignerHeader
				isCoreExpanded={isCoreExpanded}
				setIsCoreExpanded={setIsCoreExpanded}
				status={status}
				isMobile={isMobile}
				mobileTab={mobileTab}
				setMobileTab={setMobileTab}
				startNew={startNew}
				t={t}
			/>

			<div
				style={
					isMobile
						? { display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }
						: { display: 'grid', gridTemplateColumns: '270px minmax(0, 1fr) 330px', gap: '16px', alignItems: 'start' }
				}
			>
				{(!isMobile || mobileTab === 'fields') && (
					<FieldListSidebar
						fields={fields}
						filteredFields={filteredFields}
						activeId={activeId}
						draft={draft}
						searchQuery={searchQuery}
						setSearchQuery={setSearchQuery}
						selectField={selectField}
						toggleFieldEnabled={toggleFieldEnabled}
						moveField={moveField}
						language={language}
						t={t}
					/>
				)}

				{(!isMobile || mobileTab === 'edit') && (
					<FieldEditorPane
						draft={draft}
						setDraft={setDraft}
						activeTab={activeTab}
						setActiveTab={setActiveTab}
						activeLangTab={activeLangTab}
						setActiveLangTab={setActiveLangTab}
						presets={presets}
						applyPreset={applyPreset}
						updateOption={updateOption}
						addOption={addOption}
						removeOption={removeOption}
						removeField={removeField}
						duplicateField={duplicateField}
						save={save}
						startNew={startNew}
						canSave={canSave}
						isSaving={isSaving}
						t={t}
					/>
				)}

				{(!isMobile || mobileTab === 'preview') && (
					<FieldPreviewPane
						isMobile={isMobile}
						previewContext={previewContext}
						setPreviewContext={setPreviewContext}
						previewFields={previewFields}
						activeDraftKey={draft?.fieldKey}
						t={t}
					/>
				)}
			</div>
		</div>
	);
}
