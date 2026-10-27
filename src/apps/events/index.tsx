'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { useSound } from '@/core/sound';
import { useIsMobile } from '@/lib/client/useClientValue';
import styles from '@/components/Events/Events.module.css';
import { useEvents } from './hooks/useEvents';
import { EventsSidebar } from './components/EventsSidebar';
import { EventDetail } from './components/EventDetail';
import { EventsMobileView } from './components/EventsMobileView';
import { CameraQRScannerModal } from './components/CameraQRScannerModal';
import { EventFormModal } from '@/components/Events/EventFormModal';
import { ProjectorModal } from '@/components/Events/ProjectorModal';
import { TicketModal } from '@/components/Events/TicketModal';

export function EventsApp() {
	const { t } = useI18n();
	const { playSystemSound } = useSound();
	const isMobile = useIsMobile();
	const ev = useEvents();

	return (
		<>
			{isMobile ? (
				<EventsMobileView
					counts={ev.counts}
					tab={ev.tab}
					onTabChange={ev.setTab}
					query={ev.query}
					onQueryChange={ev.setQuery}
					data={ev.data}
					error={ev.error}
					httpStatus={ev.httpStatus}
					visible={ev.visible}
					selectedId={ev.selected?.id ?? null}
					onSelectId={ev.setSelectedId}
					selected={ev.selected}
					manage={ev.manage}
					now={ev.now}
					locale={ev.locale}
					busy={ev.busy}
					notify={ev.notify}
					refetch={ev.refetch}
					tabOf={ev.tabOf}
					onRegister={ev.register}
					onUnregister={ev.unregister}
					onOpenTicket={ev.setTicketFor}
					onStartScan={() => ev.setScanning(true)}
					onEdit={(e) => ev.setForm({ event: e })}
					onAct={ev.act}
					onProjector={ev.setProjectorFor}
					onNewEvent={() => ev.setForm({ event: null })}
				/>
			) : (
				<div className={styles.root}>
					<EventsSidebar
						manage={ev.manage}
						counts={ev.counts}
						tab={ev.tab}
						onTabChange={ev.setTab}
						query={ev.query}
						onQueryChange={ev.setQuery}
						data={ev.data}
						error={ev.error}
						httpStatus={ev.httpStatus}
						visible={ev.visible}
						selectedId={ev.selected?.id ?? null}
						onSelectId={ev.setSelectedId}
						locale={ev.locale}
						now={ev.now}
						onNewEvent={() => ev.setForm({ event: null })}
					/>

					<main className={styles.main}>
						{ev.selected ? (
							<EventDetail
								event={ev.selected}
								manage={ev.manage}
								now={ev.now}
								locale={ev.locale}
								busy={ev.busy}
								notify={ev.notify}
								refetch={ev.refetch}
								tabOf={ev.tabOf}
								setTab={ev.setTab}
								onRegister={ev.register}
								onUnregister={ev.unregister}
								onOpenTicket={ev.setTicketFor}
								onStartScan={() => ev.setScanning(true)}
								onEdit={(e) => ev.setForm({ event: e })}
								onAct={ev.act}
								onProjector={ev.setProjectorFor}
								onDeleted={() => ev.setSelectedId(null)}
							/>
						) : (
							ev.data !== null && <div className={styles.empty}>{t('evSelect')}</div>
						)}
					</main>
				</div>
			)}

			{ev.form && (
				<EventFormModal
					event={ev.form.event}
					onClose={() => ev.setForm(null)}
					onSaved={async (id, created) => {
						ev.setForm(null);
						playSystemSound();
						ev.notify(created ? t('evCreated') : t('evSaved'));
						await ev.refetch();
						ev.setSelectedId(id);
					}}
				/>
			)}
			{ev.ticketFor && <TicketModal event={ev.ticketFor} onClose={() => ev.setTicketFor(null)} />}
			{ev.projectorFor && (
				<ProjectorModal
					event={ev.projectorFor}
					onClose={() => {
						ev.setProjectorFor(null);
						void ev.refetch();
					}}
				/>
			)}
			<CameraQRScannerModal
				isOpen={ev.scanning}
				title={t('evScanTitleMember')}
				onClose={() => ev.setScanning(false)}
				onScan={ev.checkIn}
			/>
		</>
	);
}
