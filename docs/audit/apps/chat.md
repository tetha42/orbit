## chat — Messages & Channels (mini-app audit)

Read-only audit of `src/apps/chat/**`, `src/app/api/chat/**`, `src/server/db/domains/chat.repo.ts` and the shared core modules they use. No source file was modified.

### 1. Purpose, manifest, authorization

Community messaging + team channels + DMs, rendered either as a desktop window (`ChatDesktopView`) or a mobile shell (`ChatMobileView`). Manifest (`src/apps/chat/manifest.ts`): window 960×600 (min 720×440) at 130/60, dock/order 12, category Community, ⌘9 and hotkey 9, menu About + “Sohbeti Yenile” (⌘R → command `chat-refresh`), permission `kullan` “Sohbet odalarını görüntüler ve mesaj yazar”, `herkeseAcik: true`, notifications `{ message: 'kullan' }`. Every chat role can use it; there is no management level used by the app itself.

Client auth is only the window-manager gate (`canOpen` in `src/core/windows/store.ts:131-135`); the views themselves only check `currentUser` (`index.tsx:83`, `ChatMobileView.tsx:316`). Server auth is `requireApp(request, 'chat', 'kullan')` on all five route files (`messages/route.ts:28,129,383,420`; `rooms/route.ts:20,54`; `poll/route.ts:12`; `stream/route.ts:90`; `upload/route.ts:23`). Room-level authorization is `canUserAccessChatRoom` (`chat.repo.ts:80-105`): `genel` = everyone, `takim` = team member or admin or explicit member, `ozel` = member only — admin never bypasses `ozel`. That check is applied on message read/send, room read/members/add_members, upload, poll create/vote and forwarding, but **not** on `ensure_team`, poll close, message edit/delete, DM/group creation (see §7).

Notification feed items are gated by the manifest kind (`src/app/api/notifications/route.ts:84-86`), while browser notifications are fired client-side (`useChat.ts:304-315`) without a second permission check.

### 2. Component map

- `index.tsx` — desktop layout, room sidebar, header actions, modal orchestration.
- `ChatMobileView.tsx` — mobile rooms/conversation screens, tabs, mobile composer, message action strip.
- `components/TeamChatEmbed.tsx` — chat embedded in the Teams workspace (`src/apps/teams/components/TeamChatRoom.tsx`).
- `components/ChatRoomList.tsx`, `ChatMessageList.tsx`, `ChatMessageInput.tsx`, `ChatAttachments.tsx` — list, rows/context menu, composer, attachment renderers.
- `components/NewChatModal`, `AddMemberModal`, `GroupInfoModal`, `ForwardMessageModal`; `components/poll/CreatePollModal`, `PollMessageCard`.
- `components/composer/ComposerActionsMenu` + `ComposerActionsRegistry` (attach, admin-only poll).
- `hooks/useChat.ts` — rooms, messages, SSE, all mutations, notification/focus-target integration; `hooks/useVoiceRecorder.ts` — MediaRecorder wrapper.
- `types.ts`, `Chat.module.css` (2255 lines), `ChatMobile.module.css` (1064 lines).

### 3. Interaction inventory (families, incl. dead/no-op)

**Desktop chrome.** “New chat” icon-only (`title=chatNewChat`, no aria-label) → opens `NewChatModal` (`index.tsx:112-129`); refresh icon → `refreshRooms()` (`131-144`) with no spinner/error; back arrow rendered only when `window.innerWidth < 768` (dead on desktop, non-reactive) → `setMobileView('rooms')`, no title/aria (`171-191`); header avatar + name → `GroupInfoModal` only for `takim` or `ozel` with >2 members (`208-234`); user-plus → `AddMemberModal` even for `genel` (`254-261`); users icon (groups only) → group info (`264-273`).

**Room rows.** Whole row is a `<button>` → `selectRoom` (`ChatRoomList.tsx:33-37`); unread badge, last-sender/message, time. No context menu, mute, leave, rename or delete.

**Message row family (repeated per message).** Right-click bubble → context menu: Copy (always; copies `icerik`, empty for attachment-only), Reply, Forward, Edit (own, non-poll), separator + Delete (own **or admin**) with `dialog.confirm` → `DELETE /api/chat/messages?id=` (`ChatMessageList.tsx:68-127`). Hover-only buttons duplicate Reply/Forward/Edit/Delete (`214-261`; CSS hides them with `opacity:0; pointer-events:none`, only `:hover` reveals — `Chat.module.css:323-335`). “Load older” button + scroll-to-top (`391-404`, `358-362`). Deleted rows have no menu/actions; admin sees them with deleted badge. Poll messages: option buttons vote/toggle, “Anketi Kapat” only for poll creator or admin (`PollMessageCard.tsx:45,221-232`), disabled when closed/expired. Attachments: image → media viewer; video/audio native controls + maximize; text/markdown preview/collapse + maximize + download fallback; PDF collapse/iframe/external/maximize (`ChatAttachments.tsx:179-370`). There is no attachment delete.

**Composer.** Plus button → actions menu (`ChatMessageInput.tsx:284-293`); menu items Attach (`fileInputRef.click()`) and Poll (admin-only filter, `ComposerActionsMenu.tsx:49-52`); hidden multi-file input, 6 files client cap, staging chips with × remove (`190-218`); text input Enter sends, Escape cancels edit (`176-186`); mic button records, recording bar × cancel / ✓ send (`272-279`); edit banner × cancel; reply banner × cancel; Send (or ✓ Save edit) submit; send disabled without text/attachments. No typing indicator, emoji picker, mention autocomplete or `/` command help.

**Modals.** NewChat: X/overlay close, “New group” toggle, back arrow, group title, search, contact row (direct → `createDm`; group → toggle), chip ×, Cancel / “Create group (n)” (`NewChatModal.tsx:104-277`). AddMember: X/overlay, 1:1 privacy banner, optional group title, search, contact toggles, chips, Cancel / submit (1:1 creates a *new* group with the counterpart, old DM stays) (`AddMemberModal.tsx:124-292`). GroupInfo: X/footer close, “Add members” hidden for `genel` (`124-136`); in TeamChatEmbed this button is a **no-op** (`TeamChatEmbed.tsx:220`). CreatePoll: X, question textarea, 2–10 option inputs, add/remove option, anonymous + multi-choice checkboxes, five duration segments, Cancel/Submit, inline error (`CreatePollModal.tsx:100-265`). Forward: X/overlay, preview, search, room checkboxes, Cancel / “Forward (n)” (`ForwardMessageModal.tsx:67-198`). Escape does not close any modal; only CreatePoll has `role="dialog" aria-modal`; no focus trap.

**Mobile.** New chat/refresh, search + clear (hardcoded aria “Temizle”, `ChatMobileView.tsx:543`), five tabs (All/Direct/Channels/Teams/New) with unread badges (`279-314`), room rows, “Start DM” empty CTA, conversation back (hardcoded aria “Sohbet listesi”, `684-691`), header who/add-member/group-info, bubble tap or right-click toggles action strip with Reply/Forward/Edit/Delete (`812-900` — no Copy), load older, composer plus/input/mic/send, chips, edit/reply banners, recording bar. Mobile lacks Copy and keyboard Escape; text Enter submits via form.

**Team embed.** On mount POST `ensure_team` (`TeamChatEmbed.tsx:35-53`, silently ignored); header Create Poll **shown to all users** though the API is admin-only (`120-128`; `poll/route.ts:21-27`), group info, refresh, “open in Chat” (`openApp('chat', …)`, `165`), full message list/composer/modals.

**Menus/shortcuts.** ⌘9/hotkey 9 opens chat; menu ⌘R sends `chat-refresh` handled at `useChat.ts:235-240`; right-click message context menu; Enter send; Escape closes composer menu/cancels edit; delete confirmation dialog. No app menu for new chat or search.

### 4. Field inventory

| Field | State/default | Validation | Payload |
|---|---|---|---|
| Composer text | `text`, `''` | trim non-empty unless attachments; no client max | `icerik`; server 4000 chars on POST only, `editChatMessage` has **no** length cap |
| File input | hidden, multiple | accept list; no client size check | multipart `odaId`,`file`; server 20 MB (`lib/media.ts:10`), byte-sniffed type |
| NewChat search / group title | `searchQuery`/`groupTitle`, `''` | client-side filter only | title → `create_group_dm`; server trims, no length cap |
| AddMember search / group title | local, `''` | client filter; 1:1 title optional | `memberIds`, `title` |
| Contact/room selections | `selectedMemberIds`, `selectedRoomIds`, `[]` | submit disabled at 0 | max selected rooms unchecked client-side; server caps 10 |
| Poll question | `soru`, `''` | client required; server trim + `.slice(0,500)` | `soru`, `odaId` |
| Poll options | `['', '']`, 2–10 client, server 2–12 | trimmed, empty dropped, dupes allowed | `secenekler[]`, each `.slice(0,200)` |
| Anonymous / multi | `true` / `false` | booleans | `anonim`, `cokluSecim`; server defaults anonymous true |
| Poll duration | `'none'` | five presets → `endsAt` ms | `endsAt`; server accepts **any** number, no past/future sanity |
| Forward search | `''` | client filter | — |
| Mobile room search | `''` | client filter | — |

Hidden/dynamic: staged attachment objects (`ad,url,boyut,tip`), reply quote snapshot (`yanitlananMesaj`) and `iletildiMi` are client-supplied and stored; `isAdmin` and `memberCount` drive conditional controls. No select, date or file-type fields beyond the presets.

### 5. Data flow

- `GET /api/chat/rooms` → `{ok,rooms}`; `?action=contacts` → every active user (name, photo, role, department); `?action=members&odaId=` → members. Reads `chat_rooms`/`chat_members`/`chat_messages` (via updatable views `sohbet_*`), `users`, `roles`, `teams`/`team_members`. Room list computes last message + unread count with four correlated subqueries per row.
- `GET /api/chat/messages?odaId&limit&before&beforeId` → `{ok,messages,hasMore}`, limit ≤100, cursor `(date,id)`, admin also sees soft-deleted; polls enriched with per-poll queries. `POST` → create (also `/clear`) or `{action:'forward',mesajId,targetOdaIds}` → `{ok,forwardedCount,messages}`; rate 40 msg/min/user. `PATCH` `{id,icerik}` → edit own; `DELETE ?id=` → soft delete.
- `POST /api/chat/rooms` actions: `read`, `ensure_team`, `create_dm`, `create_group_dm`, `add_members`. `POST /api/chat/poll` actions: `create` (admin), `vote`, `close`. `POST /api/chat/upload` writes disk + `files`; `GET /api/chat/stream` is the pg-`LISTEN`→SSE bridge.
- Writes: `chat_messages` (message + system messages), `chat_members` (read pointer / membership), `chat_rooms`, `chat_polls`/`chat_poll_options`/`chat_poll_votes`, `files`, `system_logs`. Events: `pg_notify('club_chat_events')` for chat SSE and `publishEventQuiet` on `beu_olaylar` for Notification Center/Dock badge. Audit rows exist for send (heartbeat 1/min/room), edit, delete, forward, `/clear`, poll create/close; **not** for reads, votes, room/DM/group creation, member adds or uploads.
- Cross-app: Teams embeds chat; Members “send message” opens chat with `section:'compose'`; notification clicks and `?chatRoom=` deep links target chat; search exposes Mail threads with `appId:'chat'` (`src/app/api/search/route.ts:293-301`), so such hits open Chat with a Mail thread id (verified Mail source); dock badge uses `unreadMessages`. Chat itself reads team membership and user/role data but writes no other domain table.

### 6. Loading / empty / error / permission states

`loadingRooms` is returned but never rendered (`useChat.ts:24,668`; desktop ignores it). Message loading/empty states exist; room-list empty reuses the “No messages” string (`ChatRoomList.tsx:113-117`). Nearly every fetch catch is silent (`useChat.ts:87-89,425-427`), so rooms/messages/suggestions fail to “empty”, failed delete/vote/poll-close have no feedback, and a failed send only restores text. Server errors are generic Turkish strings; 403/404 for uploads deliberately hide existence. Client-exposed errors are safe (no SQL/stack), but TeamChatEmbed’s non-admin poll gets only a generic “could not create poll”. Permission denial is the global window-store refusal plus server 403; no in-app explanation/upgrade state.

### 7. Security & privacy

Positives: room access checks on the main read/write paths, IDOR strikes (`messages/route.ts:50-65,246-262`), attachment-to-room ownership check (`269-282`), byte-sniffed uploads with random names and room-scoped read gate (`uploads/[name]/route.ts:25-27`, `kasaAccess.ts:101-111`), React-escaped text, safe Markdown links, `/clear` admin-only.

Gaps: `ensure_team` lets **any chat user** create/rename any team’s room and set its title (`rooms/route.ts:70-73`; `chat.repo.ts:766-777`). `add_members` has no manage/owner check, so any member can add arbitrary users — including converting a 1:1 `ozel` room into a group; the client tries to avoid this for 1:1 but the API does not (`rooms/route.ts:89-99`). `PATCH`/`DELETE` check only authorship/admin, not room access, and an admin can delete any message by guessed id; poll `close` likewise skips room access (`poll/route.ts:114-123`; `chat.repo.ts:1307-1331`). Reply snapshots and `iletildiMi` are mass-assigned from the request (`messages/route.ts:355-357`), allowing a forged quote attributed to another member. `contacts` exposes every active user’s role + department to every chat-enabled role, bypassing Members-app permission. No rate limits on room/DM/group creation, member adds or poll voting. Attachments are room-scoped but client `ad`/`tip` are only truncated, so labels/icons can be spoofed inside the room; no AV scan; files are written before the DB row and never cleaned. Native notifications show message bodies on the lock screen. SSE audience is cached 10 s (`chatAudience.ts:28`), and reconnect does not backfill messages missed while offline.

### 8. Tests vs untested

There are **no chat tests**: the repo’s 56 e2e files (`tests/e2e/**`) contain no chat/sohbet suite, and there are no unit tests for `chat.repo`, `useChat`, the routes or the poll logic. Untested: all authorization branches above, cursor pagination, forward attachment cloning, poll toggle/expiry, `/clear`, SSE audience filtering/reconnect, upload limits, notification fanout, and both UI shells.

### 9. Top 5 architectural/data defects

1. **`ensure_team` authorization hole** — any authenticated user with chat access can upsert a room for any `teamId` and overwrite its title (`src/app/api/chat/rooms/route.ts:70-73`, `chat.repo.ts:766-777`). Team membership is never consulted.
2. **Unrestricted `add_members`** — no manage/owner check and no member cap; a 1:1 room can be turned into a group by API call (`rooms/route.ts:89-99`, `chat.repo.ts:934-961`). This breaks the DM privacy the UI explicitly warns about.
3. **Client-trusted message metadata** — `yanitlananMesaj` (quoted author/text) and `iletildiMi` are stored verbatim; only when the snapshot is absent is it derived server-side (`messages/route.ts:211,355-357`; `chat.repo.ts:511-527`). Quotes can be spoofed.
4. **Non-transactional group creation + no room-creation limits** — room is inserted, then members one-by-one; an invalid user id returns 500 after leaving a partially-created room, and unlimited DM/group/room churn is possible (`chat.repo.ts:852-890`).
5. **Authorization enforced per route by hand, with client-only UI gates** — poll creation is admin-only server-side but the Teams embed shows the button to everyone (`TeamChatEmbed.tsx:120-128`), its Group Info “Add members” is a no-op (`:216-221`), `/clear` is undiscoverable, and edit/delete/close lack room checks. The permission model is membership-only; action roles have no shared helper.

### 10. Daha iyisi yapılabilir

Add one `requireChatRoom(user, odaId, 'read'|'write'|'manage')` helper and use it in every route (including `ensure_team`, which should verify `takim_uyeleri`), derive reply snapshots only from `yanitlananMesajId` (same room, ignored client object), and ignore `iletildiMi` outside forwarding. Wrap group/DM creation in a transaction, cap members and rate-limit room creates, member adds and poll votes. Replace `ekler TEXT` with JSONB and a safe parser (`chat.repo.ts:419-421, 156-198` currently throw on corrupt data); consolidate the `sohbet_*` view/table naming. Compute unread in one query (notifications calls `getChatRooms` twice, `notifications/route.ts:84-86`) and add an index-backed unread count. On SSE reconnect, refetch the active room or support `Last-Event-ID`. Surface errors with a toast/inline state and add room-list skeletons; mark attachment chips and uploads with real server types. Fix a11y: aria-labels on all icon-only buttons (back arrow, add member, refresh), focus-visible/always-visible row actions on touch, modal `role`/focus trap/Escape, and replace hardcoded “Sohbet listesi”/“Temizle”. Either expose `/clear` (with confirm) or remove it; give moderators a visible poll entry and remove the dead Teams-embed add-member. Finally add message search, leave/remove-member/mute, and tests for the authorization matrix above.
