# Orbit — Application Surface Index

> Otomatik envanter. Her uygulama için dosyalar, API çağrıları, butonlar/onClick ifadeleri, input/select/textarea alanları ve bulunan veri erişimleri listelenir. Bu dosya mimari denetim raporunun ham kanıt ekidir.

## budget

- Dosya: 15
- Bulunan API çağrıları: /api/budget, /api/budget/vaults, /api/upload

### Butonlar / aksiyonlar (25)

- `src/apps/budget/components/BudgetMobileView.tsx:132` — **ledger.setTur('hepsi')} > ( )** · onClick: `() => ledger.setTur('hepsi')`
- `src/apps/budget/components/BudgetMobileView.tsx:139` — **ledger.setTur('gelir')} >** · onClick: `() => ledger.setTur('gelir')`
- `src/apps/budget/components/BudgetMobileView.tsx:147` — **ledger.setTur('gider')} >** · onClick: `() => ledger.setTur('gider')`
- `src/apps/budget/components/BudgetMobileView.tsx:228` — **ledger.setModal( )} >** · onClick: `() => ledger.setModal({ kind: 'transfer' `
- `src/apps/budget/components/BudgetMobileView.tsx:383` — **handleTabChange(tab.id)} title= style= : undefined} >** · onClick: `() => handleTabChange(tab.id)`
- `src/apps/budget/components/BudgetMobileView.tsx:431` — **setSelectedRecord(null)} style= } >** · onClick: `() => setSelectedRecord(null)`
- `src/apps/budget/components/BudgetMobileView.tsx:476` — **} >** · onClick: `() => { const r = selectedRecord; setSelectedRecord(null); void ledger.remove(r); `
- `src/apps/budget/components/BudgetSidebar.tsx:35` — **onSelect(kasa.teamId)} style= } > <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, overflow: 'hidden', textOverflow: 'e** · onClick: `() => onSelect(kasa.teamId)`
- `src/apps/budget/components/KasaEntryModal.tsx:116` — **(icon-only)** · onClick: `onClose`
- `src/apps/budget/components/KasaEntryModal.tsx:119` — **(icon-only)**
- `src/apps/budget/components/KasaEntryModal.tsx:128` — **setTur(typeOpt)} >** · onClick: `() => setTur(typeOpt)`
- `src/apps/budget/components/KasaInsights.tsx:48` — **onSelectKategori(kategori === d.kategori ? '' : d.kategori)} title= > · %** · onClick: `() => onSelectKategori(kategori === d.kategori ? '' : d.kategori)`
- `src/apps/budget/components/KasaInsights.tsx:71` — **onSelectAy(ay === m.ay ? '' : m.ay)} title= : $ $ , $ $ `} >** · onClick: `() => onSelectAy(ay === m.ay ? '' : m.ay)`
- `src/apps/budget/components/KasaLedgerTable.tsx:149` — **onEdit(r)} aria-label= : $ `} title= >** · onClick: `() => onEdit(r)`
- `src/apps/budget/components/KasaLedgerTable.tsx:158` — **onDelete(r)} aria-label= : $ `} title= >** · onClick: `() => onDelete(r)`
- `src/apps/budget/components/KasaLedgerTable.tsx:286` — **onEdit(r)} title= >** · onClick: `() => onEdit(r)`
- `src/apps/budget/components/KasaLedgerTable.tsx:294` — **onDelete(r)} title= >** · onClick: `() => onDelete(r)`
- `src/apps/budget/components/KasaPanel.tsx:132` — **(icon-only)** · onClick: `clearFilter`
- `src/apps/budget/components/KasaToolbar.tsx:66` — **onTurChange(f)} >** · onClick: `() => onTurChange(f)`
- `src/apps/budget/components/KasaToolbar.tsx:107` — **CSV** · onClick: `onExportCsv`
- `src/apps/budget/components/KasaToolbar.tsx:117` — **(icon-only)** · onClick: `onOpenTransfer`
- `src/apps/budget/components/KasaToolbar.tsx:122` — **(icon-only)** · onClick: `onOpenNewEntry`
- `src/apps/budget/components/ReceiptUploadField.tsx:49` — **(icon-only)** · onClick: `onRemove`
- `src/apps/budget/components/TransferModal.tsx:78` — **(icon-only)** · onClick: `onClose`
- `src/apps/budget/components/TransferModal.tsx:81` — **(icon-only)**

### Form alanları / input yüzeyi (16)

- `src/apps/budget/components/BudgetMobileView.tsx:121` — text value={ledger.arama}
- `src/apps/budget/components/KasaEntryModal.tsx:153` — input value={registration.kategori}
- `src/apps/budget/components/KasaEntryModal.tsx:155` — select value={kategori}
- `src/apps/budget/components/KasaEntryModal.tsx:172` — date placeholder="1.250,00" value={formatKurus(registration.tutarKurus)}
- `src/apps/budget/components/KasaEntryModal.tsx:174` — date placeholder="1.250,00" value={tutar}
- `src/apps/budget/components/KasaEntryModal.tsx:187` — date value={date}
- `src/apps/budget/components/KasaEntryModal.tsx:215` — textarea value={aciklama}
- `src/apps/budget/components/KasaToolbar.tsx:57` — button value={arama}
- `src/apps/budget/components/KasaToolbar.tsx:78` — select value={kategori}
- `src/apps/budget/components/KasaToolbar.tsx:92` — button value={ay}
- `src/apps/budget/components/ReceiptUploadField.tsx:30` — file
- `src/apps/budget/components/TransferModal.tsx:93` — select value={kaynak}
- `src/apps/budget/components/TransferModal.tsx:108` — select value={hedef}
- `src/apps/budget/components/TransferModal.tsx:155` — date placeholder="5.000,00" value={tutar}
- `src/apps/budget/components/TransferModal.tsx:167` — date value={date}
- `src/apps/budget/components/TransferModal.tsx:179` — input value={aciklama}

## certificates

- Dosya: 19
- Bulunan API çağrıları: /api/certificates, /api/community, /api/events, /api/members, /api/profile

### Butonlar / aksiyonlar (22)

- `src/apps/certificates/components/CertificateCard.tsx:152` — **(icon-only)** · onClick: `onSelect`
- `src/apps/certificates/components/CertificateCard.tsx:175` — **(icon-only)** · onClick: `onCopyVerification`
- `src/apps/certificates/components/CertificateCard.tsx:195` — **LinkedIn** · onClick: `onAddToLinkedIn`
- `src/apps/certificates/components/CertificateCard.tsx:216` — **(icon-only)** · onClick: `onRevoke`
- `src/apps/certificates/components/CertificateDetailModal.tsx:81` — **(icon-only)** · onClick: `onClose`
- `src/apps/certificates/components/CertificateModalActions.tsx:62` — **(icon-only)** · onClick: `handleDownloadPdf`
- `src/apps/certificates/components/CertificateModalActions.tsx:84` — **onCopyVerification(cert.verificationCode)} style= } >** · onClick: `() => onCopyVerification(cert.verificationCode)`
- `src/apps/certificates/components/CertificateModalActions.tsx:104` — **onAddToLinkedIn(cert)} style= } >** · onClick: `() => onAddToLinkedIn(cert)`
- `src/apps/certificates/components/CertificateTitlePresets.tsx:23` — **onSelect(label, item.category)} style= } >** · onClick: `() => onSelect(label, item.category)`
- `src/apps/certificates/components/CertificatesMobileView.tsx:101` — **void c.handleCopyVerification(cert.verificationCode)} >** · onClick: `() => void c.handleCopyVerification(cert.verificationCode)`
- `src/apps/certificates/components/CertificatesMobileView.tsx:110` — **c.setSelectedCert(cert)} >** · onClick: `() => c.setSelectedCert(cert)`
- `src/apps/certificates/components/CertificatesMobileView.tsx:200` — **handleTabChange(tab.id)} title= style= : undefined} >** · onClick: `() => handleTabChange(tab.id)`
- `src/apps/certificates/components/CertificatesToolbar.tsx:70` — **onSelectTab('certificates')} style= } > )}** · onClick: `() => onSelectTab('certificates')`
- `src/apps/certificates/components/CertificatesToolbar.tsx:91` — **onSelectTab('all')} style= } > )}** · onClick: `() => onSelectTab('all')`
- `src/apps/certificates/components/CertificatesToolbar.tsx:112` — **onSelectTab('leaderboard')} style= } >** · onClick: `() => onSelectTab('leaderboard')`
- `src/apps/certificates/components/CertificatesToolbar.tsx:135` — **(icon-only)** · onClick: `onEditSignatories`
- `src/apps/certificates/components/CertificatesToolbar.tsx:157` — **(icon-only)** · onClick: `onOpenIssue`
- `src/apps/certificates/components/IssueModalFooter.tsx:16` — **(icon-only)** · onClick: `onClose`
- `src/apps/certificates/components/IssueModalFooter.tsx:32` — **(icon-only)**
- `src/apps/certificates/components/IssueModeToggle.tsx:17` — **onChange(m)} style= } >** · onClick: `() => onChange(m)`
- `src/apps/certificates/components/SignatoriesModal.tsx:102` — **(icon-only)** · onClick: `onClose`
- `src/apps/certificates/components/SignatoriesModal.tsx:105` — **(icon-only)**

### Form alanları / input yüzeyi (10)

- `src/apps/certificates/components/IssueCertificateModal.tsx:78` — select value={issueUserId}
- `src/apps/certificates/components/IssueCertificateModal.tsx:97` — text value={issueBaslik}
- `src/apps/certificates/components/IssueCertificateModal.tsx:117` — select value={issueEtkinlikId}
- `src/apps/certificates/components/IssueCertificateModal.tsx:140` — select value={issueCategory}
- `src/apps/certificates/components/IssueCertificateModal.tsx:155` — te value={issueLang}
- `src/apps/certificates/components/IssueCertificateModal.tsx:171` — text value={issueContext}
- `src/apps/certificates/components/SignatoriesModal.tsx:57` — input value={universite}
- `src/apps/certificates/components/SignatoriesModal.tsx:67` — input value={kulupAdi}
- `src/apps/certificates/components/SignatoriesModal.tsx:79` — input value={row.ad}
- `src/apps/certificates/components/SignatoriesModal.tsx:89` — button value={row.unvan}

## chat

- Dosya: 19
- Bulunan API çağrıları: /api/chat/messages, /api/chat/poll, /api/chat/rooms, /api/chat/stream, /api/chat/upload

### Butonlar / aksiyonlar (81)

- `src/apps/chat/ChatMobileView.tsx:424` — **openRoom(room.id)}> )} : $ ` : t('chatNoMessages')} }** · onClick: `() => openRoom(room.id)`
- `src/apps/chat/ChatMobileView.tsx:508` — **setIsNewChatOpen(true)} title= >** · onClick: `() => setIsNewChatOpen(true)`
- `src/apps/chat/ChatMobileView.tsx:517` — **(icon-only)** · onClick: `refreshRooms`
- `src/apps/chat/ChatMobileView.tsx:539` — **setSearchQuery('')} aria-label="Temizle" >** · onClick: `() => setSearchQuery('')`
- `src/apps/chat/ChatMobileView.tsx:596` — **setIsNewChatOpen(true)} >** · onClick: `() => setIsNewChatOpen(true)`
- `src/apps/chat/ChatMobileView.tsx:653` — **handleTabChange(tab.id)} title= style= : undefined} > )}** · onClick: `() => handleTabChange(tab.id)`
- `src/apps/chat/ChatMobileView.tsx:684` — **setScreen('rooms')} aria-label="Sohbet listesi" >** · onClick: `() => setScreen('rooms')`
- `src/apps/chat/ChatMobileView.tsx:694` — **isGroupOrTeam && setIsGroupInfoOpen(true)} > ) : ( )}** · onClick: `() => isGroupOrTeam && setIsGroupInfoOpen(true)`
- `src/apps/chat/ChatMobileView.tsx:720` — **setIsAddMemberOpen(true)} title= >** · onClick: `() => setIsAddMemberOpen(true)`
- `src/apps/chat/ChatMobileView.tsx:729` — **setIsGroupInfoOpen(true)} title= >** · onClick: `() => setIsGroupInfoOpen(true)`
- `src/apps/chat/ChatMobileView.tsx:753` — **void loadOlderMessages()} disabled= >** · onClick: `() => void loadOlderMessages()`
- `src/apps/chat/ChatMobileView.tsx:851` — **} title= >** · onClick: `() => { setReplyingMessage(msg); composerInputRef.current?.focus(); `
- `src/apps/chat/ChatMobileView.tsx:864` — **setForwardingMessage(msg)} title= >** · onClick: `() => setForwardingMessage(msg)`
- `src/apps/chat/ChatMobileView.tsx:874` — **} title= >** · onClick: `() => { setEditingMessage(msg); setText(msg.icerik); composerInputRef.current?.focus(); `
- `src/apps/chat/ChatMobileView.tsx:888` — **)) }} title= >** · onClick: `async () => { if (await dialog.confirm({ message: t('chatDeleteConfirm'), tone: 'danger' `
- `src/apps/chat/ChatMobileView.tsx:934` — **} title= >** · onClick: `() => { setEditingMessage(null); setText(''); `
- `src/apps/chat/ChatMobileView.tsx:959` — **(icon-only)** · onClick: `cancelReply`
- `src/apps/chat/ChatMobileView.tsx:974` — **void voice.cancel()} title= >** · onClick: `() => void voice.cancel()`
- `src/apps/chat/ChatMobileView.tsx:977` — **void finishVoice()} disabled= title= >** · onClick: `() => void finishVoice()`
- `src/apps/chat/ChatMobileView.tsx:1000` — **setAttachments((previous) => previous.filter((_, itemIndex) => itemIndex !== index)) } >** · onClick: `() => setAttachments((previous) => previous.filter((_, itemIndex) => itemIndex !== index)) `
- `src/apps/chat/ChatMobileView.tsx:1020` — **setIsActionsMenuOpen((prev) => !prev)} title= aria-expanded= disabled= >** · onClick: `() => setIsActionsMenuOpen((prev) => !prev)`
- `src/apps/chat/ChatMobileView.tsx:1054` — **(voice.isRecording ? void finishVoice() : void voice.start())} disabled= title= aria-label= >** · onClick: `() => (voice.isRecording ? void finishVoice() : void voice.start())`
- `src/apps/chat/ChatMobileView.tsx:1065` — **(icon-only)**
- `src/apps/chat/components/AddMemberModal.tsx:133` — **(icon-only)** · onClick: `onClose`
- `src/apps/chat/components/AddMemberModal.tsx:186` — **toggleMemberSelection(sc.id)} >** · onClick: `() => toggleMemberSelection(sc.id)`
- `src/apps/chat/components/AddMemberModal.tsx:224` — **toggleMemberSelection(contact.id)} >** · onClick: `() => toggleMemberSelection(contact.id)`
- `src/apps/chat/components/AddMemberModal.tsx:267` — **(icon-only)** · onClick: `onClose`
- `src/apps/chat/components/AddMemberModal.tsx:274` — **(icon-only)** · onClick: `handleSubmit`
- `src/apps/chat/components/ChatAttachments.tsx:216` — **setExpanded((v) => !v)}>** · onClick: `() => setExpanded((v) => !v)`
- `src/apps/chat/components/ChatAttachments.tsx:219` — **onOpen(attachment)} title= >** · onClick: `() => onOpen(attachment)`
- `src/apps/chat/components/ChatAttachments.tsx:261` — **setExpanded((v) => !v)}>** · onClick: `() => setExpanded((v) => !v)`
- `src/apps/chat/components/ChatAttachments.tsx:264` — **onOpen(attachment)} title= >** · onClick: `() => onOpen(attachment)`
- `src/apps/chat/components/ChatAttachments.tsx:297` — **onOpen(attachment)} title= >** · onClick: `() => onOpen(attachment)`
- `src/apps/chat/components/ChatAttachments.tsx:329` — **onOpen(attachment)} title= >** · onClick: `() => onOpen(attachment)`
- `src/apps/chat/components/ChatAttachments.tsx:356` — **onOpen(attachment)} title= >** · onClick: `() => onOpen(attachment)`
- `src/apps/chat/components/ChatMessageInput.tsx:205` — **setAttachments((previous) => previous.filter((_, itemIndex) => itemIndex !== index) ) } title= >** · onClick: `() => setAttachments((previous) => previous.filter((_, itemIndex) => itemIndex !== index) ) `
- `src/apps/chat/components/ChatMessageInput.tsx:237` — **(icon-only)** · onClick: `onCancelEdit`
- `src/apps/chat/components/ChatMessageInput.tsx:260` — **(icon-only)** · onClick: `onCancelReply`
- `src/apps/chat/components/ChatMessageInput.tsx:276` — **void voice.cancel()} title= >** · onClick: `() => void voice.cancel()`
- `src/apps/chat/components/ChatMessageInput.tsx:277` — **void finishVoice()} disabled= title= >** · onClick: `() => void finishVoice()`
- `src/apps/chat/components/ChatMessageInput.tsx:284` — **setIsActionsMenuOpen((prev) => !prev)} title= disabled= aria-expanded= >** · onClick: `() => setIsActionsMenuOpen((prev) => !prev)`
- `src/apps/chat/components/ChatMessageInput.tsx:320` — **(voice.isRecording ? void finishVoice() : void voice.start())} disabled= title= aria-label= >** · onClick: `() => (voice.isRecording ? void finishVoice() : void voice.start())`
- `src/apps/chat/components/ChatMessageInput.tsx:331` — **(icon-only)**
- `src/apps/chat/components/ChatMessageList.tsx:217` — **onReply(msg)} >** · onClick: `() => onReply(msg)`
- `src/apps/chat/components/ChatMessageList.tsx:227` — **onForward(msg)} >** · onClick: `() => onForward(msg)`
- `src/apps/chat/components/ChatMessageList.tsx:237` — **onStartEdit(msg)} >** · onClick: `() => onStartEdit(msg)`
- `src/apps/chat/components/ChatMessageList.tsx:247` — **)) }} >** · onClick: `async () => { if (await dialog.confirm({ message: t('chatDeleteConfirm'), tone: 'danger' `
- `src/apps/chat/components/ChatMessageList.tsx:395` — **(icon-only)** · onClick: `onLoadOlder`
- `src/apps/chat/components/ChatRoomList.tsx:33` — **onSelectRoom(room.id)} className= $ `} > ) : ( )} {room.sonMesaj?.date && ( <sp** · onClick: `() => onSelectRoom(room.id)`
- `src/apps/chat/components/ForwardMessageModal.tsx:80` — **(icon-only)** · onClick: `onClose`
- `src/apps/chat/components/ForwardMessageModal.tsx:133` — **toggleRoom(room.id)} > ) : ( )} <span classN** · onClick: `() => toggleRoom(room.id)`
- `src/apps/chat/components/ForwardMessageModal.tsx:179` — **(icon-only)** · onClick: `onClose`
- `src/apps/chat/components/ForwardMessageModal.tsx:187` — **)}** · onClick: `handleForwardSubmit`
- `src/apps/chat/components/GroupInfoModal.tsx:61` — **(icon-only)** · onClick: `onClose`
- `src/apps/chat/components/GroupInfoModal.tsx:125` — **} >** · onClick: `() => { onClose(); onOpenAddMembers(); `
- `src/apps/chat/components/GroupInfoModal.tsx:198` — **(icon-only)** · onClick: `onClose`
- `src/apps/chat/components/NewChatModal.tsx:111` — **setMode('direct')} style= } title= >** · onClick: `() => setMode('direct')`
- `src/apps/chat/components/NewChatModal.tsx:123` — **(icon-only)** · onClick: `onClose`
- `src/apps/chat/components/NewChatModal.tsx:136` — **setMode('group')} >** · onClick: `() => setMode('group')`
- `src/apps/chat/components/NewChatModal.tsx:163` — **toggleMemberSelection(sc.id)} >** · onClick: `() => toggleMemberSelection(sc.id)`
- `src/apps/chat/components/NewChatModal.tsx:201` — **else }} > )} alt= style= }** · onClick: `() => { if (mode === 'group') { toggleMemberSelection(contact.id); `
- `src/apps/chat/components/NewChatModal.tsx:253` — **(icon-only)** · onClick: `onClose`
- `src/apps/chat/components/NewChatModal.tsx:260` — **)}** · onClick: `handleCreateGroup`
- `src/apps/chat/components/TeamChatEmbed.tsx:120` — **setIsCreatePollOpen(true)} title= >** · onClick: `() => setIsCreatePollOpen(true)`
- `src/apps/chat/components/TeamChatEmbed.tsx:131` — **setIsGroupInfoOpen(true)} title= > )}** · onClick: `() => setIsGroupInfoOpen(true)`
- `src/apps/chat/components/TeamChatEmbed.tsx:144` — **} title= >** · onClick: `() => { void refreshRooms(); refreshMessages(); `
- `src/apps/chat/components/TeamChatEmbed.tsx:157` — **openApp('chat', )} title= >** · onClick: `() => openApp('chat', { kind: 'room', itemId: targetRoomId `
- `src/apps/chat/components/composer/ComposerActionsMenu.tsx:69` — **} role="menuitem" > )}** · onClick: `() => { onSelectAction(action.id); onClose(); `
- `src/apps/chat/components/poll/CreatePollModal.tsx:109` — **(icon-only)** · onClick: `onClose`
- `src/apps/chat/components/poll/CreatePollModal.tsx:152` — **handleRemoveOption(idx)} title= >** · onClick: `() => handleRemoveOption(idx)`
- `src/apps/chat/components/poll/CreatePollModal.tsx:166` — **(icon-only)** · onClick: `handleAddOption`
- `src/apps/chat/components/poll/CreatePollModal.tsx:227` — **setDuration(item.id)} >** · onClick: `() => setDuration(item.id)`
- `src/apps/chat/components/poll/CreatePollModal.tsx:245` — **(icon-only)** · onClick: `onClose`
- `src/apps/chat/components/poll/CreatePollModal.tsx:253` — **(icon-only)**
- `src/apps/chat/components/poll/PollMessageCard.tsx:140` — **handleOptionClick(opt.id)} disabled= > className={s.pol** · onClick: `() => handleOptionClick(opt.id)`
- `src/apps/chat/components/poll/PollMessageCard.tsx:222` — **(icon-only)** · onClick: `handleClose`
- `src/apps/chat/index.tsx:112` — **setIsNewChatOpen(true)} style= } title= >** · onClick: `() => setIsNewChatOpen(true)`
- `src/apps/chat/index.tsx:131` — **(icon-only)** · onClick: `refreshRooms`
- `src/apps/chat/index.tsx:172` — **setMobileView('rooms')} style= } >** · onClick: `() => setMobileView('rooms')`
- `src/apps/chat/index.tsx:254` — **setIsAddMemberOpen(true)} title= >** · onClick: `() => setIsAddMemberOpen(true)`
- `src/apps/chat/index.tsx:265` — **setIsGroupInfoOpen(true)} title= >** · onClick: `() => setIsGroupInfoOpen(true)`

### Form alanları / input yüzeyi (14)

- `src/apps/chat/ChatMobileView.tsx:531` — text value={searchQuery}
- `src/apps/chat/ChatMobileView.tsx:986` — file
- `src/apps/chat/ChatMobileView.tsx:1044` — text value={text}
- `src/apps/chat/components/AddMemberModal.tsx:169` — text value={groupTitle}
- `src/apps/chat/components/AddMemberModal.tsx:201` — text value={searchQuery}
- `src/apps/chat/components/ChatMessageInput.tsx:190` — file
- `src/apps/chat/components/ChatMessageInput.tsx:308` — text value={text}
- `src/apps/chat/components/ForwardMessageModal.tsx:107` — text value={searchQuery}
- `src/apps/chat/components/NewChatModal.tsx:146` — text value={groupTitle}
- `src/apps/chat/components/NewChatModal.tsx:178` — text value={searchQuery}
- `src/apps/chat/components/poll/CreatePollModal.tsx:127` — textarea value={soru}
- `src/apps/chat/components/poll/CreatePollModal.tsx:144` — text value={opt}
- `src/apps/chat/components/poll/CreatePollModal.tsx:187` — checkbox
- `src/apps/chat/components/poll/CreatePollModal.tsx:203` — checkbox

## database

- Dosya: 16
- Bulunan API çağrıları: /api/database/audit, /api/database/auth, /api/database/data, /api/database/import, /api/database/mutate, /api/database/query, /api/database/schema, /api/database/tables

### Butonlar / aksiyonlar (74)

- `src/apps/database/components/DatabaseAuditView.tsx:124` — **Yenile** · onClick: `fetchAudit`
- `src/apps/database/components/DatabaseAuditView.tsx:256` — **handleRevert(rec)} disabled= style= } >** · onClick: `() => handleRevert(rec)`
- `src/apps/database/components/DatabaseCreateTableModal.tsx:172` — **(icon-only)** · onClick: `onClose`
- `src/apps/database/components/DatabaseCreateTableModal.tsx:231` — **Sütun Ekle** · onClick: `handleAddColumn`
- `src/apps/database/components/DatabaseCreateTableModal.tsx:346` — **handleRemoveColumn(idx)} disabled= } >** · onClick: `() => handleRemoveColumn(idx)`
- `src/apps/database/components/DatabaseCreateTableModal.tsx:368` — **setShowSqlPreview(!showSqlPreview)} style= } >** · onClick: `() => setShowSqlPreview(!showSqlPreview)`
- `src/apps/database/components/DatabaseCreateTableModal.tsx:417` — **(icon-only)** · onClick: `onClose`
- `src/apps/database/components/DatabaseCreateTableModal.tsx:433` — **(icon-only)** · onClick: `handleSubmit`
- `src/apps/database/components/DatabaseFilterBar.tsx:64` — **(icon-only)** · onClick: `onAddFilter`
- `src/apps/database/components/DatabaseFilterBar.tsx:86` — **( )** · onClick: `onClearFilters`
- `src/apps/database/components/DatabaseFilterBar.tsx:110` — **setShowColMenu(!showColMenu)} style= } > ( / )** · onClick: `() => setShowColMenu(!showColMenu)`
- `src/apps/database/components/DatabaseFilterBar.tsx:168` — **(icon-only)** · onClick: `onShowAllColumns`
- `src/apps/database/components/DatabaseFilterBar.tsx:300` — **onRemoveFilter(f.id)} style= } title="Filtreyi kaldır" >** · onClick: `() => onRemoveFilter(f.id)`
- `src/apps/database/components/DatabaseGrid.tsx:532` — **setShowAddModal(true)} title= >** · onClick: `() => setShowAddModal(true)`
- `src/apps/database/components/DatabaseGrid.tsx:543` — **İçe Aktar** · onClick: `onOpenImport`
- `src/apps/database/components/DatabaseGrid.tsx:555` — **( )** · onClick: `handleDeleteSelected`
- `src/apps/database/components/DatabaseGrid.tsx:566` — **CSV** · onClick: `handleExportCsv`
- `src/apps/database/components/DatabaseGrid.tsx:576` — **JSON** · onClick: `handleExportJson`
- `src/apps/database/components/DatabaseGrid.tsx:586` — **(icon-only)** · onClick: `onRefresh`
- `src/apps/database/components/DatabaseGrid.tsx:693` — **onOpenRowDrawer(row)} style= } title="Satırı Sağ Çekmecede İncele" >** · onClick: `() => onOpenRowDrawer(row)`
- `src/apps/database/components/DatabaseGrid.tsx:770` — **} style= } title= `} >** · onClick: `(e) => { e.stopPropagation(); onJumpToForeignKey( col.foreignKeyTarget!.table, col.foreignKeyTarget!.column, displayVal ); `
- `src/apps/database/components/DatabaseGrid.tsx:846` — **onPageChange(1)} title="İlk Sayfa" >** · onClick: `() => onPageChange(1)`
- `src/apps/database/components/DatabaseGrid.tsx:856` — **onPageChange(data.page - 1)} title="Önceki Sayfa" >** · onClick: `() => onPageChange(data.page - 1)`
- `src/apps/database/components/DatabaseGrid.tsx:893` — **= data.totalPages || isLoading} onClick= title="Sonraki Sayfa" >** · onClick: `() => onPageChange(data.page + 1)`
- `src/apps/database/components/DatabaseGrid.tsx:903` — **= data.totalPages || isLoading} onClick= title="Son Sayfa" >** · onClick: `() => onPageChange(data.totalPages)`
- `src/apps/database/components/DatabaseGrid.tsx:923` — **setShowAddModal(false)} > ✕** · onClick: `() => setShowAddModal(false)`
- `src/apps/database/components/DatabaseGrid.tsx:958` — **setShowAddModal(false)} >** · onClick: `() => setShowAddModal(false)`
- `src/apps/database/components/DatabaseGrid.tsx:965` — **(icon-only)**
- `src/apps/database/components/DatabaseImportModal.tsx:214` — **(icon-only)** · onClick: `onClose`
- `src/apps/database/components/DatabaseImportModal.tsx:526` — **setStep((s) => (s - 1) as 1 | 2)} style= } > Geri** · onClick: `() => setStep((s) => (s - 1) as 1 | 2)`
- `src/apps/database/components/DatabaseImportModal.tsx:550` — **(icon-only)** · onClick: `onClose`
- `src/apps/database/components/DatabaseImportModal.tsx:567` — **setError(null); setStep(3); }} style= } > İlerle** · onClick: `() => { if (Object.keys(mapping).length === 0) { setError('Lütfen en az bir sütun eşleştirmesi yapın.'); return; `
- `src/apps/database/components/DatabaseImportModal.tsx:597` — **(icon-only)** · onClick: `executeImport`
- `src/apps/database/components/DatabasePendingBar.tsx:37` — **(icon-only)** · onClick: `onDiscard`
- `src/apps/database/components/DatabasePendingBar.tsx:50` — **) : ( )}** · onClick: `onSave`
- `src/apps/database/components/DatabaseRowDrawer.tsx:116` — **(icon-only)** · onClick: `onClose`
- `src/apps/database/components/DatabaseRowDrawer.tsx:198` — **onJumpToForeignKey( col.foreignKeyTarget!.table, col.foreignKeyTarget!.column, rawVal ) } style= } title= tablosuna zıpla`} >** · onClick: `() => onJumpToForeignKey( col.foreignKeyTarget!.table, col.foreignKeyTarget!.column, rawVal ) `
- `src/apps/database/components/DatabaseRowDrawer.tsx:229` — **handlePrettifyJson(col.name)} style= } > Biçimlendir** · onClick: `() => handlePrettifyJson(col.name)`
- `src/apps/database/components/DatabaseRowDrawer.tsx:359` — **(icon-only)** · onClick: `onClose`
- `src/apps/database/components/DatabaseRowDrawer.tsx:374` — **(icon-only)** · onClick: `handleSave`
- `src/apps/database/components/DatabaseSafeModeModal.tsx:71` — **(icon-only)** · onClick: `onCancel`
- `src/apps/database/components/DatabaseSafeModeModal.tsx:147` — **İptal Et & Durdur** · onClick: `onCancel`
- `src/apps/database/components/DatabaseSafeModeModal.tsx:163` — **Riskleri Onaylıyorum, Çalıştır** · onClick: `onConfirm`
- `src/apps/database/components/DatabaseSchemaGraph.tsx:137` — **setZoom((z) => Math.max(0.4, z - 0.15))} style= } title="Uzaklaş" >** · onClick: `() => setZoom((z) => Math.max(0.4, z - 0.15))`
- `src/apps/database/components/DatabaseSchemaGraph.tsx:148` — **setZoom((z) => Math.min(2.5, z + 0.15))} style= } title="Yakınlaş" >** · onClick: `() => setZoom((z) => Math.min(2.5, z + 0.15))`
- `src/apps/database/components/DatabaseSchemaGraph.tsx:156` — **); }} style= } title="Sıfırla" >** · onClick: `() => { setZoom(1); setPan({ x: 40, y: 40 `
- `src/apps/database/components/DatabaseSchemaGraph.tsx:169` — **Yenile** · onClick: `fetchSchema`
- `src/apps/database/components/DatabaseSchemaGraph.tsx:189` — **Yeni Tablo Oluştur** · onClick: `onOpenCreateTable`
- `src/apps/database/components/DatabaseSqlConsole.tsx:134` — **setShowDrawer(!showDrawer)} style= } > Şablonlar & Geçmiş** · onClick: `() => setShowDrawer(!showDrawer)`
- `src/apps/database/components/DatabaseSqlConsole.tsx:154` — **handleExecute(false, true)} disabled= style= } title="EXPLAIN ANALYZE ile yürütme planını görselleştir" > Planı Açıkla (EXPLAIN)** · onClick: `() => handleExecute(false, true)`
- `src/apps/database/components/DatabaseSqlConsole.tsx:177` — **handleExecute(false, false)} disabled= style= } > ) : ( )}** · onClick: `() => handleExecute(false, false)`
- `src/apps/database/components/DatabaseSqlConsole.tsx:289` — **) ); downloadCsv('sql_sonuc', headers, dataRows); }} style= }** · onClick: `() => { const headers = result.fields!.map((f) => f.name); const dataRows = result.rows!.map((r) => headers.map((h) => { const v = r[h]; return v === null || v `
- `src/apps/database/components/DatabaseSqlConsole.tsx:323` — **), `sql_sonuc_$ .json` ); }} style= } title="Sonuçları JSON formatında indir" > JSON İndir** · onClick: `() => { const jsonStr = JSON.stringify(result.rows, null, 2); downloadBlob( new Blob([jsonStr], { type: 'application/json;charset=utf-8' `
- `src/apps/database/components/DatabaseSqlDrawer.tsx:151` — **(icon-only)** · onClick: `onClose`
- `src/apps/database/components/DatabaseSqlDrawer.tsx:175` — **setActiveSubTab('templates')} style= } > Sistem ( )** · onClick: `() => setActiveSubTab('templates')`
- `src/apps/database/components/DatabaseSqlDrawer.tsx:197` — **setActiveSubTab('saved')} style= } > Kayıtlı ( )** · onClick: `() => setActiveSubTab('saved')`
- `src/apps/database/components/DatabaseSqlDrawer.tsx:219` — **setActiveSubTab('history')} style= } > Geçmiş ( )** · onClick: `() => setActiveSubTab('history')`
- `src/apps/database/components/DatabaseSqlDrawer.tsx:263` — **} style= } > Editöre Yapıştır** · onClick: `() => { onSelectQuery(tmpl.sql); onClose(); `
- `src/apps/database/components/DatabaseSqlDrawer.tsx:297` — **setShowAddForm(true)} disabled= style= } > Mevcut Sorguyu Kaydet** · onClick: `() => setShowAddForm(true)`
- `src/apps/database/components/DatabaseSqlDrawer.tsx:347` — **setShowAddForm(false)} style= } > Vazgeç** · onClick: `() => setShowAddForm(false)`
- `src/apps/database/components/DatabaseSqlDrawer.tsx:362` — **Kaydet** · onClick: `handleSaveCurrent`
- `src/apps/database/components/DatabaseSqlDrawer.tsx:402` — **handleDeleteSaved(sq.id)} style= } >** · onClick: `() => handleDeleteSaved(sq.id)`
- `src/apps/database/components/DatabaseSqlDrawer.tsx:429` — **} style= } > Kullan** · onClick: `() => { onSelectQuery(sq.sql); onClose(); `
- `src/apps/database/components/DatabaseSqlDrawer.tsx:464` — **Geçmişi Temizle** · onClick: `handleClearHistory`
- `src/apps/database/components/DatabaseTableList.tsx:45` — **(icon-only)** · onClick: `onOpenCreateTable`
- `src/apps/database/components/DatabaseTableList.tsx:63` — **(icon-only)** · onClick: `onRefresh`
- `src/apps/database/components/DatabaseTableList.tsx:109` — **onSelectTable(t.name)} >** · onClick: `() => onSelectTable(t.name)`
- `src/apps/database/components/DatabaseTwoFactorPrompt.tsx:108` — **).finally(() => setLoading(false)); }} style= } >** · onClick: `() => { if (!onPasskey) return; setLoading(true); setError(null); void onPasskey().then((res) => { if (!res.ok) setError(res.error || t('db2faGenericError')); `
- `src/apps/database/components/DatabaseTwoFactorPrompt.tsx:183` — **openApp('settings')} style= } >** · onClick: `() => openApp('settings')`
- `src/apps/database/components/DatabaseTwoFactorPrompt.tsx:305` — **= 6 && !loading ? 'var(--accent)' : 'var(--accent-muted)', color: 'var(--accent-contrast, #ffffff)', border: 'none', fontWeight: 600, fontSi**
- `src/apps/database/index.tsx:574` — **setActiveTab('tables')} >** · onClick: `() => setActiveTab('tables')`
- `src/apps/database/index.tsx:582` — **setActiveTab('sql')} >** · onClick: `() => setActiveTab('sql')`
- `src/apps/database/index.tsx:590` — **setActiveTab('schema')} >** · onClick: `() => setActiveTab('schema')`
- `src/apps/database/index.tsx:598` — **setActiveTab('audit')} >** · onClick: `() => setActiveTab('audit')`

### Form alanları / input yüzeyi (31)

- `src/apps/database/components/DatabaseCreateTableModal.tsx:211` — text placeholder="orn: kulup_odulleri" value={tableName}
- `src/apps/database/components/DatabaseCreateTableModal.tsx:268` — text placeholder="Sütun Adı" value={c.name}
- `src/apps/database/components/DatabaseCreateTableModal.tsx:286` — select value={c.type}
- `src/apps/database/components/DatabaseCreateTableModal.tsx:309` — checkbox
- `src/apps/database/components/DatabaseCreateTableModal.tsx:319` — checkbox placeholder="Varsayılan" value={c.defaultValue || ''}
- `src/apps/database/components/DatabaseCreateTableModal.tsx:328` — text placeholder="Varsayılan" value={c.defaultValue || ''}
- `src/apps/database/components/DatabaseFilterBar.tsx:198` — checkbox
- `src/apps/database/components/DatabaseFilterBar.tsx:238` — select value={f.column}
- `src/apps/database/components/DatabaseFilterBar.tsx:258` — select value={f.op}
- `src/apps/database/components/DatabaseFilterBar.tsx:281` — text value={f.value}
- `src/apps/database/components/DatabaseGrid.tsx:515` — text value={searchInput}
- `src/apps/database/components/DatabaseGrid.tsx:618` — checkbox
- `src/apps/database/components/DatabaseGrid.tsx:687` — checkbox
- `src/apps/database/components/DatabaseGrid.tsx:740` — text value={editValue}
- `src/apps/database/components/DatabaseGrid.tsx:830` — select value={pageSize}
- `src/apps/database/components/DatabaseGrid.tsx:868` — text value={pageJump !== '' ? pageJump : data.page}
- `src/apps/database/components/DatabaseGrid.tsx:943` — text value={newRowData[col.name] || ''}
- `src/apps/database/components/DatabaseImportModal.tsx:304` — file
- `src/apps/database/components/DatabaseImportModal.tsx:346` — select value={mapping[col.name] || ''}
- `src/apps/database/components/DatabaseImportModal.tsx:432` — radio name=conflict
- `src/apps/database/components/DatabaseImportModal.tsx:461` — radio name=conflict
- `src/apps/database/components/DatabaseImportModal.tsx:490` — radio name=conflict
- `src/apps/database/components/DatabaseRowDrawer.tsx:254` — text
- `src/apps/database/components/DatabaseRowDrawer.tsx:270` — textarea value={displayVal}
- `src/apps/database/components/DatabaseRowDrawer.tsx:310` — select value={String(rawVal ?? '')}
- `src/apps/database/components/DatabaseRowDrawer.tsx:329` — text value={displayVal}
- `src/apps/database/components/DatabaseSafeModeModal.tsx:117` — text value={challengeInput}
- `src/apps/database/components/DatabaseSqlConsole.tsx:199` — textarea placeholder="SELECT * FROM ...;" value={query}
- `src/apps/database/components/DatabaseSqlDrawer.tsx:332` — text placeholder="Sorgu başlığı..." value={newTitle}
- `src/apps/database/components/DatabaseTableList.tsx:84` — text value={filter}
- `src/apps/database/components/DatabaseTwoFactorPrompt.tsx:266` — text placeholder="••••••" value={code}

## decisions

- Dosya: 2
- Bulunan API çağrıları: /api/committees, /api/committees/members, /api/decisions

### Butonlar / aksiyonlar (13)

- `src/apps/decisions/index.tsx:270` — **setDetail(null)}>** · onClick: `() => setDetail(null)`
- `src/apps/decisions/index.tsx:275` — **setTab('committees')} >** · onClick: `() => setTab('committees')`
- `src/apps/decisions/index.tsx:282` — **setTab('decisions')} >** · onClick: `() => setTab('decisions')`
- `src/apps/decisions/index.tsx:293` — **setShowCreate(true)}>** · onClick: `() => setShowCreate(true)`
- `src/apps/decisions/index.tsx:333` — **setShowCreate(false)}>** · onClick: `() => setShowCreate(false)`
- `src/apps/decisions/index.tsx:334` — **void createCommittee()}>** · onClick: `() => void createCommittee()`
- `src/apps/decisions/index.tsx:361` — **setShowMember((v) => !v)}>** · onClick: `() => setShowMember((v) => !v)`
- `src/apps/decisions/index.tsx:385` — **void addMember()}>** · onClick: `() => void addMember()`
- `src/apps/decisions/index.tsx:409` — **setShowMeeting((v) => !v)}>** · onClick: `() => setShowMeeting((v) => !v)`
- `src/apps/decisions/index.tsx:431` — **void createMeeting()}>** · onClick: `() => void createMeeting()`
- `src/apps/decisions/index.tsx:458` — **setShowDecision((v) => !v)}>** · onClick: `() => setShowDecision((v) => !v)`
- `src/apps/decisions/index.tsx:495` — **void createDecision()}>** · onClick: `() => void createDecision()`
- `src/apps/decisions/index.tsx:524` — **void loadDetail(committee.id)} > :** · onClick: `() => void loadDetail(committee.id)`

### Form alanları / input yüzeyi (17)

- `src/apps/decisions/index.tsx:311` — number value={name}
- `src/apps/decisions/index.tsx:315` — number value={description}
- `src/apps/decisions/index.tsx:320` — number value={quorum}
- `src/apps/decisions/index.tsx:324` — button value={leaderId}
- `src/apps/decisions/index.tsx:370` — select value={memberId}
- `src/apps/decisions/index.tsx:379` — checkbox value={memberRole}
- `src/apps/decisions/index.tsx:382` — checkbox
- `src/apps/decisions/index.tsx:419` — date value={meetingTitle}
- `src/apps/decisions/index.tsx:423` — date value={meetingDate}
- `src/apps/decisions/index.tsx:428` — button value={meetingAgenda}
- `src/apps/decisions/index.tsx:468` — input value={decisionTitle}
- `src/apps/decisions/index.tsx:472` — select value={decisionType}
- `src/apps/decisions/index.tsx:483` — number value={decisionContent}
- `src/apps/decisions/index.tsx:486` — number value={votesFor}
- `src/apps/decisions/index.tsx:487` — number value={votesAgainst}
- `src/apps/decisions/index.tsx:488` — number value={votesAbstain}
- `src/apps/decisions/index.tsx:491` — checkbox

## events

- Dosya: 9
- Bulunan API çağrıları: /api/events

### Butonlar / aksiyonlar (35)

- `src/apps/events/components/CameraQRScannerModal.tsx:129` — **(icon-only)**
- `src/apps/events/components/EventDetail.tsx:157` — **onRegister(e)} >** · onClick: `() => onRegister(e)`
- `src/apps/events/components/EventDetail.tsx:167` — **onOpenTicket(e)}>** · onClick: `() => onOpenTicket(e)`
- `src/apps/events/components/EventDetail.tsx:172` — **(icon-only)** · onClick: `onStartScan`
- `src/apps/events/components/EventDetail.tsx:182` — **onUnregister(e)}>** · onClick: `() => onUnregister(e)`
- `src/apps/events/components/EventDetail.tsx:209` — **onEdit(e)}>** · onClick: `() => onEdit(e)`
- `src/apps/events/components/EventDetail.tsx:213` — **onAct( ).then( (ok) => ok && setTab(tabOf( )) ) } >** · onClick: `() => onAct({ action: 'updateEvent', etkinlikId: e.id, status: 'yayinda' `
- `src/apps/events/components/EventDetail.tsx:227` — **), tone: 'danger' })) ); } }} >** · onClick: `async () => { if (await dialog.confirm({ message: fill(t('evCancelEventConfirm'), { title: e.baslik `
- `src/apps/events/components/EventDetail.tsx:240` — **onAct( )}>** · onClick: `() => onAct({ action: 'updateEvent', etkinlikId: e.id, status: 'yayinda' `
- `src/apps/events/components/EventDetail.tsx:245` — **), tone: 'danger' })) )) onDeleted(); } }} >** · onClick: `async () => { if (await dialog.confirm({ message: fill(t('evDeleteConfirm'), { title: e.baslik `
- `src/apps/events/components/EventsMobileView.tsx:151` — **} >** · onClick: `() => { onSelectId(null); setScreen('list'); `
- `src/apps/events/components/EventsMobileView.tsx:167` — **onEdit(e)} title= >** · onClick: `() => onEdit(e)`
- `src/apps/events/components/EventsMobileView.tsx:183` — **setDetailTab('info')} >** · onClick: `() => setDetailTab('info')`
- `src/apps/events/components/EventsMobileView.tsx:192` — **setDetailTab('attendance')} > )}** · onClick: `() => setDetailTab('attendance')`
- `src/apps/events/components/EventsMobileView.tsx:403` — **onOpenTicket(e)} >** · onClick: `() => onOpenTicket(e)`
- `src/apps/events/components/EventsMobileView.tsx:448` — **onRegister(e)} style= } >** · onClick: `() => onRegister(e)`
- `src/apps/events/components/EventsMobileView.tsx:459` — **setManageSheetOpen(true)} title= style= } >** · onClick: `() => setManageSheetOpen(true)`
- `src/apps/events/components/EventsMobileView.tsx:474` — **onOpenTicket(e)} title= >** · onClick: `() => onOpenTicket(e)`
- `src/apps/events/components/EventsMobileView.tsx:486` — **(icon-only)** · onClick: `onStartScan`
- `src/apps/events/components/EventsMobileView.tsx:499` — **onUnregister(e)} title= >** · onClick: `() => onUnregister(e)`
- `src/apps/events/components/EventsMobileView.tsx:512` — **setManageSheetOpen(true)} title= >** · onClick: `() => setManageSheetOpen(true)`
- `src/apps/events/components/EventsMobileView.tsx:532` — **} >** · onClick: `() => { setManageSheetOpen(false); onProjector(e); `
- `src/apps/events/components/EventsMobileView.tsx:544` — **} >** · onClick: `() => { setManageSheetOpen(false); onEdit(e); `
- `src/apps/events/components/EventsMobileView.tsx:556` — **, t('evSaved') ).then((ok) => ok && onTabChange(tabOf( ))); }} >** · onClick: `() => { setManageSheetOpen(false); void onAct( { action: 'updateEvent', etkinlikId: e.id, status: 'yayinda' `
- `src/apps/events/components/EventsMobileView.tsx:572` — **), tone: 'danger', }) ) ); } }} >** · onClick: `async () => { setManageSheetOpen(false); if ( await dialog.confirm({ message: fill(t('evCancelEventConfirm'), { title: e.baslik `
- `src/apps/events/components/EventsMobileView.tsx:596` — **), tone: 'danger', }) ) )) } }} > Sil** · onClick: `async () => { setManageSheetOpen(false); if ( await dialog.confirm({ message: fill(t('evDeleteConfirm'), { title: e.baslik `
- `src/apps/events/components/EventsMobileView.tsx:619` — **setManageSheetOpen(false)} >** · onClick: `() => setManageSheetOpen(false)`
- `src/apps/events/components/EventsMobileView.tsx:649` — **(icon-only)** · onClick: `onNewEvent`
- `src/apps/events/components/EventsMobileView.tsx:659` — **void refetch()} title="Yenile" >** · onClick: `() => void refetch()`
- `src/apps/events/components/EventsMobileView.tsx:675` — **onTabChange(id)} > ) )}** · onClick: `() => onTabChange(id)`
- `src/apps/events/components/EventsMobileView.tsx:706` — **onQueryChange('')} >** · onClick: `() => onQueryChange('')`
- `src/apps/events/components/EventsMobileView.tsx:789` — **(icon-only)** · onClick: `onStartScan`
- `src/apps/events/components/EventsSidebar.tsx:78` — **onSelectId(e.id)} > )} · {isLive(e, now) && <span className=** · onClick: `() => onSelectId(e.id)`
- `src/apps/events/components/EventsSidebar.tsx:144` — **(icon-only)** · onClick: `onNewEvent`
- `src/apps/events/components/EventsSidebar.tsx:156` — **onTabChange(id)} > }** · onClick: `() => onTabChange(id)`

### Form alanları / input yüzeyi (3)

- `src/apps/events/components/CameraQRScannerModal.tsx:121` — text value={manualCode}
- `src/apps/events/components/EventsMobileView.tsx:698` — text value={query}
- `src/apps/events/components/EventsSidebar.tsx:172` — input value={query}

## inventory

- Dosya: 11
- Bulunan API çağrıları: /api/inventory, /api/members

### Butonlar / aksiyonlar (27)

- `src/apps/inventory/components/InventoryCard.tsx:96` — **onDetail(item.id)}>** · onClick: `() => onDetail(item.id)`
- `src/apps/inventory/components/InventoryCard.tsx:124` — **onLoan( )} >** · onClick: `() => onLoan({ id: item.id, mode: 'borrow' `
- `src/apps/inventory/components/InventoryCard.tsx:133` — **onLoan( )} >** · onClick: `() => onLoan({ id: item.id, mode: 'return' `
- `src/apps/inventory/components/InventoryCard.tsx:142` — **onLoan( )} >** · onClick: `() => onLoan({ id: item.id, mode: 'lend' `
- `src/apps/inventory/components/InventoryCard.tsx:150` — **onDetail(item.id)} aria-label= >** · onClick: `() => onDetail(item.id)`
- `src/apps/inventory/components/InventoryMobileView.tsx:123` — **inv.setKategori('')} > ( )** · onClick: `() => inv.setKategori('')`
- `src/apps/inventory/components/InventoryMobileView.tsx:131` — **inv.setKategori(inv.kategori === cat ? '' : cat)} >** · onClick: `() => inv.setKategori(inv.kategori === cat ? '' : cat)`
- `src/apps/inventory/components/InventoryMobileView.tsx:315` — **inv.setLoan( )} >** · onClick: `() => inv.setLoan({ id: item.id, mode: 'return' `
- `src/apps/inventory/components/InventoryMobileView.tsx:348` — **handleTabChange(tab.id)} title= style= : undefined} > )}** · onClick: `() => handleTabChange(tab.id)`
- `src/apps/inventory/components/InventoryToolbar.tsx:45` — **setFilter(filter === key ? 'hepsi' : key)} aria-pressed= >** · onClick: `() => setFilter(filter === key ? 'hepsi' : key)`
- `src/apps/inventory/components/InventoryToolbar.tsx:104` — **setFilter(filter === 'bende' ? 'hepsi' : 'bende')} aria-pressed= > )}** · onClick: `() => setFilter(filter === 'bende' ? 'hepsi' : 'bende')`
- `src/apps/inventory/components/InventoryToolbar.tsx:114` — **(icon-only)** · onClick: `onNewItem`
- `src/apps/inventory/components/ItemDetailModal.tsx:250` — **onLoan('borrow')}>** · onClick: `() => onLoan('borrow')`
- `src/apps/inventory/components/ItemDetailModal.tsx:255` — **onLoan('lend')}>** · onClick: `() => onLoan('lend')`
- `src/apps/inventory/components/ItemDetailModal.tsx:261` — **onLoan('return')}>** · onClick: `() => onLoan('return')`
- `src/apps/inventory/components/ItemDetailModal.tsx:264` — **onLoan('extend')}>** · onClick: `() => onLoan('extend')`
- `src/apps/inventory/components/ItemDetailModal.tsx:280` — **(icon-only)** · onClick: `printLabel`
- `src/apps/inventory/components/ItemDetailModal.tsx:295` — **(icon-only)** · onClick: `onEdit`
- `src/apps/inventory/components/ItemDetailModal.tsx:299` — **setStatus('saglam')}>** · onClick: `() => setStatus('saglam')`
- `src/apps/inventory/components/ItemDetailModal.tsx:304` — **setStatus('arizali')}>** · onClick: `() => setStatus('arizali')`
- `src/apps/inventory/components/ItemDetailModal.tsx:309` — **setStatus('kayip')}>** · onClick: `() => setStatus('kayip')`
- `src/apps/inventory/components/ItemDetailModal.tsx:314` — **(icon-only)** · onClick: `remove`
- `src/apps/inventory/components/ItemFormModal.tsx:72` — **(icon-only)** · onClick: `onClose`
- `src/apps/inventory/components/ItemFormModal.tsx:75` — **(icon-only)**
- `src/apps/inventory/components/ItemFormModal.tsx:166` — **setDurum(d)} >** · onClick: `() => setDurum(d)`
- `src/apps/inventory/components/LoanModal.tsx:129` — **(icon-only)** · onClick: `onClose`
- `src/apps/inventory/components/LoanModal.tsx:132` — **(icon-only)**

### Form alanları / input yüzeyi (13)

- `src/apps/inventory/components/InventoryMobileView.tsx:112` — text value={inv.arama}
- `src/apps/inventory/components/InventoryToolbar.tsx:83` — input value={arama}
- `src/apps/inventory/components/InventoryToolbar.tsx:91` — button value={kategori}
- `src/apps/inventory/components/ItemFormModal.tsx:84` — input placeholder="LAB-RPI-006" value={kod}
- `src/apps/inventory/components/ItemFormModal.tsx:100` — input value={seriNo}
- `src/apps/inventory/components/ItemFormModal.tsx:111` — input value={ad}
- `src/apps/inventory/components/ItemFormModal.tsx:124` — input value={kategori}
- `src/apps/inventory/components/ItemFormModal.tsx:141` — input value={konum}
- `src/apps/inventory/components/ItemFormModal.tsx:154` — button value={aciklama}
- `src/apps/inventory/components/LoanModal.tsx:141` — select value={userId}
- `src/apps/inventory/components/LoanModal.tsx:163` — date value={date}
- `src/apps/inventory/components/LoanModal.tsx:185` — checkbox value={not}
- `src/apps/inventory/components/LoanModal.tsx:190` — textarea value={not}

## mail

- Dosya: 10
- Bulunan API çağrıları: /api/mail, /api/mail/${uid}, /api/mail/action, /api/mail/groups, /api/mail/outbox

### Butonlar / aksiyonlar (63)

- `src/apps/mail/components/MailComposeModal.tsx:127` — **(icon-only)** · onClick: `onClose`
- `src/apps/mail/components/MailComposeModal.tsx:200` — **(icon-only)** · onClick: `onClose`
- `src/apps/mail/components/MailComposeModal.tsx:208` — **(icon-only)**
- `src/apps/mail/components/MailDetail.tsx:144` — **(icon-only)** · onClick: `onBackMobile`
- `src/apps/mail/components/MailDetail.tsx:150` — **(icon-only)** · onClick: `onRetry`
- `src/apps/mail/components/MailDetail.tsx:183` — **(icon-only)** · onClick: `onBackMobile`
- `src/apps/mail/components/MailDetail.tsx:193` — **onReply(false)} title= >** · onClick: `() => onReply(false)`
- `src/apps/mail/components/MailDetail.tsx:203` — **onReply(true)} title= >** · onClick: `() => onReply(true)`
- `src/apps/mail/components/MailDetail.tsx:217` — **(icon-only)** · onClick: `onRestore`
- `src/apps/mail/components/MailDetail.tsx:227` — **(icon-only)** · onClick: `onToggleStar`
- `src/apps/mail/components/MailDetail.tsx:239` — **(icon-only)** · onClick: `onToggleRead`
- `src/apps/mail/components/MailDetail.tsx:247` — **}** · onClick: `onTrash`
- `src/apps/mail/components/MailDetail.tsx:295` — **setLoadRemoteImages(true)} >** · onClick: `() => setLoadRemoteImages(true)`
- `src/apps/mail/components/MailList.tsx:145` — **} title= style= } >** · onClick: `(e) => { e.stopPropagation(); onToggleSelectUid?.(msg.uid); `
- `src/apps/mail/components/MailList.tsx:248` — **(icon-only)** · onClick: `onEmptyTrash`
- `src/apps/mail/components/MailList.tsx:259` — **else }} title= >** · onClick: `() => { if (hasSelected && onDeselectAll) { onDeselectAll(); setIsSelectMode(false); `
- `src/apps/mail/components/MailList.tsx:275` — **(icon-only)** · onClick: `onRefresh`
- `src/apps/mail/components/MailList.tsx:297` — **onSearchChange('')} title= style= } >** · onClick: `() => onSearchChange('')`
- `src/apps/mail/components/MailList.tsx:322` — **(icon-only)** · onClick: `isAllSelected ? onDeselectAll : onSelectAll`
- `src/apps/mail/components/MailList.tsx:336` — **onBatchToggleRead(true)} title= >** · onClick: `() => onBatchToggleRead(true)`
- `src/apps/mail/components/MailList.tsx:347` — **(icon-only)** · onClick: `onBatchTrash`
- `src/apps/mail/components/MailList.tsx:358` — **(icon-only)** · onClick: `onDeselectAll`
- `src/apps/mail/components/MailList.tsx:420` — **onPageChange(page - 1)} >** · onClick: `() => onPageChange(page - 1)`
- `src/apps/mail/components/MailList.tsx:433` — **= totalPages || isLoading} onClick= >** · onClick: `() => onPageChange(page + 1)`
- `src/apps/mail/components/MailMobileView.tsx:173` — **(icon-only)** · onClick: `onClose`
- `src/apps/mail/components/MailMobileView.tsx:186` — **(icon-only)** · onClick: `handleSendSubmit`
- `src/apps/mail/components/MailMobileView.tsx:290` — **onTabChange(tab.id)} title= style= : undefined} > )}** · onClick: `() => onTabChange(tab.id)`
- `src/apps/mail/components/MailMobileView.tsx:570` — **(icon-only)** · onClick: `onOpenCompose`
- `src/apps/mail/components/MailMobileView.tsx:622` — **(icon-only)** · onClick: `onRefresh`
- `src/apps/mail/components/MailMobileView.tsx:675` — **} >** · onClick: `() => { onDeselectMessage(); setScreen('list'); `
- `src/apps/mail/components/MailMobileView.tsx:694` — **(icon-only)** · onClick: `onToggleStar`
- `src/apps/mail/components/MailMobileView.tsx:706` — **(icon-only)** · onClick: `onToggleRead`
- `src/apps/mail/components/MailMobileView.tsx:737` — **(icon-only)** · onClick: `onRetryDetail`
- `src/apps/mail/components/MailMobileView.tsx:790` — **setLoadRemoteImages(true)} >** · onClick: `() => setLoadRemoteImages(true)`
- `src/apps/mail/components/MailMobileView.tsx:850` — **(icon-only)** · onClick: `onRestore`
- `src/apps/mail/components/MailMobileView.tsx:861` — **(icon-only)** · onClick: `onTrash`
- `src/apps/mail/components/MailMobileView.tsx:871` — **(icon-only)** · onClick: `onToggleStar`
- `src/apps/mail/components/MailMobileView.tsx:885` — **(icon-only)** · onClick: `onToggleRead`
- `src/apps/mail/components/MailMobileView.tsx:895` — **setIsReplySheetOpen(true)} title= style= } >** · onClick: `() => setIsReplySheetOpen(true)`
- `src/apps/mail/components/MailMobileView.tsx:926` — **} style= } >** · onClick: `() => { setIsReplySheetOpen(false); onReply(false); `
- `src/apps/mail/components/MailMobileView.tsx:951` — **} style= } >** · onClick: `() => { setIsReplySheetOpen(false); onReply(true); `
- `src/apps/mail/components/MailMobileView.tsx:976` — **setIsReplySheetOpen(false)} style= } >** · onClick: `() => setIsReplySheetOpen(false)`
- `src/apps/mail/components/MailMobileView.tsx:1011` — **(icon-only)** · onClick: `isAllSelected ? onDeselectAll : onSelectAll`
- `src/apps/mail/components/MailMobileView.tsx:1023` — **} style= } >** · onClick: `() => { setIsSelecting(false); onDeselectAll?.(); `
- `src/apps/mail/components/MailMobileView.tsx:1037` — **setScreen('mailboxes')} >** · onClick: `() => setScreen('mailboxes')`
- `src/apps/mail/components/MailMobileView.tsx:1052` — **setIsSelecting(true)} >** · onClick: `() => setIsSelecting(true)`
- `src/apps/mail/components/MailMobileView.tsx:1060` — **(icon-only)** · onClick: `onOpenCompose`
- `src/apps/mail/components/MailMobileView.tsx:1079` — **(icon-only)** · onClick: `onEmptyTrash`
- `src/apps/mail/components/MailMobileView.tsx:1089` — **(icon-only)** · onClick: `onRefresh`
- `src/apps/mail/components/MailMobileView.tsx:1114` — **onSearchChange('')} title= >** · onClick: `() => onSearchChange('')`
- `src/apps/mail/components/MailMobileView.tsx:1241` — **onPageChange(page - 1)} > ‹** · onClick: `() => onPageChange(page - 1)`
- `src/apps/mail/components/MailMobileView.tsx:1261` — **= totalPages ? 'var(--text-muted)' : 'var(--accent)', fontWeight: 600, cursor: page >= totalPages ? 'default' : 'pointer', padding: '4px 8px** · onClick: `() => onPageChange(page + 1)`
- `src/apps/mail/components/MailMobileView.tsx:1281` — **onBatchToggleRead?.(true)} disabled= style= } >** · onClick: `() => onBatchToggleRead?.(true)`
- `src/apps/mail/components/MailMobileView.tsx:1296` — **} disabled= style= } >** · onClick: `() => { onBatchTrash?.(); setIsSelecting(false); `
- `src/apps/mail/components/MailOutboxModal.tsx:40` — **(icon-only)** · onClick: `onClose`
- `src/apps/mail/components/MailOutboxModal.tsx:78` — **onReject(item.id)} >** · onClick: `() => onReject(item.id)`
- `src/apps/mail/components/MailOutboxModal.tsx:86` — **onApprove(item.id)} >** · onClick: `() => onApprove(item.id)`
- `src/apps/mail/components/MailSidebar.tsx:63` — **(icon-only)** · onClick: `onOpenCompose`
- `src/apps/mail/components/MailSidebar.tsx:105` — **(icon-only)** · onClick: `onRefresh`
- `src/apps/mail/index.tsx:679` — **(icon-only)** · onClick: `handleRefresh`
- `src/apps/mail/index.tsx:688` — **setOutboxOpen(true)} style= } > ( )** · onClick: `() => setOutboxOpen(true)`
- `src/apps/mail/index.tsx:773` — **setOutboxOpen(true)} style= } > ( )** · onClick: `() => setOutboxOpen(true)`
- `src/apps/mail/index.tsx:805` — **setOutboxOpen(true)} style= } > ( )** · onClick: `() => setOutboxOpen(true)`

### Form alanları / input yüzeyi (10)

- `src/apps/mail/components/MailComposeModal.tsx:152` — text placeholder="alici@example.com" value={to}
- `src/apps/mail/components/MailComposeModal.tsx:165` — select value={group.id}
- `src/apps/mail/components/MailComposeModal.tsx:181` — text value={subject}
- `src/apps/mail/components/MailComposeModal.tsx:191` — button value={body}
- `src/apps/mail/components/MailList.tsx:288` — text value={searchQuery}
- `src/apps/mail/components/MailMobileView.tsx:217` — text placeholder="alici@example.com" value={composeTo}
- `src/apps/mail/components/MailMobileView.tsx:229` — text value={group.id}
- `src/apps/mail/components/MailMobileView.tsx:245` — text value={composeSubject}
- `src/apps/mail/components/MailMobileView.tsx:255` — textarea value={composeBody}
- `src/apps/mail/components/MailMobileView.tsx:1106` — text value={searchQuery}

## mediaviewer

- Dosya: 3
- Bulunan API çağrıları: —

### Butonlar / aksiyonlar (6)

- `src/apps/mediaviewer/index.tsx:277` — **downloadMedia(item)}>** · onClick: `() => downloadMedia(item)`
- `src/apps/mediaviewer/index.tsx:386` — **setZoom((value) => clampZoom(value - ZOOM_STEP))} disabled={zoom** · onClick: `() => setZoom((value) => clampZoom(value - ZOOM_STEP))`
- `src/apps/mediaviewer/index.tsx:397` — **setZoom((value) => clampZoom(value + ZOOM_STEP))} disabled= title= (+)`} aria-label= >** · onClick: `() => setZoom((value) => clampZoom(value + ZOOM_STEP))`
- `src/apps/mediaviewer/index.tsx:407` — **setZoom(1)} title= (0)`} aria-label= >** · onClick: `() => setZoom(1)`
- `src/apps/mediaviewer/index.tsx:419` — **setInfoOpen((value) => !value)} title= (I)`} aria-label= aria-pressed= >** · onClick: `() => setInfoOpen((value) => !value)`
- `src/apps/mediaviewer/index.tsx:452` — **setInfoOpen(false)} aria-label= >** · onClick: `() => setInfoOpen(false)`

### Form alanları / input yüzeyi (0)

_Bulunamadı._


## members

- Dosya: 13
- Bulunan API çağrıları: /api/form-fields, /api/members, /api/members/${encodeURIComponent(id)}/password-reset, /api/members/${encodeURIComponent(memberId)}, /api/posta/alicilar, /api/registration-config, /api/roles

### Butonlar / aksiyonlar (29)

- `src/apps/members/components/AddMemberModal.tsx:89` — **(icon-only)** · onClick: `onClose`
- `src/apps/members/components/AddMemberModal.tsx:92` — **(icon-only)**
- `src/apps/members/components/MemberActions.tsx:25` — **onUpdateStatus(member.id, 'aktif')} title= style= } >** · onClick: `() => onUpdateStatus(member.id, 'aktif')`
- `src/apps/members/components/MemberActions.tsx:44` — **onUpdateStatus(member.id, 'reddedildi')} title= style= } >** · onClick: `() => onUpdateStatus(member.id, 'reddedildi')`
- `src/apps/members/components/MemberActions.tsx:67` — **} title= aria-label= data-member-menu= style= } >** · onClick: `(e) => { e.stopPropagation(); onOpenContextMenu(e); `
- `src/apps/members/components/MemberCard.tsx:117` — **onOpenProfile(member)} style= } >** · onClick: `() => onOpenProfile(member)`
- `src/apps/members/components/MemberCard.tsx:234` — **onSendMessage(member.id)} style= } > Mesaj** · onClick: `() => onSendMessage(member.id)`
- `src/apps/members/components/MemberCard.tsx:256` — **onOpenProfile(member)} style= } > Profil** · onClick: `() => onOpenProfile(member)`
- `src/apps/members/components/MemberCard.tsx:279` — **onAwardXp(member.id, 25)} style= } > +25 XP** · onClick: `() => onAwardXp(member.id, 25)`
- `src/apps/members/components/MemberCard.tsx:300` — **onResetPassword(member.id, `$ $ `)} style= } title= >** · onClick: `() => onResetPassword(member.id, `${member.ad`
- `src/apps/members/components/MemberCard.tsx:322` — **openApp('soc', )} style= } title= > SOC** · onClick: `() => openApp('soc', { section: 'siem', kind: 'user', itemId: member.id `
- `src/apps/members/components/MemberCard.tsx:346` — **onDelete(member.id, `$ $ `)} style= } title= >** · onClick: `() => onDelete(member.id, `${member.ad`
- `src/apps/members/components/MemberDetailModal.tsx:428` — **} style= } > )}** · onClick: `() => { onClose(); onSendMessage(member.id); `
- `src/apps/members/components/MemberDetailModal.tsx:442` — **setEditOpen(true)} style= } >** · onClick: `() => setEditOpen(true)`
- `src/apps/members/components/MemberDetailModal.tsx:453` — **(icon-only)** · onClick: `onSendPasswordReset`
- `src/apps/members/components/MemberDetailModal.tsx:463` — **(icon-only)** · onClick: `onClose`
- `src/apps/members/components/MemberEditSheet.tsx:172` — **(icon-only)** · onClick: `onClose`
- `src/apps/members/components/MemberEditSheet.tsx:175` — **(icon-only)**
- `src/apps/members/components/MemberRow.tsx:233` — **onSendMessage(member.id)} style= } >** · onClick: `() => onSendMessage(member.id)`
- `src/apps/members/components/MemberRow.tsx:325` — **); }} title= style= } >** · onClick: `(e) => { e.stopPropagation(); openApp('soc', { section: 'siem', kind: 'user', itemId: member.id `
- `src/apps/members/components/MembersMobileView.tsx:95` — **m.setSelectedDepartment('')} > ( )** · onClick: `() => m.setSelectedDepartment('')`
- `src/apps/members/components/MembersMobileView.tsx:103` — **m.setSelectedDepartment(m.selectedDepartment === dept.value ? '' : dept.value)} >** · onClick: `() => m.setSelectedDepartment(m.selectedDepartment === dept.value ? '' : dept.value)`
- `src/apps/members/components/MembersMobileView.tsx:165` — **); }} >** · onClick: `(e) => { e.stopPropagation(); openApp('chat', { section: 'compose', itemId: member.id `
- `src/apps/members/components/MembersMobileView.tsx:234` — **void m.handleUpdateMemberStatus(member.id, 'aktif')} >** · onClick: `() => void m.handleUpdateMemberStatus(member.id, 'aktif')`
- `src/apps/members/components/MembersMobileView.tsx:242` — **void m.handleUpdateMemberStatus(member.id, 'reddedildi')} >** · onClick: `() => void m.handleUpdateMemberStatus(member.id, 'reddedildi')`
- `src/apps/members/components/MembersMobileView.tsx:348` — **handleTabChange(tab.id)} title= style= : undefined} > )}** · onClick: `() => handleTabChange(tab.id)`
- `src/apps/members/components/MembersToolbar.tsx:175` — **onActiveFilterChange(tab.id)} >** · onClick: `() => onActiveFilterChange(tab.id)`
- `src/apps/members/components/MembersToolbar.tsx:188` — **(icon-only)** · onClick: `onRefresh`
- `src/apps/members/components/MembersToolbar.tsx:200` — **(icon-only)** · onClick: `onOpenAdd`

### Form alanları / input yüzeyi (26)

- `src/apps/members/components/AddMemberModal.tsx:103` — text value={newFirstName}
- `src/apps/members/components/AddMemberModal.tsx:107` — text placeholder="uye@orbit.local" value={newLastName}
- `src/apps/members/components/AddMemberModal.tsx:113` — email placeholder="uye@orbit.local" value={newEmail}
- `src/apps/members/components/AddMemberModal.tsx:118` — password value={newPassword}
- `src/apps/members/components/AddMemberModal.tsx:136` — select value={newTrack}
- `src/apps/members/components/AddMemberModal.tsx:149` — select value={newGrade}
- `src/apps/members/components/AddMemberModal.tsx:162` — select value={newRoleId}
- `src/apps/members/components/AddMemberModal.tsx:176` — text value={newMemberHandle}
- `src/apps/members/components/AddMemberModal.tsx:208` — textarea value={customValues[field.fieldKey] ?? ''}
- `src/apps/members/components/AddMemberModal.tsx:219` — select value={customValues[field.fieldKey] ?? ''}
- `src/apps/members/components/AddMemberModal.tsx:236` — input value={customValues[field.fieldKey] ?? ''}
- `src/apps/members/components/MemberEditSheet.tsx:188` — input value={values.ad}
- `src/apps/members/components/MemberEditSheet.tsx:198` — email value={values.soyad}
- `src/apps/members/components/MemberEditSheet.tsx:210` — email value={values.email}
- `src/apps/members/components/MemberEditSheet.tsx:225` — input value={values.ogrenciNo}
- `src/apps/members/components/MemberEditSheet.tsx:239` — select value={values.bolum}
- `src/apps/members/components/MemberEditSheet.tsx:256` — select value={values.sinif}
- `src/apps/members/components/MemberEditSheet.tsx:273` — textarea value={values.bio}
- `src/apps/members/components/MemberEditSheet.tsx:298` — select value={value}
- `src/apps/members/components/MemberEditSheet.tsx:313` — textarea value={value}
- `src/apps/members/components/MemberEditSheet.tsx:326` — input value={value}
- `src/apps/members/components/MembersMobileView.tsx:84` — text value={m.searchQuery}
- `src/apps/members/components/MembersToolbar.tsx:93` — text value={searchQuery}
- `src/apps/members/components/MembersToolbar.tsx:111` — select value={selectedDepartment}
- `src/apps/members/components/MembersToolbar.tsx:124` — select value={selectedGrade}
- `src/apps/members/components/MembersToolbar.tsx:140` — select value={roleFilter}

## news

- Dosya: 10
- Bulunan API çağrıları: /api/news

### Butonlar / aksiyonlar (15)

- `src/apps/news/components/NewsCard.tsx:242` — **(icon-only)** · onClick: `onEdit`
- `src/apps/news/components/NewsCard.tsx:262` — **(icon-only)** · onClick: `onDelete`
- `src/apps/news/components/NewsDetailModal.tsx:134` — **(icon-only)** · onClick: `onEdit`
- `src/apps/news/components/NewsDetailModal.tsx:156` — **(icon-only)** · onClick: `onDelete`
- `src/apps/news/components/NewsDetailModal.tsx:178` — **(icon-only)** · onClick: `onShare`
- `src/apps/news/components/NewsDetailModal.tsx:197` — **(icon-only)** · onClick: `onClose`
- `src/apps/news/components/NewsFormModal.tsx:131` — **(icon-only)** · onClick: `onClose`
- `src/apps/news/components/NewsFormModal.tsx:184` — **onChangeVisibility(value)} style= ` : '1px solid rgba(255, 255, 255, 0.12)', background: active ? `$ 26` : 'rgba(255, 255, 255, 0.04)', colo** · onClick: `() => onChangeVisibility(value)`
- `src/apps/news/components/NewsFormModal.tsx:349` — **onChangeResimUrl(preset.url)} style= } >** · onClick: `() => onChangeResimUrl(preset.url)`
- `src/apps/news/components/NewsFormModal.tsx:425` — **(icon-only)** · onClick: `onClose`
- `src/apps/news/components/NewsFormModal.tsx:440` — **(icon-only)**
- `src/apps/news/components/NewsToolbar.tsx:64` — **onSelectCategory(tab.id)} style= } >** · onClick: `() => onSelectCategory(tab.id)`
- `src/apps/news/components/NewsToolbar.tsx:113` — **(icon-only)** · onClick: `onOpenCreate`
- `src/apps/news/components/UrgentHeadlineBanner.tsx:79` — **onDelete(article.id, e)} disabled= title= style= } >** · onClick: `(e) => onDelete(article.id, e)`
- `src/apps/news/components/UrgentHeadlineBanner.tsx:95` — **(icon-only)**

### Form alanları / input yüzeyi (8)

- `src/apps/news/components/NewsDetailModal.tsx:112` — select value={article.publishStatus}
- `src/apps/news/components/NewsFormModal.tsx:225` — select value={newCategory}
- `src/apps/news/components/NewsFormModal.tsx:258` — checkbox
- `src/apps/news/components/NewsFormModal.tsx:283` — text value={newTitle}
- `src/apps/news/components/NewsFormModal.tsx:314` — text placeholder="..." value={newSummary}
- `src/apps/news/components/NewsFormModal.tsx:374` — text value={newResimUrl}
- `src/apps/news/components/NewsFormModal.tsx:403` — textarea placeholder="..." value={newContent}
- `src/apps/news/components/NewsToolbar.tsx:93` — text value={searchQuery}

## notes

- Dosya: 10
- Bulunan API çağrıları: /api/notes, /api/notes/folders

### Butonlar / aksiyonlar (48)

- `src/apps/notes/components/NoteCard.tsx:122` — **} title= style= } >** · onClick: `(e) => { e.stopPropagation(); onTogglePin(); `
- `src/apps/notes/components/NoteCard.tsx:173` — **} title= style= } >** · onClick: `(e) => { e.stopPropagation(); onTogglePin(); `
- `src/apps/notes/components/NoteCard.tsx:206` — **} style= } >** · onClick: `(e) => { e.stopPropagation(); onRestore(); `
- `src/apps/notes/components/NoteCard.tsx:225` — **} style= } >** · onClick: `(e) => { e.stopPropagation(); onDelete(); `
- `src/apps/notes/components/NoteEditor.tsx:92` — **(icon-only)** · onClick: `onCreateNote`
- `src/apps/notes/components/NoteEditor.tsx:117` — **(icon-only)** · onClick: `onToggleFolderMenu`
- `src/apps/notes/components/NoteEditor.tsx:143` — **onMoveFolder(activeNote.id, fld.id)} style= } >** · onClick: `() => onMoveFolder(activeNote.id, fld.id)`
- `src/apps/notes/components/NotesList.tsx:110` — **onSearchChange('')} style= } >** · onClick: `() => onSearchChange('')`
- `src/apps/notes/components/NotesList.tsx:142` — **(icon-only)** · onClick: `onEmptyTrash`
- `src/apps/notes/components/NotesList.tsx:197` — **(icon-only)** · onClick: `onCreateNote`
- `src/apps/notes/components/NotesMobileView.tsx:154` — **} style= } >** · onClick: `() => { playSystemSound(); onSelectNote(null); `
- `src/apps/notes/components/NotesMobileView.tsx:191` — **onTogglePin(activeNote.id)} title= style= } >** · onClick: `() => onTogglePin(activeNote.id)`
- `src/apps/notes/components/NotesMobileView.tsx:208` — **} title= style= } >** · onClick: `() => { onDeleteNote(activeNote.id); onSelectNote(null); `
- `src/apps/notes/components/NotesMobileView.tsx:228` — **} style= } >** · onClick: `() => { playSystemSound(); onSelectNote(null); `
- `src/apps/notes/components/NotesMobileView.tsx:283` — **insertMarkdown('**', '**')} style= } title= >** · onClick: `() => insertMarkdown('**', '**')`
- `src/apps/notes/components/NotesMobileView.tsx:301` — **insertMarkdown('*', '*')} style= } title= >** · onClick: `() => insertMarkdown('*', '*')`
- `src/apps/notes/components/NotesMobileView.tsx:319` — **insertMarkdown('\n- [ ] ')} style= } title= >** · onClick: `() => insertMarkdown('\n- [ ] ')`
- `src/apps/notes/components/NotesMobileView.tsx:339` — **insertMarkdown('\n- ')} style= } title= >** · onClick: `() => insertMarkdown('\n- ')`
- `src/apps/notes/components/NotesMobileView.tsx:423` — **} style= } > ( )** · onClick: `() => { playSystemSound(); onSelectFolder(folder.id); `
- `src/apps/notes/components/NotesMobileView.tsx:485` — **onSearchChange('')} style= } >** · onClick: `() => onSearchChange('')`
- `src/apps/notes/components/NotesMobileView.tsx:668` — **(icon-only)** · onClick: `onCreateNote`
- `src/apps/notes/components/NotesToolbar.tsx:100` — **(icon-only)** · onClick: `onToggleSidebar`
- `src/apps/notes/components/NotesToolbar.tsx:126` — **onSetViewMode('list')} title= style= } >** · onClick: `() => onSetViewMode('list')`
- `src/apps/notes/components/NotesToolbar.tsx:143` — **onSetViewMode('grid')} title= style= } >** · onClick: `() => onSetViewMode('grid')`
- `src/apps/notes/components/NotesToolbar.tsx:163` — **(icon-only)** · onClick: `onDeleteActiveNote`
- `src/apps/notes/components/NotesToolbar.tsx:185` — **onInsertText('# ')} title= style= }>** · onClick: `() => onInsertText('# ')`
- `src/apps/notes/components/NotesToolbar.tsx:188` — **onInsertText('## ')} title= style= }>** · onClick: `() => onInsertText('## ')`
- `src/apps/notes/components/NotesToolbar.tsx:191` — **onInsertText('**', '**')} title= style= }>** · onClick: `() => onInsertText('**', '**')`
- `src/apps/notes/components/NotesToolbar.tsx:194` — **onInsertText('*', '*')} title= style= }>** · onClick: `() => onInsertText('*', '*')`
- `src/apps/notes/components/NotesToolbar.tsx:197` — **onInsertText('~~', '~~')} title= style= }>** · onClick: `() => onInsertText('~~', '~~')`
- `src/apps/notes/components/NotesToolbar.tsx:201` — **(icon-only)** · onClick: `onInsertChecklist`
- `src/apps/notes/components/NotesToolbar.tsx:204` — **onInsertText('- ')} title= style= }>** · onClick: `() => onInsertText('- ')`
- `src/apps/notes/components/NotesToolbar.tsx:207` — **onInsertText('1. ')} title= style= }>** · onClick: `() => onInsertText('1. ')`
- `src/apps/notes/components/NotesToolbar.tsx:210` — **(icon-only)** · onClick: `onInsertTable`
- `src/apps/notes/components/NotesToolbar.tsx:213` — **onInsertText('```\n', '\n```')} title= style= }>** · onClick: `() => onInsertText('```\n', '\n```')`
- `src/apps/notes/components/NotesToolbar.tsx:216` — **onInsertText('> ')} title= style= }>** · onClick: `() => onInsertText('> ')`
- `src/apps/notes/components/NotesToolbar.tsx:226` — **(icon-only)** · onClick: `onTogglePinActiveNote`
- `src/apps/notes/components/NotesToolbar.tsx:244` — **(icon-only)** · onClick: `onToggleShareMenu`
- `src/apps/notes/components/NotesToolbar.tsx:279` — **(icon-only)** · onClick: `onCopyText`
- `src/apps/notes/components/NotesToolbar.tsx:298` — **(icon-only)** · onClick: `onDownloadMarkdown`
- `src/apps/notes/components/NotesToolbar.tsx:317` — **(icon-only)** · onClick: `onPrint`
- `src/apps/notes/components/NotesToolbar.tsx:340` — **onSetEditorMode(editorMode === 'edit' ? 'preview' : 'edit')} title= style= } >** · onClick: `() => onSetEditorMode(editorMode === 'edit' ? 'preview' : 'edit')`
- `src/apps/notes/components/NotesToolbar.tsx:359` — **(icon-only)** · onClick: `onCreateNote`
- `src/apps/notes/components/SidebarFolders.tsx:118` — **} style= } > <div style=** · onClick: `() => { onSelectFolder(fld.id); playSystemSound(); `
- `src/apps/notes/components/SidebarFolders.tsx:163` — **} style= } >** · onClick: `() => { onSelectFolder('trash'); playSystemSound(); `
- `src/apps/notes/components/SidebarFolders.tsx:217` — **onShowNewFolderModal(false)} style= } >** · onClick: `() => onShowNewFolderModal(false)`
- `src/apps/notes/components/SidebarFolders.tsx:231` — **(icon-only)** · onClick: `onCreateFolder`
- `src/apps/notes/components/SidebarFolders.tsx:249` — **onShowNewFolderModal(true)} style= } >** · onClick: `() => onShowNewFolderModal(true)`

### Form alanları / input yüzeyi (7)

- `src/apps/notes/components/NoteEditor.tsx:190` — text value={activeNote.title}
- `src/apps/notes/components/NoteEditor.tsx:203` — textarea value={activeNote.body}
- `src/apps/notes/components/NotesList.tsx:95` — text value={searchQuery}
- `src/apps/notes/components/NotesMobileView.tsx:253` — text value={activeNote.title}
- `src/apps/notes/components/NotesMobileView.tsx:360` — textarea value={activeNote.body}
- `src/apps/notes/components/NotesMobileView.tsx:470` — text value={searchQuery}
- `src/apps/notes/components/SidebarFolders.tsx:196` — text value={newFolderName}

## projects

- Dosya: 11
- Bulunan API çağrıları: /api/projects, /api/projects/${encodeURIComponent(p.id)}, /api/projects/${encodeURIComponent(proje.id)}, /api/teams

### Butonlar / aksiyonlar (26)

- `src/apps/projects/components/ProjectCard.tsx:90` — **} >** · onClick: `(e) => { e.stopPropagation(); onOpenTeam(p.teamId!); `
- `src/apps/projects/components/ProjectCard.tsx:146` — **onStar(p)} >** · onClick: `() => onStar(p)`
- `src/apps/projects/components/ProjectDetailModal.tsx:71` — **onOpenTeam(proje.teamId!)} title= >** · onClick: `() => onOpenTeam(proje.teamId!)`
- `src/apps/projects/components/ProjectDetailModal.tsx:92` — **(icon-only)** · onClick: `onEdit`
- `src/apps/projects/components/ProjectDetailModal.tsx:97` — **onPatch( , t('pjPublished'))}>** · onClick: `() => onPatch({ status: 'yayinda' `
- `src/apps/projects/components/ProjectDetailModal.tsx:103` — **onPatch( , t('pjSaved'))} >** · onClick: `() => onPatch({ oneCikan: Number(proje.oneCikan) !== 1 `
- `src/apps/projects/components/ProjectDetailModal.tsx:111` — **onPatch( , t('pjSaved'))}>** · onClick: `() => onPatch({ status: 'oneri' `
- `src/apps/projects/components/ProjectDetailModal.tsx:114` — **onPatch( , t('pjSaved'))}>** · onClick: `() => onPatch({ status: 'arsiv' `
- `src/apps/projects/components/ProjectDetailModal.tsx:120` — **onPatch( , t('pjSaved'))}>** · onClick: `() => onPatch({ status: 'yayinda' `
- `src/apps/projects/components/ProjectDetailModal.tsx:125` — **(icon-only)** · onClick: `remove`
- `src/apps/projects/components/ProjectDetailModal.tsx:151` — **(icon-only)** · onClick: `onStar`
- `src/apps/projects/components/ProjectFormModal.tsx:77` — **(icon-only)** · onClick: `onClose`
- `src/apps/projects/components/ProjectFormModal.tsx:80` — **(icon-only)**
- `src/apps/projects/components/ProjectKanbanBoard.tsx:230` — **onStar(p)} style= } >** · onClick: `() => onStar(p)`
- `src/apps/projects/components/ProjectsHeader.tsx:28` — **(icon-only)** · onClick: `onOpenForm`
- `src/apps/projects/components/ProjectsMobileView.tsx:99` — **} >** · onClick: `(e) => { e.stopPropagation(); void p.star(proj); `
- `src/apps/projects/components/ProjectsMobileView.tsx:159` — **p.setTech(null)} >** · onClick: `() => p.setTech(null)`
- `src/apps/projects/components/ProjectsMobileView.tsx:167` — **p.setTech(p.tech === tItem ? null : tItem)} >** · onClick: `() => p.setTech(p.tech === tItem ? null : tItem)`
- `src/apps/projects/components/ProjectsMobileView.tsx:266` — **handleTabChange(tab.id)} title= style= : undefined} > )}** · onClick: `() => handleTabChange(tab.id)`
- `src/apps/projects/components/ProjectsToolbar.tsx:54` — **} > }** · onClick: `() => { onSelectTab(x.id); onSelectTech(null); `
- `src/apps/projects/components/ProjectsToolbar.tsx:79` — **onQueryChange('')} aria-label= >** · onClick: `() => onQueryChange('')`
- `src/apps/projects/components/ProjectsToolbar.tsx:101` — **onViewModeChange('grid')} title= aria-label= >** · onClick: `() => onViewModeChange('grid')`
- `src/apps/projects/components/ProjectsToolbar.tsx:110` — **onViewModeChange('kanban')} title= aria-label= >** · onClick: `() => onViewModeChange('kanban')`
- `src/apps/projects/components/ProjectsToolbar.tsx:125` — **onSelectTech(null)} >** · onClick: `() => onSelectTech(null)`
- `src/apps/projects/components/ProjectsToolbar.tsx:133` — **onSelectTech(activeTech === x ? null : x)} >** · onClick: `() => onSelectTech(activeTech === x ? null : x)`
- `src/apps/projects/index.tsx:67` — **p.refetch()}>** · onClick: `() => p.refetch()`

### Form alanları / input yüzeyi (11)

- `src/apps/projects/components/ProjectFormModal.tsx:88` — input value={baslik}
- `src/apps/projects/components/ProjectFormModal.tsx:105` — textarea value={ozet}
- `src/apps/projects/components/ProjectFormModal.tsx:119` — url value={aciklama}
- `src/apps/projects/components/ProjectFormModal.tsx:136` — url placeholder="https://github.com/tetha42/…" value={repoUrl}
- `src/apps/projects/components/ProjectFormModal.tsx:146` — url placeholder="https://…" value={canliUrl}
- `src/apps/projects/components/ProjectFormModal.tsx:160` — input value={tech}
- `src/apps/projects/components/ProjectFormModal.tsx:178` — select value={teamId}
- `src/apps/projects/components/ProjectFormModal.tsx:194` — select value={ownerTeamId}
- `src/apps/projects/components/ProjectsMobileView.tsx:147` — text value={p.query}
- `src/apps/projects/components/ProjectsToolbar.tsx:72` — button value={query}
- `src/apps/projects/components/ProjectsToolbar.tsx:89` — button value={sort}

## settings

- Dosya: 45
- Bulunan API çağrıları: /api/audit, /api/auth/2fa/disable, /api/auth/2fa/enable, /api/auth/2fa/setup, /api/auth/2fa/status, /api/auth/passkey, /api/auth/passkey/register/options, /api/auth/passkey/register/verify, /api/legal/accept, /api/legal/status, /api/members, /api/oauth/clients, /api/profile, /api/profile/email, /api/profile/email/confirm, /api/profile/password, /api/profile/photo, /api/registration-config, /api/roles, /api/settings/anonymize, /api/settings/community, /api/settings/export, /api/settings/form-fields, /api/settings/identity, /api/settings/identity/icon, /api/settings/invitations, /api/settings/legal, /api/settings/legal/versions, /api/settings/membership-policy, /api/settings/registration-fields, /api/settings/smtp, /api/settings/smtp/test, /api/settings/team-categories, /api/settings/wallpapers

### Butonlar / aksiyonlar (98)

- `src/apps/settings/components/Account/AccountPanel.tsx:317` — **setEmailOpen((open) => !open)} disabled= >** · onClick: `() => setEmailOpen((open) => !open)`
- `src/apps/settings/components/Account/AccountPanel.tsx:367` — **(icon-only)** · onClick: `closeEmailChange`
- `src/apps/settings/components/Account/AccountPanel.tsx:389` — **void requestEmailCode()} disabled= >** · onClick: `() => void requestEmailCode()`
- `src/apps/settings/components/Account/AccountPanel.tsx:406` — **void confirmEmailCode()} disabled= >** · onClick: `() => void confirmEmailCode()`
- `src/apps/settings/components/Account/AccountPanel.tsx:493` — **(icon-only)**
- `src/apps/settings/components/Account/AccountPanel.tsx:528` — **setActiveLegal(document)} disabled= >** · onClick: `() => setActiveLegal(document)`
- `src/apps/settings/components/Account/AccountPasswordForm.tsx:74` — **(icon-only)**
- `src/apps/settings/components/Account/AccountProfileHero.tsx:90` — **fileRef.current?.click()} disabled= aria-label= title= >** · onClick: `() => fileRef.current?.click()`
- `src/apps/settings/components/Account/AccountProfileHero.tsx:120` — **fileRef.current?.click()} disabled= >** · onClick: `() => fileRef.current?.click()`
- `src/apps/settings/components/Account/AccountProfileHero.tsx:124` — **(icon-only)** · onClick: `removePhoto`
- `src/apps/settings/components/Panels/AppearancePanel.tsx:36` — **onChange(!checked)} style= } >** · onClick: `() => onChange(!checked)`
- `src/apps/settings/components/Panels/AppearancePanel.tsx:100` — **setTheme(mode)} style= } > <div style={{ di** · onClick: `() => setTheme(mode)`
- `src/apps/settings/components/Panels/AppearancePanel.tsx:142` — **setAccent(id)} style= } >** · onClick: `() => setAccent(id)`
- `src/apps/settings/components/Panels/AppearancePanel.tsx:223` — **(icon-only)** · onClick: `toggleMute`
- `src/apps/settings/components/Panels/AppearancePanel.tsx:240` — **(icon-only)** · onClick: `playSystemSound`
- `src/apps/settings/components/Panels/CommunitySettingsPanel.tsx:329` — **iconInputRef.current?.click()} disabled= style= } >** · onClick: `() => iconInputRef.current?.click()`
- `src/apps/settings/components/Panels/CommunitySettingsPanel.tsx:351` — **void removeIcon()} disabled= style= } >** · onClick: `() => void removeIcon()`
- `src/apps/settings/components/Panels/CommunitySettingsPanel.tsx:602` — **(icon-only)**
- `src/apps/settings/components/Panels/FormDesignerPanel.tsx:264` — **(icon-only)** · onClick: `startNew`
- `src/apps/settings/components/Panels/FormDesignerPanel.tsx:336` — **selectField(field)} style= } >** · onClick: `() => selectField(field)`
- `src/apps/settings/components/Panels/FormDesignerPanel.tsx:361` — **void moveField(field.id, -1)} disabled= title= style= } >** · onClick: `() => void moveField(field.id, -1)`
- `src/apps/settings/components/Panels/FormDesignerPanel.tsx:370` — **void moveField(field.id, 1)} disabled= title= style= } >** · onClick: `() => void moveField(field.id, 1)`
- `src/apps/settings/components/Panels/FormDesignerPanel.tsx:560` — **(icon-only)** · onClick: `addOption`
- `src/apps/settings/components/Panels/FormDesignerPanel.tsx:602` — **removeOption(index)} title= style= } >** · onClick: `() => removeOption(index)`
- `src/apps/settings/components/Panels/FormDesignerPanel.tsx:632` — **void removeField()} disabled= style= } >** · onClick: `() => void removeField()`
- `src/apps/settings/components/Panels/FormDesignerPanel.tsx:656` — **} disabled= style= } >** · onClick: `() => { setDraft(null); setActiveId(null); setStatus(null); `
- `src/apps/settings/components/Panels/FormDesignerPanel.tsx:677` — **void save()} disabled= style= } >** · onClick: `() => void save()`
- `src/apps/settings/components/Panels/LanguageSettingsPanel.tsx:35` — **setLanguage(lang.id)} aria-pressed= style= } > <span style={{ fontSize: '32px',** · onClick: `() => setLanguage(lang.id)`
- `src/apps/settings/components/Panels/LegalSettingsPanel.tsx:205` — **(icon-only)** · onClick: `startNew`
- `src/apps/settings/components/Panels/LegalSettingsPanel.tsx:251` — **selectDocument(document)} style= } > style={{ opacity: 0.5** · onClick: `() => selectDocument(document)`
- `src/apps/settings/components/Panels/LegalSettingsPanel.tsx:415` — **activeDocument && selectDocument(activeDocument)} disabled= style= } >** · onClick: `() => activeDocument && selectDocument(activeDocument)`
- `src/apps/settings/components/Panels/LegalSettingsPanel.tsx:432` — **void save()} disabled= style= } >** · onClick: `() => void save()`
- `src/apps/settings/components/Panels/MembershipPolicyPanel.tsx:327` — **void save()} disabled= style= } >** · onClick: `() => void save()`
- `src/apps/settings/components/Panels/MembershipPolicyPanel.tsx:411` — **void copyLink()}>** · onClick: `() => void copyLink()`
- `src/apps/settings/components/Panels/MembershipPolicyPanel.tsx:419` — **void createInvite()} disabled= >** · onClick: `() => void createInvite()`
- `src/apps/settings/components/Panels/MembershipPolicyPanel.tsx:453` — **void revoke(invitation)} title= >** · onClick: `() => void revoke(invitation)`
- `src/apps/settings/components/Panels/OAuthAppsPanel.tsx:266` — **(icon-only)** · onClick: `openCreateModal`
- `src/apps/settings/components/Panels/OAuthAppsPanel.tsx:325` — **(icon-only)** · onClick: `openCreateModal`
- `src/apps/settings/components/Panels/OAuthAppsPanel.tsx:383` — **handleRegenerateSecret(c)} title= >** · onClick: `() => handleRegenerateSecret(c)`
- `src/apps/settings/components/Panels/OAuthAppsPanel.tsx:392` — **openEditModal(c)} >** · onClick: `() => openEditModal(c)`
- `src/apps/settings/components/Panels/OAuthAppsPanel.tsx:400` — **handleDelete(c)} title= >** · onClick: `() => handleDelete(c)`
- `src/apps/settings/components/Panels/OAuthAppsPanel.tsx:431` — **copyToClipboard(c.id, 'Client ID')} >** · onClick: `() => copyToClipboard(c.id, 'Client ID')`
- `src/apps/settings/components/Panels/OAuthAppsPanel.tsx:500` — **setShowAddModal(false)}>** · onClick: `() => setShowAddModal(false)`
- `src/apps/settings/components/Panels/OAuthAppsPanel.tsx:503` — **(icon-only)**
- `src/apps/settings/components/Panels/OAuthAppsPanel.tsx:629` — **setRevealedCreds(null)}>** · onClick: `() => setRevealedCreds(null)`
- `src/apps/settings/components/Panels/OAuthAppsPanel.tsx:664` — **copyToClipboard(revealedCreds.clientId, 'Client ID')} >** · onClick: `() => copyToClipboard(revealedCreds.clientId, 'Client ID')`
- `src/apps/settings/components/Panels/OAuthAppsPanel.tsx:683` — **copyToClipboard(revealedCreds.clientSecret, 'Client Secret')} >** · onClick: `() => copyToClipboard(revealedCreds.clientSecret, 'Client Secret')`
- `src/apps/settings/components/Panels/PasskeyAddForm.tsx:81` — **(icon-only)** · onClick: `onAddPasskey`
- `src/apps/settings/components/Panels/PasskeyList.tsx:75` — **onRemove(pk.id, pk.nickname || t('passkeyThisDevice'))} disabled= style= } title= >** · onClick: `() => onRemove(pk.id, pk.nickname || t('passkeyThisDevice'))`
- `src/apps/settings/components/Panels/PrivacyDataPanel.tsx:151` — **void anonymize()} >** · onClick: `() => void anonymize()`
- `src/apps/settings/components/Panels/RegistrationCoreFieldsPanel.tsx:181` — **updateField(key, )} aria-pressed= title= style= `, background: field.visible ? 'rgba(48,209,88,0.1)' : 'transparent', color: field.visible ?** · onClick: `() => updateField(key, { visible: !field.visible `
- `src/apps/settings/components/Panels/RegistrationCoreFieldsPanel.tsx:251` — **addOption(key)} style= } >** · onClick: `() => addOption(key)`
- `src/apps/settings/components/Panels/RegistrationCoreFieldsPanel.tsx:348` — **removeOption(key, index)} disabled={field.options.length** · onClick: `() => removeOption(key, index)`
- `src/apps/settings/components/Panels/RegistrationCoreFieldsPanel.tsx:518` — **void save()} disabled= style= } >** · onClick: `() => void save()`
- `src/apps/settings/components/Panels/SmtpFormFields.tsx:118` — **setShowPass(!showPass)} style= } >** · onClick: `() => setShowPass(!showPass)`
- `src/apps/settings/components/Panels/SmtpFormFields.tsx:145` — **(icon-only)** · onClick: `onClearPassword`
- `src/apps/settings/components/Panels/SmtpTestActions.tsx:36` — **(icon-only)**
- `src/apps/settings/components/Panels/SmtpTestActions.tsx:70` — **(icon-only)** · onClick: `onTestEmail`
- `src/apps/settings/components/Panels/StorageSettingsPanel.tsx:40` — **(icon-only)** · onClick: `onReset`
- `src/apps/settings/components/Panels/TeamCategoriesPanel.tsx:168` — **removeCategory(index)} disabled={categories.length** · onClick: `() => removeCategory(index)`
- `src/apps/settings/components/Panels/TeamCategoriesPanel.tsx:193` — **(icon-only)** · onClick: `addCategory`
- `src/apps/settings/components/Panels/TeamCategoriesPanel.tsx:213` — **void save()} disabled= style= } >** · onClick: `() => void save()`
- `src/apps/settings/components/Panels/TwoFactorDisableForm.tsx:55` — **onShowDisable(true)} style= } >** · onClick: `() => onShowDisable(true)`
- `src/apps/settings/components/Panels/TwoFactorDisableForm.tsx:92` — **(icon-only)**
- `src/apps/settings/components/Panels/TwoFactorDisableForm.tsx:108` — **} style= } >** · onClick: `() => { onShowDisable(false); onCodeChange(''); `
- `src/apps/settings/components/Panels/TwoFactorRecoveryCodes.tsx:50` — **(icon-only)** · onClick: `onCopy`
- `src/apps/settings/components/Panels/TwoFactorRecoveryCodes.tsx:68` — **(icon-only)** · onClick: `onAcknowledge`
- `src/apps/settings/components/Panels/TwoFactorSettingsPanel.tsx:185` — **} style= } >** · onClick: `() => { setStatusUnavailable(false); setStep('loading'); void loadStatus().finally(() => setStep('idle')); `
- `src/apps/settings/components/Panels/TwoFactorSettingsPanel.tsx:208` — **(icon-only)** · onClick: `startSetup`
- `src/apps/settings/components/Panels/TwoFactorSetupForm.tsx:95` — **(icon-only)**
- `src/apps/settings/components/Panels/TwoFactorSetupForm.tsx:111` — **(icon-only)** · onClick: `onCancel`
- `src/apps/settings/components/Panels/WallpaperPanel.tsx:351` — **fileInputRef.current?.click()} disabled= style= } >** · onClick: `() => fileInputRef.current?.click()`
- `src/apps/settings/components/Panels/WallpaperPanel.tsx:483` — **(icon-only)** · onClick: `cycleWallpaper`
- `src/apps/settings/components/Panels/WallpaperPanel.tsx:524` — **setSelectedCategory(cat.id)} style= } > <span style={{ fontSize: '10px', padding: '0 4px'** · onClick: `() => setSelectedCategory(cat.id)`
- `src/apps/settings/components/Panels/WallpaperPanel.tsx:684` — **} style= } >** · onClick: `(event) => { event.stopPropagation(); void renameWallpaper(wp); `
- `src/apps/settings/components/Panels/WallpaperPanel.tsx:705` — **} style= } >** · onClick: `(event) => { event.stopPropagation(); void deleteWallpaper(wp); `
- `src/apps/settings/components/Panels/WallpaperPanel.tsx:777` — **void restoreWallpaper( wallpaper.id, t(wallpaper.titleKey || `wp_$ `, wallpaper.title), t(wallpaper.titleKey || `wp_$ `, wallpaper.title) ) ** · onClick: `() => void restoreWallpaper( wallpaper.id, t(wallpaper.titleKey || `wp_${wallpaper.id.replace(/-/g, '_')`
- `src/apps/settings/components/Roles/AuditFilterBar.tsx:108` — **(icon-only)** · onClick: `onResetFilters`
- `src/apps/settings/components/Roles/AuditHistory.tsx:74` — **onSelect(record)} >** · onClick: `() => onSelect(record)`
- `src/apps/settings/components/Roles/AuditHistory.tsx:165` — **(icon-only)** · onClick: `exportCsv`
- `src/apps/settings/components/Roles/AuditHistory.tsx:174` — **(icon-only)** · onClick: `gecmisiTemizle`
- `src/apps/settings/components/Roles/AuditHistory.tsx:219` — **setFiltre((c) => ( ))} title= >** · onClick: `() => setFiltre((c) => ({ ...c, sayfa: c.sayfa - 1 `
- `src/apps/settings/components/Roles/AuditHistory.tsx:223` — **= toplamSayfa} onClick= ))} title= >** · onClick: `() => setFiltre((c) => ({ ...c, sayfa: c.sayfa + 1 `
- `src/apps/settings/components/Roles/DeleteRoleSheet.tsx:55` — **(icon-only)** · onClick: `onClose`
- `src/apps/settings/components/Roles/DeleteRoleSheet.tsx:58` — **(icon-only)**
- `src/apps/settings/components/Roles/RoleEditor.tsx:87` — **(icon-only)** · onClick: `onClose`
- `src/apps/settings/components/Roles/RoleEditor.tsx:90` — **0}>**
- `src/apps/settings/components/Roles/RoleEditor.tsx:105` — **setRenk(c)} /> ))} setRenk(e.target.value)} aria-label= className= /> setAciklama(e.target.value)} placeholder= /> {PERMISSION_APPS.map((a) ** · onClick: `() => setRenk(c)`
- `src/apps/settings/components/Roles/RoleEditor.tsx:142` — **set(a, o)}>** · onClick: `() => set(a, o)`
- `src/apps/settings/components/Roles/RolesList.tsx:60` — **onEdit(r)} aria-label= )}>** · onClick: `() => onEdit(r)`
- `src/apps/settings/components/Roles/RolesList.tsx:64` — **onRemove(r)} aria-label= )}>** · onClick: `() => onRemove(r)`
- `src/apps/settings/components/Roles/RolesPanel.tsx:71` — **setEditing('new')}>** · onClick: `() => setEditing('new')`
- `src/apps/settings/components/SettingsMobileView.tsx:172` — **(icon-only)** · onClick: `handleBack`
- `src/apps/settings/components/SettingsMobileView.tsx:246` — **setSearchQuery('')} aria-label= >** · onClick: `() => setSearchQuery('')`
- `src/apps/settings/components/SettingsMobileView.tsx:259` — **handleOpenTab('account')} > )} $ )}` : ''}` : currentUser?.email || t('settingsProfileCardFallback')}** · onClick: `() => handleOpenTab('account')`
- `src/apps/settings/components/SettingsMobileView.tsx:310` — **handleOpenTab(sec.id)} > }** · onClick: `() => handleOpenTab(sec.id)`
- `src/apps/settings/components/SettingsMobileView.tsx:366` — **handleOpenTab(sec.id)} > }** · onClick: `() => handleOpenTab(sec.id)`
- `src/apps/settings/components/SettingsSidebar.tsx:95` — **onSelectTab(sec.id)} style= } >** · onClick: `() => onSelectTab(sec.id)`

### Form alanları / input yüzeyi (117)

- `src/apps/settings/components/Account/AccountPanel.tsx:316` — button value={user.email}
- `src/apps/settings/components/Account/AccountPanel.tsx:329` — input value={user.ogrenciNo ?? '—'}
- `src/apps/settings/components/Account/AccountPanel.tsx:333` — select value={values.bolum}
- `src/apps/settings/components/Account/AccountPanel.tsx:343` — select value={values.sinif}
- `src/apps/settings/components/Account/AccountPanel.tsx:380` — email placeholder="yeni@ornek.com" value={newEmail}
- `src/apps/settings/components/Account/AccountPanel.tsx:397` — button placeholder="123456" value={emailCode}
- `src/apps/settings/components/Account/AccountPanel.tsx:422` — textarea value={values.bio}
- `src/apps/settings/components/Account/AccountPanel.tsx:441` — textarea value={value}
- `src/apps/settings/components/Account/AccountPanel.tsx:450` — select value={value}
- `src/apps/settings/components/Account/AccountPanel.tsx:465` — input value={value}
- `src/apps/settings/components/Account/AccountPasswordForm.tsx:55` — text name=username value={userEmail}
- `src/apps/settings/components/Account/AccountPasswordForm.tsx:58` — password value={mevcut}
- `src/apps/settings/components/Account/AccountPasswordForm.tsx:63` — password value={yeni}
- `src/apps/settings/components/Account/AccountPasswordForm.tsx:67` — password value={tekrar}
- `src/apps/settings/components/Account/AccountProfileHero.tsx:100` — file
- `src/apps/settings/components/Panels/AppearancePanel.tsx:188` — range value={brightness}
- `src/apps/settings/components/Panels/AppearancePanel.tsx:207` — range value={isMuted ? 0 : volume}
- `src/apps/settings/components/Panels/CommunitySettingsPanel.tsx:318` — file
- `src/apps/settings/components/Panels/CommunitySettingsPanel.tsx:381` — text placeholder="Orbit Community" value={siteName}
- `src/apps/settings/components/Panels/CommunitySettingsPanel.tsx:395` — text placeholder="Orbit" value={shortName}
- `src/apps/settings/components/Panels/CommunitySettingsPanel.tsx:409` — textarea value={descriptionTr}
- `src/apps/settings/components/Panels/CommunitySettingsPanel.tsx:419` — textarea value={descriptionEn}
- `src/apps/settings/components/Panels/CommunitySettingsPanel.tsx:436` — text value={identity.appName}
- `src/apps/settings/components/Panels/CommunitySettingsPanel.tsx:450` — text value={identity.appName}
- `src/apps/settings/components/Panels/CommunitySettingsPanel.tsx:481` — text placeholder="orbit.local" value={domain}
- `src/apps/settings/components/Panels/CommunitySettingsPanel.tsx:522` — text value={imza1Ad}
- `src/apps/settings/components/Panels/CommunitySettingsPanel.tsx:532` — text value={imza1Unvan}
- `src/apps/settings/components/Panels/CommunitySettingsPanel.tsx:566` — text value={imza2Ad}
- `src/apps/settings/components/Panels/CommunitySettingsPanel.tsx:576` — text value={imza2Unvan}
- `src/apps/settings/components/Panels/DockSettingsPanel.tsx:38` — checkbox
- `src/apps/settings/components/Panels/DockSettingsPanel.tsx:53` — checkbox
- `src/apps/settings/components/Panels/FormDesignerPanel.tsx:393` — input value={draft.labelTr}
- `src/apps/settings/components/Panels/FormDesignerPanel.tsx:402` — input value={draft.labelEn}
- `src/apps/settings/components/Panels/FormDesignerPanel.tsx:419` — input placeholder="e.g. shirt_size" value={draft.fieldKey}
- `src/apps/settings/components/Panels/FormDesignerPanel.tsx:431` — input placeholder="custom" value={draft.section}
- `src/apps/settings/components/Panels/FormDesignerPanel.tsx:441` — select value={draft.type}
- `src/apps/settings/components/Panels/FormDesignerPanel.tsx:457` — select value={draft.collectAt}
- `src/apps/settings/components/Panels/FormDesignerPanel.tsx:478` — select value={draft.requiredAt}
- `src/apps/settings/components/Panels/FormDesignerPanel.tsx:495` — select value={draft.directoryVisibility}
- `src/apps/settings/components/Panels/FormDesignerPanel.tsx:514` — input value={draft.placeholderTr}
- `src/apps/settings/components/Panels/FormDesignerPanel.tsx:523` — checkbox value={draft.placeholderEn}
- `src/apps/settings/components/Panels/FormDesignerPanel.tsx:531` — checkbox
- `src/apps/settings/components/Panels/FormDesignerPanel.tsx:539` — checkbox
- `src/apps/settings/components/Panels/FormDesignerPanel.tsx:547` — checkbox
- `src/apps/settings/components/Panels/FormDesignerPanel.tsx:584` — input value={option.value}
- `src/apps/settings/components/Panels/FormDesignerPanel.tsx:590` — button value={option.labelTr}
- `src/apps/settings/components/Panels/FormDesignerPanel.tsx:596` — button value={option.labelEn}
- `src/apps/settings/components/Panels/FormPreview.tsx:58` — textarea value={option.value}
- `src/apps/settings/components/Panels/FormPreview.tsx:60` — select value={option.value}
- `src/apps/settings/components/Panels/FormPreview.tsx:69` — input
- `src/apps/settings/components/Panels/LegalSettingsPanel.tsx:286` — select value={draft.docType}
- `src/apps/settings/components/Panels/LegalSettingsPanel.tsx:303` — select value={draft.scope}
- `src/apps/settings/components/Panels/LegalSettingsPanel.tsx:319` — input value={draft.titleTr}
- `src/apps/settings/components/Panels/LegalSettingsPanel.tsx:328` — checkbox value={draft.titleEn}
- `src/apps/settings/components/Panels/LegalSettingsPanel.tsx:336` — checkbox
- `src/apps/settings/components/Panels/LegalSettingsPanel.tsx:344` — checkbox
- `src/apps/settings/components/Panels/LegalSettingsPanel.tsx:356` — textarea value={draft.bodyTr}
- `src/apps/settings/components/Panels/LegalSettingsPanel.tsx:364` — textarea value={draft.bodyEn}
- `src/apps/settings/components/Panels/MembershipPolicyPanel.tsx:240` — select value={policy.selfRegistration}
- `src/apps/settings/components/Panels/MembershipPolicyPanel.tsx:253` — number value={policy.maxOpenApplications}
- `src/apps/settings/components/Panels/MembershipPolicyPanel.tsx:264` — number value={policy.reapplyCooldownDays}
- `src/apps/settings/components/Panels/MembershipPolicyPanel.tsx:275` — number value={policy.inviteExpiryDays}
- `src/apps/settings/components/Panels/MembershipPolicyPanel.tsx:288` — checkbox
- `src/apps/settings/components/Panels/MembershipPolicyPanel.tsx:296` — checkbox
- `src/apps/settings/components/Panels/MembershipPolicyPanel.tsx:304` — checkbox placeholder="orbit.local, university.edu.tr" value={domains}
- `src/apps/settings/components/Panels/MembershipPolicyPanel.tsx:315` — button placeholder="orbit.local, university.edu.tr" value={domains}
- `src/apps/settings/components/Panels/MembershipPolicyPanel.tsx:362` — email value={inviteEmail}
- `src/apps/settings/components/Panels/MembershipPolicyPanel.tsx:372` — number value={inviteRoleId}
- `src/apps/settings/components/Panels/MembershipPolicyPanel.tsx:387` — number value={inviteDays}
- `src/apps/settings/components/Panels/MembershipPolicyPanel.tsx:399` — input value={inviteNote}
- `src/apps/settings/components/Panels/MembershipPolicyPanel.tsx:410` — button value={createdLink}
- `src/apps/settings/components/Panels/OAuthAppsPanel.tsx:512` — input value={formName}
- `src/apps/settings/components/Panels/OAuthAppsPanel.tsx:524` — input placeholder="https://lab.orbit.local/api/auth/c" value={formDesc}
- `src/apps/settings/components/Panels/OAuthAppsPanel.tsx:534` — textarea placeholder="https://lab.orbit.local/api/auth/callback&#10;http://localhost:4000/callback" value={formRedirects}
- `src/apps/settings/components/Panels/OAuthAppsPanel.tsx:576` — checkbox
- `src/apps/settings/components/Panels/OAuthAppsPanel.tsx:603` — checkbox
- `src/apps/settings/components/Panels/OAuthAppsPanel.tsx:663` — button value={revealedCreds.clientId}
- `src/apps/settings/components/Panels/OAuthAppsPanel.tsx:677` — button value={revealedCreds.clientSecret}
- `src/apps/settings/components/Panels/PasskeyAddForm.tsx:72` — text value={nickname}
- `src/apps/settings/components/Panels/PrivacyDataPanel.tsx:117` — select value={table}
- `src/apps/settings/components/Panels/PrivacyDataPanel.tsx:136` — select value={selected}
- `src/apps/settings/components/Panels/PrivacyDataPanel.tsx:144` — button value={confirm}
- `src/apps/settings/components/Panels/RegistrationCoreFieldsPanel.tsx:209` — input value={field.labelTr}
- `src/apps/settings/components/Panels/RegistrationCoreFieldsPanel.tsx:217` — input value={field.labelEn}
- `src/apps/settings/components/Panels/RegistrationCoreFieldsPanel.tsx:225` — input value={field.placeholderTr}
- `src/apps/settings/components/Panels/RegistrationCoreFieldsPanel.tsx:233` — input value={field.placeholderEn}
- `src/apps/settings/components/Panels/RegistrationCoreFieldsPanel.tsx:320` — input value={option.value}
- `src/apps/settings/components/Panels/RegistrationCoreFieldsPanel.tsx:330` — input value={option.labelTr}
- `src/apps/settings/components/Panels/RegistrationCoreFieldsPanel.tsx:339` — button value={option.labelEn}
- `src/apps/settings/components/Panels/RegistrationCoreFieldsPanel.tsx:443` — checkbox
- `src/apps/settings/components/Panels/RegistrationCoreFieldsPanel.tsx:461` — input value={draft.memberId.labelTr}
- `src/apps/settings/components/Panels/RegistrationCoreFieldsPanel.tsx:474` — input value={draft.memberId.labelEn}
- `src/apps/settings/components/Panels/RegistrationCoreFieldsPanel.tsx:487` — input value={draft.memberId.placeholderTr}
- `src/apps/settings/components/Panels/RegistrationCoreFieldsPanel.tsx:500` — input value={draft.memberId.placeholderEn}
- `src/apps/settings/components/Panels/SmtpFormFields.tsx:68` — text placeholder="smtp.gmail.com" value={host}
- `src/apps/settings/components/Panels/SmtpFormFields.tsx:79` — email placeholder="community@example.org" value={port}
- `src/apps/settings/components/Panels/SmtpFormFields.tsx:93` — email placeholder="community@example.org" value={user}
- `src/apps/settings/components/Panels/SmtpFormFields.tsx:106` — button value={pass}
- `src/apps/settings/components/Panels/SmtpFormFields.tsx:168` — text value={from}
- `src/apps/settings/components/Panels/SmtpFormFields.tsx:183` — textarea value={welcomeTemplate || ''}
- … 17 adet daha

## soc

- Dosya: 30
- Bulunan API çağrıları: /api/audit, /api/auth/login, /api/budget, /api/chat/rooms, /api/events, /api/inventory, /api/members, /api/news, /api/notes, /api/oauth/clients, /api/oauth/jwks, /api/projects, /api/roles, /api/soc, /api/soc/export, /api/soc/inspection, /api/soc/playbooks, /api/soc/stream, /api/soc/testbench, /api/teams, /api/uploads/..%2f..%2fconfig.ini, /api/uploads/../../../../etc/passwd

### Butonlar / aksiyonlar (150)

- `src/apps/soc/components/Inspector/SocInspector.tsx:161` — **handleCopyJson(ev.detay)} title= >** · onClick: `() => handleCopyJson(ev.detay)`
- `src/apps/soc/components/Inspector/SocInspector.tsx:180` — **void handleQuickBan(ev.ip, `Manual quarantine via SIEM event #$ `)} disabled= > )` : `IP Karantinaya Al ($ )`}** · onClick: `() => void handleQuickBan(ev.ip, `Manual quarantine via SIEM event #${ev.id`
- `src/apps/soc/components/Inspector/SocInspector.tsx:189` — **} >** · onClick: `() => { setSiemIp(ev.ip); setSiemIpOp('eq'); setActiveTab('siem'); `
- `src/apps/soc/components/Inspector/SocInspector.tsx:320` — **void handleUnban(ip)} disabled= >** · onClick: `() => void handleUnban(ip)`
- `src/apps/soc/components/Inspector/SocInspector.tsx:330` — **void handleQuickBan(ip, 'Manual quarantine via Threat Inspector')} disabled= >** · onClick: `() => void handleQuickBan(ip, 'Manual quarantine via Threat Inspector')`
- `src/apps/soc/components/Inspector/SocInspector.tsx:340` — **} >** · onClick: `() => { setSiemIp(ip); setSiemIpOp('eq'); setActiveTab('siem'); `
- `src/apps/soc/components/Inspector/SocInspector.tsx:450` — **void handleSaveNotes()} disabled= style= } >** · onClick: `() => void handleSaveNotes()`
- `src/apps/soc/components/Inspector/SocInspector.tsx:469` — **void handleExecutePlaybook('brute-force-containment', )} disabled= >** · onClick: `() => void handleExecutePlaybook('brute-force-containment', { ip: inc.sourceIp || undefined `
- `src/apps/soc/components/Inspector/SocInspector.tsx:479` — **void handleExportCaseDossier(inc.id)} disabled= >** · onClick: `() => void handleExportCaseDossier(inc.id)`
- `src/apps/soc/components/Inspector/SocInspector.tsx:564` — **void handleKillSession(sess)} disabled= >** · onClick: `() => void handleKillSession(sess)`
- `src/apps/soc/components/Inspector/SocInspector.tsx:574` — **void handleKillUserTerminals(sess.id)} disabled= >** · onClick: `() => void handleKillUserTerminals(sess.id)`
- `src/apps/soc/components/Inspector/SocInspector.tsx:584` — **openApp('members', )} >** · onClick: `() => openApp('members', { kind: 'member', itemId: sess.id `
- `src/apps/soc/components/Inspector/SocInspector.tsx:705` — **handleCopyJson(inspectorEntity.data)} title= >** · onClick: `() => handleCopyJson(inspectorEntity.data)`
- `src/apps/soc/components/Inspector/SocInspector.tsx:713` — **(icon-only)** · onClick: `closeInspector`
- `src/apps/soc/components/Sidebar/SocSidebar.tsx:80` — **setActiveTab('radar')} > ⌥1** · onClick: `() => setActiveTab('radar')`
- `src/apps/soc/components/Sidebar/SocSidebar.tsx:94` — **setActiveTab('firewall')} > )} ⌥2** · onClick: `() => setActiveTab('firewall')`
- `src/apps/soc/components/Sidebar/SocSidebar.tsx:111` — **setActiveTab('sessions')} > )} ⌥3** · onClick: `() => setActiveTab('sessions')`
- `src/apps/soc/components/Sidebar/SocSidebar.tsx:135` — **setActiveTab('siem')} > SIEM Forensics )} ⌥4** · onClick: `() => setActiveTab('siem')`
- `src/apps/soc/components/Sidebar/SocSidebar.tsx:152` — **setActiveTab('inspection')} > ⌥5** · onClick: `() => setActiveTab('inspection')`
- `src/apps/soc/components/Sidebar/SocSidebar.tsx:167` — **setActiveTab('audit')} > ⌥A** · onClick: `() => setActiveTab('audit')`
- `src/apps/soc/components/Sidebar/SocSidebar.tsx:189` — **openLabTab('fuzzer')} > ⌥6** · onClick: `() => openLabTab('fuzzer')`
- `src/apps/soc/components/Sidebar/SocSidebar.tsx:204` — **openLabTab('oauth')} > ⌥7** · onClick: `() => openLabTab('oauth')`
- `src/apps/soc/components/Sidebar/SocSidebar.tsx:219` — **openLabTab('api')} > ⌥8** · onClick: `() => openLabTab('api')`
- `src/apps/soc/components/Sidebar/SocSidebar.tsx:234` — **openLabTab('health')} > ⌥9** · onClick: `() => openLabTab('health')`
- `src/apps/soc/components/Sidebar/SocSidebar.tsx:249` — **openLabTab('session')} > ⌥9** · onClick: `() => openLabTab('session')`
- `src/apps/soc/components/Sidebar/SocSidebar.tsx:273` — **(icon-only)** · onClick: `handleResetDefcon`
- `src/apps/soc/components/Sidebar/SocSidebar.tsx:288` — **void handleToggleLockdown()} title= >** · onClick: `() => void handleToggleLockdown()`
- `src/apps/soc/components/Sidebar/SocSidebar.tsx:308` — **setShowWebhookModal(true)} title= >** · onClick: `() => setShowWebhookModal(true)`
- `src/apps/soc/components/Toolbar/SocToolbar.tsx:128` — **handleSearchChange('')} title= >** · onClick: `() => handleSearchChange('')`
- `src/apps/soc/components/Toolbar/SocToolbar.tsx:174` — **(icon-only)** · onClick: `handleResetDefcon`
- `src/apps/soc/components/Toolbar/SocToolbar.tsx:188` — **void handleToggleLockdown()} title= >** · onClick: `() => void handleToggleLockdown()`
- `src/apps/soc/components/Toolbar/SocToolbar.tsx:224` — **setLiveTail((v) => !v)} title= >** · onClick: `() => setLiveTail((v) => !v)`
- `src/apps/soc/components/Toolbar/SocToolbar.tsx:244` — **setAutoRefresh((v) => !v)} title= >** · onClick: `() => setAutoRefresh((v) => !v)`
- `src/apps/soc/components/Toolbar/SocToolbar.tsx:256` — **handleExportSiem('csv')} title= > CSV** · onClick: `() => handleExportSiem('csv')`
- `src/apps/soc/components/Toolbar/SocToolbar.tsx:269` — **void tb.runApiSuite()} disabled= title= >** · onClick: `() => void tb.runApiSuite()`
- `src/apps/soc/components/Toolbar/SocToolbar.tsx:292` — **setSelectedHourFilter(null)} title= style= } >** · onClick: `() => setSelectedHourFilter(null)`
- `src/apps/soc/components/Toolbar/SocToolbar.tsx:304` — **(icon-only)** · onClick: `handleRefresh`
- `src/apps/soc/components/Toolbar/SocToolbar.tsx:316` — **(icon-only)** · onClick: `toggleInspector`
- `src/apps/soc/components/modals/CustomDateModal.tsx:30` — **setShowCustomDateModal(false)} >** · onClick: `() => setShowCustomDateModal(false)`
- `src/apps/soc/components/modals/CustomDateModal.tsx:67` — **} >** · onClick: `() => { const now = Date.now(); const d = new Date(now - 12 * 3600 * 1000); setCustomDateStart(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString`
- `src/apps/soc/components/modals/CustomDateModal.tsx:80` — **} >** · onClick: `() => { const now = Date.now(); const d = new Date(now - 3 * 86400 * 1000); setCustomDateStart(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString`
- `src/apps/soc/components/modals/CustomDateModal.tsx:93` — **} >** · onClick: `() => { const now = Date.now(); const d = new Date(now - 30 * 86400 * 1000); setCustomDateStart(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOStrin`
- `src/apps/soc/components/modals/CustomDateModal.tsx:110` — **setShowCustomDateModal(false)} >** · onClick: `() => setShowCustomDateModal(false)`
- `src/apps/soc/components/modals/CustomDateModal.tsx:117` — **(icon-only)** · onClick: `handleApplyCustomDate`
- `src/apps/soc/components/modals/FimDiffModal.tsx:160` — **setViewMode(viewMode === 'split' ? 'unified' : 'split')} title= >** · onClick: `() => setViewMode(viewMode === 'split' ? 'unified' : 'split')`
- `src/apps/soc/components/modals/FimDiffModal.tsx:170` — **(icon-only)** · onClick: `handleCopy`
- `src/apps/soc/components/modals/FimDiffModal.tsx:181` — **(icon-only)** · onClick: `onClose`
- `src/apps/soc/components/modals/FimDiffModal.tsx:234` — **(icon-only)** · onClick: `onClose`
- `src/apps/soc/components/modals/ForensicPayloadModal.tsx:54` — **setForensicLog(null)} >** · onClick: `() => setForensicLog(null)`
- `src/apps/soc/components/modals/ForensicPayloadModal.tsx:149` — **} style= } title= >** · onClick: `() => { const ipVal = forensicLog.ip; setForensicLog(null); handlePivotFilter('ip', ipVal, 'eq'); `
- `src/apps/soc/components/modals/ForensicPayloadModal.tsx:212` — **(icon-only)** · onClick: `handleCopyForensic`
- `src/apps/soc/components/modals/ForensicPayloadModal.tsx:252` — **} style= } title= =$ ` : `Bu değere göre filtrele`} >** · onClick: `() => { setForensicLog(null); handlePivotFilter(k, valStr, 'eq'); `
- `src/apps/soc/components/modals/ForensicPayloadModal.tsx:271` — **} style= } title= =$ ` : `Bu değeri dışla`} >** · onClick: `() => { setForensicLog(null); handlePivotFilter(k, valStr, 'neq'); `
- `src/apps/soc/components/modals/ForensicPayloadModal.tsx:302` — **` : `Adli Müfettiş İncelemesi: $ ` ); }} > ` : `$ Karantinaya Al`}** · onClick: `() => { const ipToBan = forensicLog.ip; setForensicLog(null); void handleQuickBan( ipToBan, isEn ? `Forensic Inspection: ${forensicLog.mesaj.slice(0, 80)`
- `src/apps/soc/components/modals/ForensicPayloadModal.tsx:320` — **, isEn ? `$ added to whitelist.` : `$ güvenilir listeye alındı.` ); }} >** · onClick: `() => { const ipToWhitelist = forensicLog.ip; setForensicLog(null); void runSocAction( { action: 'whitelist_ip', ip: ipToWhitelist, neden: isEn ? 'Marked as tru`
- `src/apps/soc/components/modals/ForensicPayloadModal.tsx:346` — **setForensicLog(null)} >** · onClick: `() => setForensicLog(null)`
- `src/apps/soc/components/modals/LockdownModal.tsx:38` — **setShowLockdownModal(false)} >** · onClick: `() => setShowLockdownModal(false)`
- `src/apps/soc/components/modals/LockdownModal.tsx:81` — **setShowLockdownModal(false)} disabled= >** · onClick: `() => setShowLockdownModal(false)`
- `src/apps/soc/components/modals/LockdownModal.tsx:90` — **void confirmLockdownToggle()} disabled= >** · onClick: `() => void confirmLockdownToggle()`
- `src/apps/soc/components/modals/WebhookModal.tsx:64` — **setShowWebhookModal(false)} >** · onClick: `() => setShowWebhookModal(false)`
- `src/apps/soc/components/modals/WebhookModal.tsx:237` — **void handleTest()} disabled= >** · onClick: `() => void handleTest()`
- `src/apps/soc/components/modals/WebhookModal.tsx:245` — **void handleSave()} disabled= >** · onClick: `() => void handleSave()`
- `src/apps/soc/components/views/FirewallView.tsx:138` — **(icon-only)**
- `src/apps/soc/components/views/FirewallView.tsx:175` — **setFwFilter('all')} > ( )** · onClick: `() => setFwFilter('all')`
- `src/apps/soc/components/views/FirewallView.tsx:182` — **setFwFilter('ban')} > ( )** · onClick: `() => setFwFilter('ban')`
- `src/apps/soc/components/views/FirewallView.tsx:189` — **setFwFilter('whitelist')} > Whitelist ( )** · onClick: `() => setFwFilter('whitelist')`
- `src/apps/soc/components/views/FirewallView.tsx:289` — **void handleUnban(row.ip)} disabled= >** · onClick: `() => void handleUnban(row.ip)`
- `src/apps/soc/components/views/FirewallView.tsx:367` — **void handleClearRateLimit(rl.key)} disabled= style= } >** · onClick: `() => void handleClearRateLimit(rl.key)`
- `src/apps/soc/components/views/InspectionView.tsx:69` — **} > / )}** · onClick: `() => { setInspectionError(null); setInspectionSubTab('api'); `
- `src/apps/soc/components/views/InspectionView.tsx:86` — **} > )}** · onClick: `() => { setInspectionError(null); setInspectionSubTab('fim'); `
- `src/apps/soc/components/views/InspectionView.tsx:111` — **setInspectionError(null)} style= } >** · onClick: `() => setInspectionError(null)`
- `src/apps/soc/components/views/InspectionView.tsx:184` — **void handleDownloadAuditReport()} disabled= title= >** · onClick: `() => void handleDownloadAuditReport()`
- `src/apps/soc/components/views/InspectionView.tsx:202` — **void handleTriggerApiScan()} disabled= >** · onClick: `() => void handleTriggerApiScan()`
- `src/apps/soc/components/views/InspectionView.tsx:239` — **setApiFilterCategory(cat.id)} > )}** · onClick: `() => setApiFilterCategory(cat.id)`
- `src/apps/soc/components/views/InspectionView.tsx:367` — **void handleProbeSingleRoute(r.endpoint)} title= >** · onClick: `() => void handleProbeSingleRoute(r.endpoint)`
- `src/apps/soc/components/views/InspectionView.tsx:422` — **void handleTriggerFimScan()} disabled= >** · onClick: `() => void handleTriggerFimScan()`
- `src/apps/soc/components/views/InspectionView.tsx:441` — **void handleCreateBaseline()} disabled= title= >** · onClick: `() => void handleCreateBaseline()`
- `src/apps/soc/components/views/InspectionView.tsx:598` — **} >** · onClick: `(e) => { e.stopPropagation(); setDiffModalFile(an.path); `
- `src/apps/soc/components/views/RadarView.tsx:299` — **openInspector( )} >** · onClick: `() => openInspector({ type: 'incident', data: inc `
- `src/apps/soc/components/views/RadarView.tsx:377` — **void handleToggleKillSwitch('disableRegistrations', !overview?.emergencySwitches?.disableRegistrations)} disabled= >** · onClick: `() => void handleToggleKillSwitch('disableRegistrations', !overview?.emergencySwitches?.disableRegistrations)`
- `src/apps/soc/components/views/RadarView.tsx:407` — **void handleToggleKillSwitch('disableUploads', !overview?.emergencySwitches?.disableUploads)} disabled= >** · onClick: `() => void handleToggleKillSwitch('disableUploads', !overview?.emergencySwitches?.disableUploads)`
- `src/apps/soc/components/views/RadarView.tsx:437` — **void handleToggleKillSwitch('passkeyOnly', !overview?.emergencySwitches?.passkeyOnly)} disabled= >** · onClick: `() => void handleToggleKillSwitch('passkeyOnly', !overview?.emergencySwitches?.passkeyOnly)`
- `src/apps/soc/components/views/RadarView.tsx:671` — **setShowServerTelemetry((prev) => !prev)} >** · onClick: `() => setShowServerTelemetry((prev) => !prev)`
- `src/apps/soc/components/views/RadarView.tsx:864` — **void handleUnban(att.ip)} disabled= >** · onClick: `() => void handleUnban(att.ip)`
- `src/apps/soc/components/views/RadarView.tsx:873` — **void handleQuickBan( att.ip, isEn ? `Manual quarantine via SoC Radar ($ events)` : `SoC Radar üzerinden manuel karantina ($ olay)` ) } disab** · onClick: `() => void handleQuickBan( att.ip, isEn ? `Manual quarantine via SoC Radar (${att.eventCount`
- `src/apps/soc/components/views/RadarView.tsx:958` — **void handleClearRateLimit(rl.key)} disabled= style= } >** · onClick: `() => void handleClearRateLimit(rl.key)`
- `src/apps/soc/components/views/RadarView.tsx:992` — **setActiveTab('siem')} >** · onClick: `() => setActiveTab('siem')`
- `src/apps/soc/components/views/RadarView.tsx:1022` — **setSelectedHourFilter(null)} style= } >** · onClick: `() => setSelectedHourFilter(null)`
- `src/apps/soc/components/views/SessionsView.tsx:73` — **void handleRevokeAnomalousSessions()} disabled= style= } >** · onClick: `() => void handleRevokeAnomalousSessions()`
- `src/apps/soc/components/views/SessionsView.tsx:84` — **void handleKillAllOtherSessions()} disabled= style= } >** · onClick: `() => void handleKillAllOtherSessions()`
- `src/apps/soc/components/views/SessionsView.tsx:233` — **void handleKillSession(sess)} disabled= >** · onClick: `() => void handleKillSession(sess)`
- `src/apps/soc/components/views/SessionsView.tsx:244` — **void handleKillUserTerminals(sess.id)} disabled= title= >** · onClick: `() => void handleKillUserTerminals(sess.id)`
- `src/apps/soc/components/views/SessionsView.tsx:256` — **void handleSuspendUser(sess)} disabled= >** · onClick: `() => void handleSuspendUser(sess)`
- `src/apps/soc/components/views/SessionsView.tsx:269` — **void handleQuickBan( sess.sonAktifIp!, isEn ? `Suspicious session IP quarantine ($ )` : `Şüpheli oturum IP karantinası ($ )` ) } disabled= >** · onClick: `() => void handleQuickBan( sess.sonAktifIp!, isEn ? `Suspicious session IP quarantine (${sess.email`
- `src/apps/soc/components/views/SiemView.tsx:119` — **handleExportSiem('csv')} className= title= > CSV** · onClick: `() => handleExportSiem('csv')`
- `src/apps/soc/components/views/SiemView.tsx:128` — **handleExportSiem('json')} className= title= > JSON** · onClick: `() => handleExportSiem('json')`
- `src/apps/soc/components/views/SiemView.tsx:138` — **setLiveTail((v) => !v)} className= $ `} style= } title= > ) : ( )}** · onClick: `() => setLiveTail((v) => !v)`
- `src/apps/soc/components/views/SiemView.tsx:177` — **handleSelectTimeRange(preset)} >** · onClick: `() => handleSelectTimeRange(preset)`
- `src/apps/soc/components/views/SiemView.tsx:188` — **setShowCustomDateModal(true)} title= > – $ ` : isEn ? 'Custom Range...' : 'Özel Aralık...'}** · onClick: `() => setShowCustomDateModal(true)`
- `src/apps/soc/components/views/SiemView.tsx:205` — **handleSelectTimeRange('24h')} title= style= } >** · onClick: `() => handleSelectTimeRange('24h')`
- `src/apps/soc/components/views/SiemView.tsx:360` — **); }} title= >** · onClick: `() => { setSiemArama(''); void fetchSiemFiltered({ arama: '' `
- `src/apps/soc/components/views/SiemView.tsx:374` — **void fetchSiemFiltered()} disabled= >** · onClick: `() => void fetchSiemFiltered()`
- `src/apps/soc/components/views/SiemView.tsx:395` — **` : ''}$ `; setSiemArama(next); }} style= } > +** · onClick: `() => { const next = `${siemArama ? `${siemArama.trim()`
- `src/apps/soc/components/views/SiemView.tsx:441` — **); }} title= >** · onClick: `() => { const nextOp = siemServisOp === 'eq' ? 'neq' : 'eq'; setSiemServisOp(nextOp); if (siemServis !== 'all') void fetchSiemFiltered({ servisOp: nextOp `
- `src/apps/soc/components/views/SiemView.tsx:483` — **); }} >** · onClick: `() => { const nextOp = siemSeviyeOp === 'eq' ? 'neq' : 'eq'; setSiemSeviyeOp(nextOp); if (siemSeviye !== 'all') void fetchSiemFiltered({ seviyeOp: nextOp `
- `src/apps/soc/components/views/SiemView.tsx:517` — **); }} >** · onClick: `() => { const nextOp = siemIpOp === 'eq' ? 'neq' : 'eq'; setSiemIpOp(nextOp); if (siemIp.trim()) void fetchSiemFiltered({ ipOp: nextOp `
- `src/apps/soc/components/views/SiemView.tsx:539` — **); }} title= >** · onClick: `() => { setSiemIp(''); void fetchSiemFiltered({ ip: '' `
- `src/apps/soc/components/views/SiemView.tsx:556` — **); } else ); } }} title= style= } >** · onClick: `() => { if (siemIp === '127.0.0.1' && siemIpOp === 'neq') { setSiemIp(''); setSiemIpOp('eq'); void fetchSiemFiltered({ ip: '', ipOp: 'eq' `
- `src/apps/soc/components/views/SiemView.tsx:577` — **); } else ); } }} title= style= } >** · onClick: `() => { if (siemSeviye === 'INFO' && siemSeviyeOp === 'neq') { setSiemSeviye('all'); setSiemSeviyeOp('eq'); void fetchSiemFiltered({ seviye: 'all', seviyeOp: 'e`
- `src/apps/soc/components/views/SiemView.tsx:598` — **); } else ); } }} title= style= } >** · onClick: `() => { if (siemSeviye === 'CRITICAL' && siemSeviyeOp === 'eq') { setSiemSeviye('all'); void fetchSiemFiltered({ seviye: 'all' `
- `src/apps/soc/components/views/SiemView.tsx:618` — **); } else ); } }} title= style= } >** · onClick: `() => { if (siemServis === 'security' && siemServisOp === 'eq') { setSiemServis('all'); void fetchSiemFiltered({ servis: 'all' `
- `src/apps/soc/components/views/SiemView.tsx:639` — **(icon-only)** · onClick: `handleResetAllFilters`
- `src/apps/soc/components/views/SiemView.tsx:663` — **handleSelectTimeRange('24h')} title= >** · onClick: `() => handleSelectTimeRange('24h')`
- `src/apps/soc/components/views/SiemView.tsx:677` — **); }} >** · onClick: `() => { setSiemServis('all'); setSiemServisOp('eq'); void fetchSiemFiltered({ servis: 'all', servisOp: 'eq' `
- `src/apps/soc/components/views/SiemView.tsx:694` — **); }} >** · onClick: `() => { setSiemSeviye('all'); setSiemSeviyeOp('eq'); void fetchSiemFiltered({ seviye: 'all', seviyeOp: 'eq' `
- `src/apps/soc/components/views/SiemView.tsx:711` — **); }} >** · onClick: `() => { setSiemIp(''); setSiemIpOp('eq'); void fetchSiemFiltered({ ip: '', ipOp: 'eq' `
- `src/apps/soc/components/views/SiemView.tsx:732` — **); }} >** · onClick: `() => { setSiemArama(''); void fetchSiemFiltered({ arama: '' `
- `src/apps/soc/components/views/SiemView.tsx:805` — **handleQuickExcludeSeviye(log.seviye)} > ≠** · onClick: `() => handleQuickExcludeSeviye(log.seviye)`
- `src/apps/soc/components/views/SiemView.tsx:824` — **handleQuickExcludeServis(log.servis)} > ≠** · onClick: `() => handleQuickExcludeServis(log.servis)`
- `src/apps/soc/components/views/SiemView.tsx:844` — **openInspector( )} style= } title= >** · onClick: `() => openInspector({ type: 'event', data: log `
- … 30 adet daha

### Form alanları / input yüzeyi (36)

- `src/apps/soc/components/Inspector/SocInspector.tsx:392` — select value={inc.status}
- `src/apps/soc/components/Inspector/SocInspector.tsx:442` — button value={notes}
- `src/apps/soc/components/Toolbar/SocToolbar.tsx:103` — text value={currentSearchValue}
- `src/apps/soc/components/Toolbar/SocToolbar.tsx:208` — select value={siemTimeRange}
- `src/apps/soc/components/modals/CustomDateModal.tsx:48` — datetime-local value={customDateStart}
- `src/apps/soc/components/modals/CustomDateModal.tsx:58` — datetime-local value={customDateEnd}
- `src/apps/soc/components/modals/SocCommandPalette.tsx:258` — text value={query}
- `src/apps/soc/components/modals/WebhookModal.tsx:81` — checkbox
- `src/apps/soc/components/modals/WebhookModal.tsx:94` — select value={draft.provider}
- `src/apps/soc/components/modals/WebhookModal.tsx:115` — password placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz" value={draft.botToken || ''}
- `src/apps/soc/components/modals/WebhookModal.tsx:125` — text placeholder="-1001234567890" value={draft.chatId || ''}
- `src/apps/soc/components/modals/WebhookModal.tsx:140` — text placeholder="security@community.org, admin@community.org" value={draft.emailRecipients || ''}
- `src/apps/soc/components/modals/WebhookModal.tsx:152` — url value={draft.webhookUrl || ''}
- `src/apps/soc/components/modals/WebhookModal.tsx:162` — checkbox
- `src/apps/soc/components/modals/WebhookModal.tsx:170` — text value={draft.emailRecipients || ''}
- `src/apps/soc/components/modals/WebhookModal.tsx:184` — select value={draft.minSeverity}
- `src/apps/soc/components/modals/WebhookModal.tsx:201` — checkbox
- `src/apps/soc/components/modals/WebhookModal.tsx:209` — checkbox
- `src/apps/soc/components/modals/WebhookModal.tsx:217` — checkbox
- `src/apps/soc/components/modals/WebhookModal.tsx:225` — checkbox
- `src/apps/soc/components/views/FirewallView.tsx:90` — text value={fwIp}
- `src/apps/soc/components/views/FirewallView.tsx:99` — select value={fwMode}
- `src/apps/soc/components/views/FirewallView.tsx:109` — select value={fwDuration}
- `src/apps/soc/components/views/FirewallView.tsx:122` — text value={fwReason}
- `src/apps/soc/components/views/InspectionView.tsx:268` — text value={apiSearch}
- `src/apps/soc/components/views/InspectionView.tsx:403` — select value={fimTarget}
- `src/apps/soc/components/views/SiemView.tsx:307` — select value={siemAramaAlani}
- `src/apps/soc/components/views/SiemView.tsx:326` — select value={siemAramaOp}
- `src/apps/soc/components/views/SiemView.tsx:345` — text value={siemArama}
- `src/apps/soc/components/views/SiemView.tsx:457` — select value={siemServis}
- `src/apps/soc/components/views/SiemView.tsx:494` — select value={siemSeviye}
- `src/apps/soc/components/views/SiemView.tsx:528` — text value={siemIp}
- `src/apps/soc/components/views/SiemView.tsx:984` — select value={siemLimit}
- `src/apps/soc/components/views/SiemView.tsx:1057` — number value={pageJump}
- `src/apps/soc/testbench/components/OAuthSimulatorTab.tsx:89` — select value={selectedClientId}
- `src/apps/soc/testbench/components/OAuthSimulatorTab.tsx:273` — button placeholder="eyJh..." value={tokenInput}

## teams

- Dosya: 30
- Bulunan API çağrıları: /api/members, /api/team-categories, /api/teams, /api/teams/tasks/${encodeURIComponent(taskId)}

### Butonlar / aksiyonlar (75)

- `src/apps/teams/components/KanbanCard.tsx:152` — **onStep(task, -1)} >** · onClick: `() => onStep(task, -1)`
- `src/apps/teams/components/KanbanCard.tsx:163` — **onStep(task, 1)} >** · onClick: `() => onStep(task, 1)`
- `src/apps/teams/components/KanbanColumn.tsx:70` — **(icon-only)** · onClick: `onNewTask`
- `src/apps/teams/components/KanbanToolbar.tsx:69` — **setQuery('')} aria-label= >** · onClick: `() => setQuery('')`
- `src/apps/teams/components/KanbanToolbar.tsx:76` — **setAssignee(id)} >** · onClick: `() => setAssignee(id)`
- `src/apps/teams/components/KanbanToolbar.tsx:116` — **(icon-only)** · onClick: `onNewTask`
- `src/apps/teams/components/KanbanToolbar.tsx:167` — **(icon-only)** · onClick: `onClearFilters`
- `src/apps/teams/components/LabelEditor.tsx:41` — **remove(l)} aria-label= )} >** · onClick: `() => remove(l)`
- `src/apps/teams/components/LabelEditor.tsx:54` — **setAdding(true)}>** · onClick: `() => setAdding(true)`
- `src/apps/teams/components/LabelEditor.tsx:88` — **add(draft)}>** · onClick: `() => add(draft)`
- `src/apps/teams/components/LabelEditor.tsx:91` — **setAdding(false)}>** · onClick: `() => setAdding(false)`
- `src/apps/teams/components/NewTaskModal.tsx:72` — **(icon-only)** · onClick: `onClose`
- `src/apps/teams/components/NewTaskModal.tsx:75` — **(icon-only)**
- `src/apps/teams/components/NewTaskModal.tsx:156` — **setOncelik(p.id)} >** · onClick: `() => setOncelik(p.id)`
- `src/apps/teams/components/TaskChecklist.tsx:63` — **} >** · onClick: `(e) => { e.preventDefault(); onDeleteItem(m.id); `
- `src/apps/teams/components/TaskChecklist.tsx:86` — **(icon-only)**
- `src/apps/teams/components/TaskComments.tsx:60` — **onDeleteComment(y)} >** · onClick: `() => onDeleteComment(y)`
- `src/apps/teams/components/TaskComments.tsx:94` — **(icon-only)** · onClick: `onSendComment`
- `src/apps/teams/components/TaskDescription.tsx:32` — **setDescDraft(aciklama ?? '')} aria-label= title= >** · onClick: `() => setDescDraft(aciklama ?? '')`
- `src/apps/teams/components/TaskDescription.tsx:57` — **setDescDraft(null)}>** · onClick: `() => setDescDraft(null)`
- `src/apps/teams/components/TaskDescription.tsx:60` — **(icon-only)** · onClick: `onSaveDesc`
- `src/apps/teams/components/TaskDetailModal.tsx:90` — **(icon-only)** · onClick: `onClose`
- `src/apps/teams/components/TaskDetailModal.tsx:142` — **(icon-only)** · onClick: `onClose`
- `src/apps/teams/components/TaskMetaSidebar.tsx:95` — **onPatch( )}>** · onClick: `() => onPatch({ atananUyeId: currentUserId `
- `src/apps/teams/components/TaskMetaSidebar.tsx:106` — **task.oncelik !== p.id && onPatch( )} >** · onClick: `() => task.oncelik !== p.id && onPatch({ oncelik: p.id `
- `src/apps/teams/components/TaskMetaSidebar.tsx:167` — **(icon-only)** · onClick: `onDeleteTask`
- `src/apps/teams/components/TeamCard.tsx:89` — **onOpen(tm.id)}>** · onClick: `() => onOpen(tm.id)`
- `src/apps/teams/components/TeamCard.tsx:93` — **onEdit(tm)} >** · onClick: `() => onEdit(tm)`
- `src/apps/teams/components/TeamCard.tsx:105` — **onRemove(tm)} >** · onClick: `() => onRemove(tm)`
- `src/apps/teams/components/TeamDialogs.tsx:48` — **(icon-only)** · onClick: `onClose`
- `src/apps/teams/components/TeamDialogs.tsx:51` — **(icon-only)**
- `src/apps/teams/components/TeamDialogs.tsx:125` — **(icon-only)** · onClick: `onClose`
- `src/apps/teams/components/TeamDialogs.tsx:128` — **(icon-only)**
- `src/apps/teams/components/TeamDialogs.tsx:310` — **(icon-only)** · onClick: `onClose`
- `src/apps/teams/components/TeamDialogs.tsx:313` — **(icon-only)**
- `src/apps/teams/components/TeamJoinButton.tsx:32` — **onLeave(tm)}>** · onClick: `() => onLeave(tm)`
- `src/apps/teams/components/TeamJoinButton.tsx:39` — **onLeave(tm)}>** · onClick: `() => onLeave(tm)`
- `src/apps/teams/components/TeamJoinButton.tsx:48` — **onJoin(tm)} >** · onClick: `() => onJoin(tm)`
- `src/apps/teams/components/TeamMembers.tsx:78` — **post( )}>** · onClick: `() => post({ action: 'approve', userId: b.userId `
- `src/apps/teams/components/TeamMembers.tsx:81` — **), tone: 'danger' })) ); } }} >** · onClick: `async () => { if (await dialog.confirm({ message: fill(t('tmRejectConfirm'), { name: b.kullaniciAdSoyad `
- `src/apps/teams/components/TeamMembers.tsx:115` — **)) setAdding(''); }} >** · onClick: `async () => { if (await post({ action: 'addMember', userId: adding `
- `src/apps/teams/components/TeamMembers.tsx:163` — **), tone: 'danger' })) ); } }} >** · onClick: `async () => { if (await dialog.confirm({ message: fill(t('tmRemoveConfirm'), { name: u.kullaniciAdSoyad `
- `src/apps/teams/components/TeamMembers.tsx:178` — **), tone: 'warning' })) ); } }} >** · onClick: `async () => { if (await dialog.confirm({ message: fill(t('tmLeaveConfirm'), { team: team.ad `
- `src/apps/teams/components/TeamSettings.tsx:145` — **(icon-only)** · onClick: `onDelete`
- `src/apps/teams/components/TeamSettings.tsx:151` — **(icon-only)**
- `src/apps/teams/components/TeamWorkspaceHeader.tsx:32` — **(icon-only)** · onClick: `onBack`
- `src/apps/teams/components/TeamWorkspaceHeader.tsx:51` — **setActiveTab('kanban')} >** · onClick: `() => setActiveTab('kanban')`
- `src/apps/teams/components/TeamWorkspaceHeader.tsx:58` — **setActiveTab('members')} data-focus-section="members" > ( ) }** · onClick: `() => setActiveTab('members')`
- `src/apps/teams/components/TeamWorkspaceHeader.tsx:67` — **setActiveTab('chat')} data-focus-section="chat" >** · onClick: `() => setActiveTab('chat')`
- `src/apps/teams/components/TeamWorkspaceHeader.tsx:76` — **setActiveTab('kasa')} data-focus-section="kasa" >** · onClick: `() => setActiveTab('kasa')`
- `src/apps/teams/components/TeamWorkspaceHeader.tsx:86` — **setActiveTab('settings')} >** · onClick: `() => setActiveTab('settings')`
- `src/apps/teams/components/TeamsCatalog.tsx:88` — **setQuery('')} aria-label= >** · onClick: `() => setQuery('')`
- `src/apps/teams/components/TeamsCatalog.tsx:95` — **setCategory(null)} >** · onClick: `() => setCategory(null)`
- `src/apps/teams/components/TeamsCatalog.tsx:103` — **setCategory(category === c ? null : c)} >** · onClick: `() => setCategory(category === c ? null : c)`
- `src/apps/teams/components/TeamsCatalog.tsx:116` — **(icon-only)** · onClick: `onOpenCreate`
- `src/apps/teams/components/TeamsMobileView.tsx:255` — **} >** · onClick: `(e) => { e.stopPropagation(); state.showTeam(team.id); setActiveWorkspaceTab('kanban'); setActiveTab('board'); `
- `src/apps/teams/components/TeamsMobileView.tsx:303` — **state.setCreating(true)} >** · onClick: `() => state.setCreating(true)`
- `src/apps/teams/components/TeamsMobileView.tsx:329` — **state.setQuery('')} >** · onClick: `() => state.setQuery('')`
- `src/apps/teams/components/TeamsMobileView.tsx:341` — **state.setCategory(null)} >** · onClick: `() => state.setCategory(null)`
- `src/apps/teams/components/TeamsMobileView.tsx:350` — **state.setCategory(state.category === cat ? null : cat)} >** · onClick: `() => state.setCategory(state.category === cat ? null : cat)`
- `src/apps/teams/components/TeamsMobileView.tsx:387` — **state.setCreating(true)} >** · onClick: `() => state.setCreating(true)`
- `src/apps/teams/components/TeamsMobileView.tsx:413` — **state.setQuery('')} >** · onClick: `() => state.setQuery('')`
- `src/apps/teams/components/TeamsMobileView.tsx:432` — **setActiveTab('discover')} >** · onClick: `() => setActiveTab('discover')`
- `src/apps/teams/components/TeamsMobileView.tsx:461` — **setActiveTab('discover')} >** · onClick: `() => setActiveTab('discover')`
- `src/apps/teams/components/TeamsMobileView.tsx:479` — **state.showTeam(tm.id)} >** · onClick: `() => state.showTeam(tm.id)`
- `src/apps/teams/components/TeamsMobileView.tsx:505` — **state.setEditingTeam(activeBoardTeam)} >** · onClick: `() => state.setEditingTeam(activeBoardTeam)`
- `src/apps/teams/components/TeamsMobileView.tsx:522` — **setActiveWorkspaceTab('kanban')} >** · onClick: `() => setActiveWorkspaceTab('kanban')`
- `src/apps/teams/components/TeamsMobileView.tsx:532` — **setActiveWorkspaceTab('members')} > )}** · onClick: `() => setActiveWorkspaceTab('members')`
- `src/apps/teams/components/TeamsMobileView.tsx:545` — **setActiveWorkspaceTab('chat')} >** · onClick: `() => setActiveWorkspaceTab('chat')`
- `src/apps/teams/components/TeamsMobileView.tsx:556` — **setActiveWorkspaceTab('kasa')} >** · onClick: `() => setActiveWorkspaceTab('kasa')`
- `src/apps/teams/components/TeamsMobileView.tsx:594` — **setSelectedKanbanCol(col.id)} >** · onClick: `() => setSelectedKanbanCol(col.id)`
- `src/apps/teams/components/TeamsMobileView.tsx:614` — **setNewTaskCol(selectedKanbanCol)} >** · onClick: `() => setNewTaskCol(selectedKanbanCol)`
- `src/apps/teams/components/TeamsMobileView.tsx:727` — **handleStepTask(task, -1)} >** · onClick: `() => handleStepTask(task, -1)`
- `src/apps/teams/components/TeamsMobileView.tsx:737` — **handleStepTask(task, 1)} >** · onClick: `() => handleStepTask(task, 1)`
- `src/apps/teams/components/TeamsMobileView.tsx:807` — **handleTabChange(tab.id)} title= style= : undefined} > )}** · onClick: `() => handleTabChange(tab.id)`

### Form alanları / input yüzeyi (51)

- `src/apps/teams/components/KanbanToolbar.tsx:62` — button value={query}
- `src/apps/teams/components/KanbanToolbar.tsx:87` — select value={priority}
- `src/apps/teams/components/KanbanToolbar.tsx:101` — select value={label}
- `src/apps/teams/components/KanbanToolbar.tsx:110` — button value={sort}
- `src/apps/teams/components/LabelEditor.tsx:61` — text value={draft}
- `src/apps/teams/components/LabelEditor.tsx:77` — button value={l}
- `src/apps/teams/components/NewTaskModal.tsx:83` — input value={baslik}
- `src/apps/teams/components/NewTaskModal.tsx:95` — textarea value={aciklama}
- `src/apps/teams/components/NewTaskModal.tsx:112` — select value={status}
- `src/apps/teams/components/NewTaskModal.tsx:127` — select value={atanan}
- `src/apps/teams/components/NewTaskModal.tsx:144` — date value={teslim}
- `src/apps/teams/components/TaskChecklist.tsx:55` — checkbox
- `src/apps/teams/components/TaskChecklist.tsx:79` — submit value={itemDraft}
- `src/apps/teams/components/TaskComments.tsx:78` — button value={commentDraft}
- `src/apps/teams/components/TaskDescription.tsx:45` — button value={descDraft}
- `src/apps/teams/components/TaskDetailModal.tsx:129` — button value={titleDraft ?? task.baslik}
- `src/apps/teams/components/TaskMetaSidebar.tsx:55` — select value={task.status}
- `src/apps/teams/components/TaskMetaSidebar.tsx:73` — select value={task.atananUyeId ?? ''}
- `src/apps/teams/components/TaskMetaSidebar.tsx:131` — date value={toDateInput(task.teslimTarihi)}
- `src/apps/teams/components/TeamDialogs.tsx:58` — textarea value={note}
- `src/apps/teams/components/TeamDialogs.tsx:136` — input value={ad}
- `src/apps/teams/components/TeamDialogs.tsx:149` — number value={kategori}
- `src/apps/teams/components/TeamDialogs.tsx:164` — number value={kontenjan}
- `src/apps/teams/components/TeamDialogs.tsx:177` — url placeholder="https://github.c" value={liderId}
- `src/apps/teams/components/TeamDialogs.tsx:193` — url placeholder="https://github.com/tetha42/…" value={repoUrl}
- `src/apps/teams/components/TeamDialogs.tsx:203` — radio name=yeni-katilim value={aciklama}
- `src/apps/teams/components/TeamDialogs.tsx:217` — radio name=yeni-katilim
- `src/apps/teams/components/TeamDialogs.tsx:226` — radio name=yeni-katilim
- `src/apps/teams/components/TeamDialogs.tsx:321` — input value={ad}
- `src/apps/teams/components/TeamDialogs.tsx:334` — number value={kategori}
- `src/apps/teams/components/TeamDialogs.tsx:350` — number value={kontenjan}
- `src/apps/teams/components/TeamDialogs.tsx:365` — select value={status}
- `src/apps/teams/components/TeamDialogs.tsx:378` — select value={liderId}
- `src/apps/teams/components/TeamDialogs.tsx:396` — url placeholder="https://github.com/tetha42/…" value={repoUrl}
- `src/apps/teams/components/TeamDialogs.tsx:406` — radio name=duzenle-katilim value={aciklama}
- `src/apps/teams/components/TeamDialogs.tsx:420` — radio name=duzenle-katilim
- `src/apps/teams/components/TeamDialogs.tsx:429` — radio name=duzenle-katilim
- `src/apps/teams/components/TeamMembers.tsx:107` — button value={adding}
- `src/apps/teams/components/TeamMembers.tsx:144` — input value={roleDrafts[u.userId] ?? u.takimRolu}
- `src/apps/teams/components/TeamSettings.tsx:74` — input value={ad}
- `src/apps/teams/components/TeamSettings.tsx:78` — select value={kategori}
- `src/apps/teams/components/TeamSettings.tsx:89` — number value={aciklama}
- `src/apps/teams/components/TeamSettings.tsx:94` — number placeholder="https://github.com/tetha42/…" value={kontenjan}
- `src/apps/teams/components/TeamSettings.tsx:98` — url name=katilim placeholder="https://github.com/tetha42/…" value={repoUrl}
- `src/apps/teams/components/TeamSettings.tsx:105` — radio name=katilim
- `src/apps/teams/components/TeamSettings.tsx:109` — radio name=katilim value={status}
- `src/apps/teams/components/TeamSettings.tsx:118` — select value={status}
- `src/apps/teams/components/TeamSettings.tsx:126` — select value={liderId}
- `src/apps/teams/components/TeamsCatalog.tsx:81` — button value={query}
- `src/apps/teams/components/TeamsMobileView.tsx:321` — text value={state.query}
- `src/apps/teams/components/TeamsMobileView.tsx:405` — text value={state.query}

## terminal

- Dosya: 10
- Bulunan API çağrıları: /api/terminal/input, /api/terminal/resize, /api/terminal/session, /api/terminal/stream

### Butonlar / aksiyonlar (6)

- `src/apps/terminal/components/TerminalHeader.tsx:110` — **(icon-only)** · onClick: `onCopy`
- `src/apps/terminal/components/TerminalHeader.tsx:132` — **(icon-only)** · onClick: `onClear`
- `src/apps/terminal/components/TerminalHeader.tsx:154` — **(icon-only)** · onClick: `onRestart`
- `src/apps/terminal/components/TerminalTwoFactorPrompt.tsx:119` — **void onSubmit('')} style= } >** · onClick: `() => void onSubmit('')`
- `src/apps/terminal/components/TerminalTwoFactorPrompt.tsx:184` — **openApp('settings', )} style= } >** · onClick: `() => openApp('settings', { section: 'security' `
- `src/apps/terminal/components/TerminalTwoFactorPrompt.tsx:312` — **) : ( )}**

### Form alanları / input yüzeyi (1)

- `src/apps/terminal/components/TerminalTwoFactorPrompt.tsx:285` — text placeholder="••••••" value={code}

