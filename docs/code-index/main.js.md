# Индекс main.js (VIP CRM, версия 1.5.6.2, после чистки 2026-09-19)

Назначение файла: единственный скрипт фронтенда. Один IIFE (`(() => { "use strict"; … })()`), без модулей и сборщика.
Экраны: Yesterday, Dashboard, Clients (директория → профиль → Current Quest), Reactivation (портал), Being (ежедневные контакты).
Данные приходят из Google Sheet через локальный мост `crm_server.ps1` (`/being-api` → Apps Script `Code.gs`), окно/док управляется через `/crm-control`.
Все номера строк ниже — состояние файла после правок (7218 строк). Искать по имени функции: `grep -n "function ИМЯ(" main.js`.

---

## 1. Структура сверху вниз (примерные диапазоны строк)

| Строки | Секция | Ключевые имена |
|---|---|---|
| 1–155 | Константы и контракты | `APP_VERSION` (4), `CRM_CONTROL_URL` (5), `BEING_GOOGLE_SHEET` (17), `BEING_SAVE_RETRY_DELAYS` (27), `PAGES`/`VALID_PAGES` (46/53), `QUEST_MECHANICS` (63), `QUEST_SECTIONS` (99), `QUEST_CURRENCIES` (135), `QUEST_OPEN_END_TEXT` (150) |
| 157–262 | Тестовые данные (placeholder-режим) и статусы | `YESTERDAY_TEST_DATA` (157), `DASHBOARD_TEST_DATA` (174), `REACTIVATION_STATUS` (220), `REACTIVATION_STATUS_LABELS` (229), `CLIENTS_TEST_DATA` (244) |
| 264–540 | `dom` — все ссылки на DOM, собираются один раз при старте | см. раздел 3 |
| 542–619 | `state` — всё изменяемое состояние | см. раздел 2 |
| 621–647 | Форматтеры и очередь записей | `formatNumber/Integer/Money/Rate`, `formatOptional*`, `normalizeNumber`, `normalizeOptionalNumber`, `clientWriteQueues` |
| 649–707 | Инфраструктура записи и мета | `queueClientWrite`, `renderDataSourceState`, `syncSystemMeta`, `trackPendingWrite` |
| 709–855 | Yesterday | `createYesterdayPlayerRow`, `compareYesterdayPlayers`, `setYesterdaySort`, `renderYesterday`, Bonus-Rate ранжирование (`getBonusRateRank`, 768) |
| 856–910 | Dashboard | `renderDashboardMetrics`, `createDashboardTopRow`, `renderDashboardLists`, `renderDashboard` |
| 912–1027 | Аналитика из листа 365 | `buildAnalyticsFrom365Clients`, `refreshAnalyticsFrom365` (Yesterday + Dashboard из `state.clients`) |
| 1029–1199 | Поиск клиента по ссылке + Quick Nav | `findUniqueClient`, `findClientByReference`, `findWorkspaceClient`, `findReactivationClientByReference`, `openClientQuickNav`, `closeClientQuickNav`, `openQuickNavDestination` |
| 1201–1276 | Clients: директория | `normalizeSearch`, `getFilteredClients`, `getReactivationMembershipSet`, `createClientCard`, `renderClients` |
| 1278–1432 | Нормализаторы | `normalizeBeingPinned`, `normalizeBeingDateValue` (любые форматы дат → ISO), `parseBeingDate`, `calculateReactivationInactiveDays`, `getReactivationStatus` (пороги стадий), `normalizeReactivationNote`, `compareReactivationNotes`, `normalizeReactivationPerformancePeriod` |
| 1434–1637 | Модель клиента Reactivation | `normalizeReactivationClient`, `setReactivationData`, `setReactivationChangeHandler`, `emitReactivationChange`, `dedupeReactivationClients`, `isClientOnReactivation`, `shouldShowReactivationMembership`, `createReactivationClientFromWorkspace`, `addWorkspaceClientToReactivation` |
| 1639–1776 | Reactivation: сортировка, фильтр, контролы | `getReactivationSortValue`, `sortReactivationClients`, `getReactivationFilteredClients`, `setReactivationStageFilter`, `clearReactivationView`, `setReactivationSort`, `renderReactivationSortControls`, `renderReactivationViewControls` |
| 1777–1912 | Reactivation: производные значения | `deriveReactivationPlaying`, `getReactivationOffer` (1806, намеренно не подключена), `getActiveReactivationContacts`, `getLastReactivationContact(ByType)`, `formatReactivationLastContact`, `formatReactivationContactStamp`, `getReactivationSummary` |
| 1914–2095 | Reactivation: список | SVG-иконки (`getReactivationMailIcon/UndoIcon/CallIcon`), `createReactivationRow`, `renderReactivation` (2066), `getReactivationClient` |
| 2097–2234 | Reactivation: контакты | `getReactivationLocalDateTime`, `createReactivationContact`, `addReactivationContact`, `undoReactivationContact` (оптимистично + откат) |
| 2236–2403 | Reactivation: карточка | `openReactivationBonusHistory`, `renderReactivationStatistics`, `renderReactivationCard` (2272), `openReactivationCard`, `closeReactivationCard` |
| 2405–2530 | Being: заметки (формат ячейки Notes) | `formatBeingDate`, `parseBeingNotes`, `serializeBeingNotes`, `beingNotesCache`/`getBeingNotes` (2484/2486), `applySevenNoteViewport` |
| 2532–2845 | Reactivation: Work Menu (Offer / Notes / History) | `parseReactivationOffer`, `serializeReactivationOffer`, `serializeReactivationCommEntries`, `getReactivationNotes`, `buildReactivationNoteList`, `renderReactivationNotes`, `renderReactivationNoteHistory`, `commitReactivationComm`, `saveReactivationNote`, `deleteReactivationNote`, `setReactivationWorkTool`, `renderReactivationWorkPanel`, `saveReactivationOffer` |
| 2847–2976 | Being: композер заметок | `resetBeingNoteComposer`, `setBeingNoteComposer`, `renderBeingNotes`, `saveBeingDatedNote`, `deleteBeingDatedNote` |
| 2978–3173 | Being: список | `ensureBeingPinRank`, `getBeingQuestRanking`, `getBeingSortedClients`, `getBeingVisibleClients`, `setBeingSearchOpen`, `createBeingPinIcon`, `createBeingRow` (3083) |
| 3175–3194 | Утилиты | `getLocalTodayIso` (локальная дата без UTC-сдвига), `getBeingCardClient`, `updateBeingCardPinButton` |
| 3196–3373 | Кросс-навигация карточек | `openBeingQuest`, `returnFromQuestToBeingCard`, `openReactivationQuest`, `returnFromQuestToReactivationCard`, `returnFromReactivationToBeing`, `openBeingFromReactivation`, `returnFromBeingToReactivation`, `openReactivationFromBeingCard` |
| 3375–3494 | Being: карточка | `renderBeingCard`, `openBeingCard`, `closeBeingCard`, `updateBeingDate` |
| 3495–3641 | Being: рендер списка и записи | `renderBeing` (3495), `emitBeingChange`, `setBeingChangeHandler`, `toggleBeingPin` (3540, прямой GET updatePinned), `updateBeingNote`, `commitBeingNote` |
| 3643–3999 | Сборка клиента из листа | `createBeingPerformanceFromProfile`, `normalizeQuestDaily`, `inferQuestMechanicFromName`, `getEffectiveQuestSection/Currency`, `convertEurToQuestCurrency`, `formatQuestMoney`, `parseQuestAmount`, `extractQuestTrackingMetadata`, `parseActiveQuestCell` (3841), `serializeActiveQuestCell` (3924), `createClientFromBeingSource` (3951) |
| 4000–4046 | `setBeingData` — единственная точка замены директории | |
| 4047–4098 | Мост: общие helpers | `isBeingGoogleSheetConfigured`, `beingApiUrl`, `fetchJson`, `apiRequest`, `apiGet`, `apiPost`, `bridgeHttpError` |
| 4099–4396 | Адаптеры Google Sheet | `fetchBeingGoogleSheetRows`, `loadBeingFromGoogleSheet`, `saveBeingPinDirect`, `saveBeingChangeToGoogleSheet` (4224, ретраи), `confirmBeingChangeLanded`, `connectBeingGoogleSheet`, `fetchReactivationGoogleSheetState`, `saveReactivationChangeToGoogleSheet`, `loadReactivationFromGoogleSheet`, `loadSheetsFromGoogle` (4378, параллельная загрузка) |
| 4398–4631 | Загрузчик и старт | `setAppLoaderState`, `hideAppLoader`, `showAppLoaderFailure`, `compareNumericVersions`, `verifyBeingAppsScriptVersion`, `runBeingAppsScriptDiagnostic`, `initializeApplication` (4524) |
| 4633–4688 | Профиль: performance | `deriveNetLoss`, `getNestedValue`, `renderPerformance`, `setProfilePeriod` |
| 4690–5273 | Редактор Current Quest | `createEmptyQuest`, `hasQuestContent`, `isQuestInactive`, `getEffectiveQuest`, `ensureClientQuestShape`, `showQuestSaveStatus`, `getQuestDraftFromInputs`, `serializeQuestDraft`, `updateQuest*Availability`, `setQuestOpenEnded`, `toggleQuestOpenEnded`, `setQuestFieldsReadOnly`, `updateQuestDirtyState` (4890), `setQuestEditMode`, `saveActiveQuestToGoogleSheet` (4946), `saveQuestEdits`, история: `readQuestHistory`, `writeQuestHistory`, `getQuestSignature`, `isCurrentQuestCompleted`, `calculateQuestCompletionDays`, `renderQuestCompletionState`, `syncQuestNameToMechanic`, `renderQuestHistory`, `openQuestHistory`, `closeQuestHistory`, `openQuestCompletionConfirm`, `closeQuestCompletionConfirm`, `completeCurrentQuest`, `requestQuestCompletion` |
| 5275–5443 | Bonus History (заглушка) | `parseManualBonusDate` (нужен квестам), `getManualBonusSummary` (5329), `createBonusHistoryRow`, `renderBonusHistory`, `openBonusHistory`, `closeBonusHistory` |
| 5445–5517 | Профиль клиента | `renderProfile` (5445), `setClientsView` |
| 5517–5731 | Прогресс квеста | `questProgressCache`, `invalidateQuestProgressCache`, `getClientQuestProgress` (кэш по `_key`), `calculateQuestProgress` (5535, обход `questDaily`), `renderQuestLiveProgress`, `renderQuestDetail` |
| 5733–5850 | Clients: навигация и загрузка списка | `openQuestDetail`, `openQuestFromProfile`, `returnToClientProfile`, `openClientProfile`, `showClientsDirectory`, `normalizeClients`, `setClients` (5829) |
| 5852–5974 | Выход и локальный контроль | `setExitStatus`, `sendCrmControl`, `initializeCrmControl` (heartbeat 3 с), `waitForPendingWrites`, `saveOpenEditorsBeforeExit`, `saveAndExitApplication` |
| 5976–6336 | Окно = док | `syncShellState`, reshape (`beginReshape`/`endReshape`), `windowFrame`, `shapeCorner`, `shapeWorkArea`, `applyWindowShape`, `setWindowCollapsed`, `setActiveButton`, `setActivePage`, `renderCurrentPage`, `enterReactivationPortal`, `leaveReactivationPortal` |
| 6338–6535 | Навигация | `openPage` (6338), `BACK_LADDER` (6401), `isBackStepAvailable`, `navigationSignature`, `goBack`, `goBackFrom`, `returnToMainMenu` |
| 6537–6581 | Update Data | `hideVersionNotification`, `updateData` |
| 6583–6654 | Меню-док | `paintDockOpen`, `setDockOpen` |
| 6656–7180 | Подписка на события (см. раздел 6) | |
| 7182–7217 | Старт | `dom.localVersion.textContent = APP_VERSION`, `connectBeingGoogleSheet()`, `initializeCrmControl()`, `initializeApplication()`, кнопки загрузчика, `preRender` только для placeholder-режима |

---

## 2. Схема `state` (строки 544–619)

Формат: поле — тип — кто пишет — кто читает.

**Общее**
- `currentPage` — `string|null` — `openPage`, `leaveReactivationPortal`, `returnToMainMenu` — `openPage`, `enterReactivationPortal`, `navigationSignature`.
- `opened` — bool (открыт ли экран, а не главное меню) — те же — `applyWindowShape`, `paintDockOpen`, `setDockOpen`, `returnToMainMenu`, `enterReactivationPortal`.
- `updating` — bool — `updateData` — `updateData`.
- `appBootFinished`, `appBootFailed` — bool — `hideAppLoader`, `showAppLoaderFailure`, `initializeApplication` — `initializeApplication` (таймер «Syncing Being archive»).

**Clients / профиль**
- `clients` — массив клиентов (форма: `createClientFromBeingSource`) — только `setClients` (+ мутации полей `being`, `quest`, `questHistory` из карточек/редактора) — все экраны.
- `clientsSource` — `"placeholder" | "being-sheet"` — `setClients` — `renderDataSourceState`, `syncSystemMeta`.
- `clientQuery`, `searchFrame` — строка поиска директории и rAF-кадр — слушатель `dom.clients.search` — `getFilteredClients`, `renderClients`.
- `selectedClient` — объект клиента или null — `openClientProfile`, `showClientsDirectory` — `renderPerformance`, редактор квеста, `openQuestDetail`, `returnFromQuestToBeingCard`.
- `profilePeriod` — `"day"|"30d"|"12m"` — `setProfilePeriod` — `renderPerformance`.
- `clientsRevision`, `clientsRenderedRevision`, `clientsRenderedQuery` — счётчик/отметка отрисованного — `setClients` (+1), `renderClients` — `renderClients` (пропуск лишнего рендера при поиске).

**Yesterday**
- `yesterdayData`, `yesterdaySortKey`, `yesterdaySortDirection` — `renderYesterday`, `setYesterdaySort` — `compareYesterdayPlayers`, `updateYesterdaySortControls`.

**Reactivation**
- `reactivationClients` — массив (форма: `normalizeReactivationClient`), уникален по ID — `setReactivationData`, `addWorkspaceClientToReactivation` (push); записи мутируют `addReactivationContact`, `undoReactivationContact`, `commitReactivationComm`, `saveReactivationOffer` — вся Reactivation, `getReactivationMembershipSet`, `isClientOnReactivation`, Quick Nav.
- `reactivationSortKey`, `reactivationSortDirection` — `setReactivationSort` — `sortReactivationClients`, `renderReactivationSortControls`.
- `reactivationQuery`, `reactivationSearchFrame`, `reactivationStageFilter` — слушатель поиска (rAF), `setReactivationStageFilter`, `clearReactivationView` — `getReactivationFilteredClients`, `renderReactivationViewControls`.
- `reactivationPortalOrigin` — `{opened, page}|null` откуда открыт портал — `openPage`, `enterReactivationPortal`, `leaveReactivationPortal`, `returnToMainMenu`, `returnFromQuestToReactivationCard`, `returnFromBeingToReactivation` — `enterReactivationPortal`, `leaveReactivationPortal`, `openReactivationQuest`, `openBeingFromReactivation`.
- `reactivationPortalReturning` — bool (идёт задержка выхода 140 мс) — `leaveReactivationPortal`, `returnToMainMenu` — `navigationSignature`.
- `reactivationSelectedId`, `reactivationCardOpen`, `reactivationCardReturnFocus`, `reactivationStatsPeriod` — `openReactivationCard`, `closeReactivationCard`, слушатель `[data-reactivation-stats-period]` — карточка, `add/undoReactivationContact`, `save*Note/Offer`, Escape, `openBonusHistory`.
- `beingReactivationOrigin` — `{clientId, clientKey}|null` (карточка Reactivation открыта из Being-карточки) — `openReactivationFromBeingCard`, `returnFromReactivationToBeing` — `renderReactivationCard` (кнопка «← Being»).
- `reactivationBeingOrigin` — `{clientId, clientKey, reactivationPortalOrigin}|null` (Being-карточка открыта из Reactivation) — `openBeingFromReactivation`, `closeBeingCard` (сброс, если не `preserveReactivationOrigin`), `returnFromBeingToReactivation`, `returnFromQuestToBeingCard` — `renderBeingCard`, `openBeingQuest`.
- `reactivationContactPending` — `Set<clientId>` — `add/undoReactivationContact` — `createReactivationRow`, `renderReactivationCard`.
- `reactivationWorkRenderedId`, `reactivationWorkTool`, `reactivationOfferDirty`, `reactivationNotePending` — `renderReactivationWorkPanel`, `setReactivationWorkTool`, слушатели полей Offer, `saveReactivationNote/Offer`, `deleteReactivationNote`, `open/closeReactivationCard` — те же, `saveOpenEditorsBeforeExit`, `beforeunload`.
- `reactivationChangeHandler` — функция или null — `setReactivationChangeHandler` (из `loadReactivationFromGoogleSheet`) — `emitReactivationChange`, тексты статуса в карточке.
- `reactivationSourceReady` — bool — `loadReactivationFromGoogleSheet` — `saveReactivationChangeToGoogleSheet`.
- `reactivationActionSequence` — счётчик id контактов — `createReactivationContact`.

**Being**
- `beingPinOrder` — `Map<_key, random>` порядок закреплённых — `ensureBeingPinRank`, `toggleBeingPin`, очистка в `setClients`/`setBeingData` — `getBeingSortedClients`.
- `beingQuestFilter` — bool — слушатель `dom.being.questFilter` — `getBeingSortedClients`, `renderBeing`.
- `beingChangeHandler` — функция или null — `setBeingChangeHandler` (из `connectBeingGoogleSheet`) — `emitBeingChange`.
- `beingCardOpen`, `beingCardClientKey`, `beingCardReturnFocus` — `openBeingCard`, `closeBeingCard` — `getBeingCardClient`, `setReactivationData`, `refreshReactivationMembershipViews`, `toggleBeingPin`, `setBeingData`, `openBonusHistory`, Escape, `beforeunload`.
- `beingNoteEditIndex` — индекс редактируемой заметки или −1 — `resetBeingNoteComposer`, `setBeingNoteComposer` — `saveBeingDatedNote`.
- `beingSearchOpen`, `beingQuery`, `beingSearchFrame` — `setBeingSearchOpen`, слушатель `dom.being.search` (rAF) — `getBeingVisibleClients`, `renderBeing`, Escape.

**Quest**
- `questSaveStatusTimer` — таймер подсказки на кнопке — `showQuestSaveStatus`.
- `questSaveInProgress` — bool — `saveQuestEdits`, `completeCurrentQuest` — те же, `requestQuestCompletion`.
- `questEditMode`, `questDraftBaseline` — `setQuestEditMode`, `renderQuestDetail`, `saveQuestEdits` — `updateQuestDirtyState`, `updateQuest*Availability`, `toggleQuestOpenEnded`, `syncQuestNameToMechanic`, `saveOpenEditorsBeforeExit`, `beforeunload`.
- `questConfirmOpen/ReturnFocus`, `questHistoryOpen/ReturnFocus` — `open/closeQuestCompletionConfirm`, `open/closeQuestHistory` — те же, `completeCurrentQuest`, `isBackStepAvailable`, Escape.
- `questNavigationOrigin` — `{type:"profile"|"being"|"reactivation", clientKey, clientId, …}|null` — `openBeingQuest`, `openReactivationQuest`, `openQuestFromProfile`, `returnFromQuestTo*`, `returnToClientProfile`, `showClientsDirectory`, `openClientProfile` — `openQuestDetail` (какая кнопка «назад» видна).

**Bonus History**
- `bonusHistoryOpen`, `bonusHistoryReturnFocus`, `bonusHistoryClientKey` — `openBonusHistory`, `closeBonusHistory` — те же, Escape, `showClientsDirectory`.

**Quick Nav**
- `quickNavOpen`, `quickNavReference` (`{clientId, name}`), `quickNavTargets` (`{workspaceClient, reactivationClient}` — разрешены при открытии), `quickNavReturnFocus` — `openClientQuickNav`, `closeClientQuickNav` — `openQuickNavDestination`, `pointerdown`, `resize`, Escape.

**Запись, окно, выход**
- `pendingWrites` — `Set<Promise>` — `trackPendingWrite` — `waitForPendingWrites`, `beforeunload`.
- `dockOpen`, `windowCollapsed`, `dockFoldedScreen` — `setDockOpen`, `setWindowCollapsed`, `openPage`, слушатель `menuDockCollapse` — `paintDockOpen`, `applyWindowShape`, `shapeCorner`, `pointerdown`, Escape.
- `exitInProgress` — bool — `saveAndExitApplication` — `beforeunload`, `pagehide`.
- `crmControlAvailable`, `crmHeartbeatTimer` — `initializeCrmControl`, `sendCrmControl`, `saveAndExitApplication` — `pagehide`.

---

## 3. Схема `dom` (строки 264–540)

Группы (все — `getElementById`/`querySelectorAll` один раз при старте, id совпадают с index.html):
- корень: `app`, `reactivationPortalBack`, `appLoader*` (loader, status, progress, actions, retry, continue), `mainMenu`, `menuButtons[]`, `mainMenuReturn`, `menuDock` (`#menuShell`), `menuDockToggle`, `menuDockCollapse`, `mainMenuHome`, `pages[]` (`[data-page-content]`), `updateButton`, `updateButtonText`, `localVersion`, `dataUpdated`, `versionNotification*` (полоса статуса выхода);
- `exit.button` (288) — `#appExitButton`;
- `quickNav` (291) — popover, name, clientId, `destinations[]`;
- `yesterday` (298) — 8 итогов, `rows` (`#yesterdayPlayerRows`), `sortButtons[]`;
- `dashboard` (311) — `metricCards[]` (`[data-dashboard-metric]`), `listContainers[]` (`[data-dashboard-list]`);
- `reactivation` (316) — счётчики шапки, `search`, `stageFilters[]`, `sortButtons[]`, `tableShell`, `rows`, `empty`, и `card` — все поля карточки (strip 12M, statistics, offer, quest, contact bar, contact inputs, work panel: toolRail/toolNotes/toolOffer/toolHistory, notesPanel/offerPanel/noteHistoryPanel, offer* инпуты, note* инпуты, `noteList`, `notesCount`);
- `being` (415) — `rows`, `empty`, `count`, `questFilter`, `searchShell/searchToggle/search`, и `card` — overlay, modal, name, clientId, backToReactivation, reactivation (+R), openReactivation, pin, close, lastContact, lastContactToday, followUp, quest*, note* (date/text/save/cancel/list/count), done. **Элемента статуса сохранения в карточке нет** (убран в 1.5.6.0; текст статуса не выводится);
- `clients` (450) — panel, directory, profileView, profile, questView, questDetail, questOpen, questBack, questBeingBack, questReactivationBack, search, grid, empty, back, periodTabs, `periodButtons[]`, `performanceCells[]` (`[data-performance]`), performanceTable, profile* (avatar, name, id, badge, reactivationAdd, *Activity), quest* (name/progress/start/end, все поля редактора, `questEndField`, кнопки edit/save/complete/history), бонусы (totalBonuses, lastBonusDate, lastBonusAmount, bonusesOpen);
- `questConfirm` (516), `questHistory` (524), `bonusHistory` (531) — overlay, close/кнопки, поля текста и списки.

---

## 4. Контракт API

Все вызовы к мосту идут через helpers 4047–4098: `beingApiUrl(action, params)` добавляет `action`, параметры и `_=Date.now()`; `apiGet`/`apiPost` → `apiRequest` → `fetchJson` (`cache: "no-store"`, `response.json().catch(() => null)`); при `!response.ok || !data.ok` бросается `Error(data.error || describeError(response))`.

### GET `/being-api?action=…`
| action | функция | шлёт | ждёт |
|---|---|---|---|
| `ping` | `verifyBeingAppsScriptVersion` (4471) → `runBeingAppsScriptDiagnostic` (неблокирующе при старте) | — | `{ok, version}`; `version` < 3.4 → warning в консоль |
| `getClients` | `fetchBeingGoogleSheetRows` (4099) | — | `{ok, clients:[{clientId, clientName, notes, activeQuest, bonusLog, pinned, followUpDate, lastContactDate, reactivationProfile:{performance:{day,7d,30d,12m}, daily:{ISO-дата:{to,ggr,casino,sport,deposits,withdrawals}}, playing}}]}` |
| `updatePinned&clientId&pinned` | `saveBeingPinDirect` (4173) из `toggleBeingPin` | clientId, `"true"/"false"` | `{ok, pinned, row, column, displayValue}`; без поля `pinned` или при несовпадении → ошибка и откат пина |
| `getClientFields&clientId` | `confirmBeingChangeLanded` (4295) | clientId | `{ok, fields:{notes, followUpDate, lastContactDate}}` — сверка после неудачных ретраев |
| `getReactivation` | `fetchReactivationGoogleSheetState` (4328) | — | `{ok, ready, rows:[…], archiveRows:[…]}`; `archiveRows` клиентом не используются; форма row — см. комментарий REACTIVATION DATA CONTRACT (~196–216) |

### POST `/being-api` (JSON body)
| body.action | функция | payload | ответ |
|---|---|---|---|
| `updateClient` | `saveBeingChangeToGoogleSheet` (4224) через `emitBeingChange` → `queueClientWrite` | `{clientId, changes:{notes?, followUpDate?, lastContactDate?}}` (абсолютные значения) | `{ok}`; при сбое — ретраи по `BEING_SAVE_RETRY_DELAYS` (800/2200/5000 мс), затем подтверждение через `getClientFields` |
| `updateActiveQuest` | `saveActiveQuestToGoogleSheet` (4946) | `{clientId, activeQuest}` — строка ячейки `serializeActiveQuestCell` | `{ok, activeQuest}` или `{ok, client:{activeQuest}}`; строка сверяется с отправленной |
| `updateReactivation` | `saveReactivationChangeToGoogleSheet` (4338) через `emitReactivationChange` | `{mutation:{action, clientId, …}}`, `action` ∈ `client:add` (`client`), `contact:add` (`type, entry, counters`), `contact:undo` (`type, entryId, counters`), `comm:update` (`value`), `plan:update` (`value`) | `{ok, counters?, value?}` |

### `/crm-control` (локальный мост, `crm_server.ps1`)
| вызов | функция | смысл |
|---|---|---|
| GET `?action=ping` | `initializeCrmControl` (5872) | есть ли контроль окна; если да — heartbeat |
| POST `{action:"heartbeat"}` | `initializeCrmControl` — `setInterval` 3000 мс, `keepalive` | сервер сбрасывает дедлайн закрытия |
| POST `{action:"shutdown"}` | `saveAndExitApplication` (5933) | остановка сервера после сохранения |
| `navigator.sendBeacon({action:"window-closing"})` | слушатель `pagehide` | окно закрыли без Save & Exit — сервер ждёт 6 с heartbeat |

---

## 5. Потоки данных

**Старт** (`initializeApplication`, 4524): `connectBeingGoogleSheet()` подключает `saveBeingChangeToGoogleSheet` как `beingChangeHandler` → `initializeCrmControl()` → loader «Starting application» → если `!isBeingGoogleSheetConfigured()` (не http/https) → ошибка «Open CRM through START_CRM.bat» → `showAppLoaderFailure` (кнопки Retry / Open CRM Anyway). Иначе `runBeingAppsScriptDiagnostic()` (ping, не блокирует) и `Promise.all([минимум 520 мс, loadSheetsFromGoogle({throwOnError:true})])`.
`loadSheetsFromGoogle` (4378): стартует **одновременно** `fetchReactivationGoogleSheetState()` и `fetchBeingGoogleSheetRows()`; применяет сначала Being (`loadBeingFromGoogleSheet` → `setBeingData`), затем Reactivation (`loadReactivationFromGoogleSheet` → `setReactivationData` + `setReactivationChangeHandler`). Ошибка Being = ошибка загрузки; ошибка Reactivation = «adapter not active» (console.info).
`setBeingData` (4000): нормализует строки → `createClientFromBeingSource` (один раз) → `setClients(..., {source:"being-sheet"})` (закрывает Being-карточку, рендерит Clients и Being) → `refreshAnalyticsFrom365()` (Yesterday + Dashboard из `performance`/`sourceLatestDate`).
`setReactivationData` (1492): `dedupeReactivationClients` → `renderReactivation`, `renderClients(true)`, `renderBeing` (бейджи «On Reactivation»), профиль/карточка, если открыты.
**Update Data** (`updateData`, 6539): скрывает полосу статуса → `loadSheetsFromGoogle` (http) или тестовые данные (placeholder) → `renderDataSourceState`.

**Сохранение Being** (даты, заметки): `updateBeingDate` / `saveBeingDatedNote` / `deleteBeingDatedNote` меняют `client.being` локально → `emitBeingChange(client, patch)` → `trackPendingWrite(queueClientWrite(_key, handler))` (записи одного клиента выполняются по очереди) → `saveBeingChangeToGoogleSheet`: POST `updateClient`, до 4 попыток, затем `confirmBeingChangeLanded`; при окончательной неудаче заметка откатывается в `saveBeingDatedNote`/`deleteBeingDatedNote` (даты не откатываются). Пин: `toggleBeingPin` → GET `updatePinned` (`saveBeingPinDirect`), откат при ошибке. Заметки в ячейке Notes хранятся построчно `YYYY-MM-DD: текст` (`serializeBeingNotes`/`parseBeingNotes`).

**Сохранение Reactivation**: `addReactivationContact`/`undoReactivationContact` — оптимистично меняют `contactLog`/счётчики, блокируют клиента в `reactivationContactPending`, шлют `contact:add`/`contact:undo`, при ошибке откатывают. `contactLog` живёт только в сессии (лист хранит счётчики). Заметки (COMM) — `commitReactivationComm` → `comm:update` со всей текущей ячейкой; Offer — `saveReactivationOffer` → `plan:update` (строка `BD: …; FB: …; TO Deposit: …; Quest: …`). `+R` → `addWorkspaceClientToReactivation` → `client:add`.

**Квест**: ячейка Active Quest (`Quest Name: …; Start Date: …; End Date: …|no limit; Quest Conditions: Tracking Mechanic: … | Tracking Section: … | Tracking Currency: … | Tracking Goal: … | …; Reward: …`) → `parseActiveQuestCell` → `client.quest`. Прогресс `calculateQuestProgress` считается по `client.questDaily` (лист 365, EUR), конвертируется в валюту квеста; кэшируется `getClientQuestProgress` до `invalidateQuestProgressCache` (setClients, сохранение квеста). Редактор: `setQuestEditMode` → `updateQuestDirtyState({progress})` (живой прогресс пересчитывается только для mechanic/section/currency/goal/dates) → `saveQuestEdits` → POST `updateActiveQuest` → сверка → `renderProfile`/`renderQuestDetail`. Завершение: `requestQuestCompletion` → (подтверждение, если < 100 %) → `completeCurrentQuest` записывает пустую ячейку и добавляет запись в `client.questHistory` (только сессия).

**Save & Exit** (`saveAndExitApplication`): `setExitStatus("Saving…")` → `saveOpenEditorsBeforeExit` (несохранённый квест = ошибка; открытая Being-заметка и грязный Offer сохраняются) → `waitForPendingWrites` (до 15 с) → POST `shutdown` → `window.close()`. Ошибка: окно возвращается на экран (`setWindowCollapsed(false)`, `shapeWorkArea`) и текст ошибки показывается в `#versionNotification`.

**Навигация / окно / док**: окно приложения само является доком (`DOCK_WINDOW` 178×100 в углу; `shapeCorner`/`shapeWorkArea` через `resizeTo/moveTo`, в обычной вкладке — no-op). `openPage(page)` (6338): портал Reactivation запоминает `reactivationPortalOrigin`; открывает экран, снимает сворачивание, `shapeWorkArea`. `setDockOpen` (6602): меню в углу растёт/убирается с шагом `DOCK_STEP`; при открытом экране экран сначала складывается (`dockFoldedScreen`). `setWindowCollapsed` — быстрое сворачивание без закрытия экрана. `syncShellState` дублирует состояние (`home|page|portal`) в `<html data-shell>`, reshape-хак (`data-reshaping`) прячет перестроение layout при изменении размера окна. Кнопка «Back» — `goBack` → `goBackFrom(0, signature)` по `BACK_LADDER` (6401): questConfirmNo → questHistoryClose → bonusHistoryClose → beingCardBackToReactivation → beingCardClose → reactivationCardBackToBeing → reactivationCardClose → clientQuestBeingBack → clientQuestReactivationBack → clientQuestBack → clientProfileBack → reactivationPortalBack → `returnToMainMenu`; если шаг не изменил `navigationSignature` за кадр, берётся следующий.
**Портал Reactivation**: `enterReactivationPortal` добавляет `app--reactivation-portal`, `leaveReactivationPortal` через 140 мс возвращает страницу-источник или главное меню.
**Кросс-переходы карточек**: Being-карточка ↔ Reactivation-карточка ↔ Current Quest хранят «откуда пришли» в `reactivationBeingOrigin` / `beingReactivationOrigin` / `questNavigationOrigin`; каждая обратная функция `returnFrom…` восстанавливает портал и открывает исходную карточку через `requestAnimationFrame`.

---

## 6. Делегированные и прочие обработчики событий (строки 6656–7180)

| Цель / селектор | Действие |
|---|---|
| `dom.menuDockToggle` click | `setDockOpen(!state.dockOpen)` |
| `dom.menuDockCollapse` click | закрыть меню, `setWindowCollapsed(!windowCollapsed)` |
| `dom.mainMenu` click → `.main-menu__button[data-page]` | `setDockOpen(false)`, `openPage(page)` |
| `dom.mainMenuHome` click | `returnToMainMenu` |
| `document` pointerdown (capture) вне `menuDock` | `setDockOpen(false)` |
| `document` pointerdown (capture) вне `#clientQuickNav` и не по `.client-quick-nav-trigger` | `closeClientQuickNav` |
| `dom.exit.button` click | `saveAndExitApplication` |
| `dom.mainMenuReturn` click | `goBack` |
| `dom.updateButton` click / `dom.versionNotificationClose` click | `updateData` / `hideVersionNotification` |
| `#yesterdayPlayerRows`, `[data-dashboard-list]` click и Enter/Space → `.client-quick-nav-trigger` | `openClientQuickNav(trigger)` |
| `#clientQuickNav` click → `[data-client-quick-destination]` | `openQuickNavDestination` |
| `window` keydown Escape (capture) | закрыть док |
| `window` beforeunload | предупреждение при `pendingWrites`, незакрытой заметке Being, грязном Offer/заметке Reactivation, несохранённом квесте |
| `window` pagehide | `sendBeacon(window-closing)` |
| `#reactivationPortalBack` click | `leaveReactivationPortal` |
| `[data-reactivation-sort]`, `[data-reactivation-stage-filter]` click | `setReactivationSort`, `setReactivationStageFilter` |
| `#reactivationSearch` input (rAF) / keydown Escape; `#reactivationClearFilters` click | `renderReactivation` / `clearReactivationView` |
| `window` resize | `positionClientQuickNav`, если popover открыт |
| `#reactivationRows` click → `[data-reactivation-undo-type]` / `[data-reactivation-contact]` / `[data-reactivation-open]` или строка | `undoReactivationContact` (последний контакт типа) / `addReactivationContact` / `openReactivationCard` |
| Карточка Reactivation: close, backToBeing, name, questOpen, bonusHistoryOpen, `[data-reactivation-stats-period]`, toolRail → `[data-reactivation-work-tool]`, поля Offer input/change (dirty), offerSave, noteSave, noteText Ctrl/Cmd+Enter, noteList → `[data-reactivation-note-delete]`, overlay-клик мимо, email, call, contactUndo | `closeReactivationCard`, `returnFromReactivationToBeing`, `openBeingFromReactivation`, `openReactivationQuest`, `openReactivationBonusHistory`, `renderReactivationStatistics`, `setReactivationWorkTool`, `saveReactivationOffer`, `saveReactivationNote`, `deleteReactivationNote`, `addReactivationContact`, `undoReactivationContact` |
| `#beingRows` click → `[data-being-pin]` / строка (не по контролу); keydown Enter/Space | `toggleBeingPin` / `openBeingCard` |
| `#beingQuestFilter`, `#beingSearchToggle`, `#beingSearch` input (rAF) | фильтр по квестам, `setBeingSearchOpen`, `renderBeing` |
| Карточка Being: questOpen, backToReactivation, openReactivation, pin, reactivation (+R), lastContact change, lastContactToday, followUp change, noteSave, noteCancel, noteText Ctrl/Cmd+Enter, noteList → `[data-being-note-edit]`/`[data-being-note-delete]`, close, done, overlay contextmenu (capture, ПКМ закрывает) | `openBeingQuest`, `returnFromBeingToReactivation`, `openReactivationFromBeingCard`, `toggleBeingPin`, `addWorkspaceClientToReactivation`, `updateBeingDate`, `saveBeingDatedNote`, `resetBeingNoteComposer`, `setBeingNoteComposer`, `deleteBeingDatedNote`, `closeBeingCard` |
| `#clientsGrid` click → `.client-card`; `#clientProfileBack`; `#profileReactivationAdd`; `#profileBonusesOpen`; bonusHistory close/overlay | `openClientProfile`, `showClientsDirectory`, `addWorkspaceClientToReactivation`, `openBonusHistory`, `closeBonusHistory` |
| `document` keydown Escape | по порядку: bonusHistory → quickNav → reactivationCard → beingCard → questConfirm → questHistory → закрыть поиск Being |
| Квест: `#profileQuestOpen`, `#clientQuestBack`, `#clientQuestBeingBack`, `#clientQuestReactivationBack`, `#questEditButton`, `#questSaveButton`, `#questNameSyncButton`, `#questCompleteButton`, `#questHistoryOpen`, questConfirm continue/no/overlay, questHistory close/overlay | соответствующие `open*/return*/save*/complete*` |
| `[data-yesterday-sort]` click | `setYesterdaySort` |
| `questEditableFields` input/change | `updateQuestDirtyState({progress: поле ∈ questProgressFields})` |
| `#questCurrencySelect` change; `#questEndNoLimitToggle` click; `#profilePeriodTabs` click → `[data-profile-period]` | `updateQuestGoalCurrencyLabel`, `toggleQuestOpenEnded`, `setProfilePeriod` |
| `#clientsSearch` input (rAF) | `renderClients(false)` |
| `#appLoaderRetry` / `#appLoaderContinue` click | `initializeApplication` / `hideAppLoader` |

---

## 7. Режимы

- **http/https через START_CRM.bat** (основной): `isBeingGoogleSheetConfigured()` истинна (протокол http(s) и `LOCAL_API_URL` = `/being-api`). Все данные — из листа; Yesterday/Dashboard строятся из `performance` клиентов (`refreshAnalyticsFrom365`); `preRender` не выполняется; при отсутствии `sourceLatestDate` в 365 экраны Yesterday/Dashboard при открытии рисуют тестовые данные (`renderCurrentPage`).
- **file:// (dev, placeholder)**: `initializeApplication` падает с «Open CRM through START_CRM.bat», кнопка **Open CRM Anyway** (`hideAppLoader`) открывает CRM на `CLIENTS_TEST_DATA` (1 клиент), `YESTERDAY_TEST_DATA` (20 строк), `DASHBOARD_TEST_DATA`; `preRender` по idle рисует эти экраны; Reactivation пуст; `clientsSource === "placeholder"` → версия в меню подсвечена, tooltip «Placeholder data». Update Data перерисовывает тестовые данные. Записи (`emitBeingChange`) идут в `saveBeingChangeToGoogleSheet`, который сразу выходит (`!isBeingGoogleSheetConfigured()`), — изменения живут в сессии.

---

## 8. Намеренные решения (не считать мёртвым кодом)

- `getReactivationOffer` (1806) — шаблон офера по BR, специально не подключён (комментарий над функцией); единственная функция без вызовов.
- `#themeToggle` в index.html — disabled-кнопка одной темы, оставлена, чтобы колонка меню не переезжала (README 1.5.6.0). JS её не трогает.
- `#versionNotification` — раньше «New Version Available», теперь полоса статуса выхода (`setExitStatus`); проверка новой версии удалена (её не существовало на сервере). `hideVersionNotification` при Update Data сохранена.
- `contactLog` у клиентов Reactivation — только сессия: лист хранит счётчики `calls/emails/contactsTotal`, после перезагрузки кнопки Undo скрыты.
- `archiveRows` из `getReactivation` игнорируются: сводка (`getReactivationSummary`) считается по текущему since-листу.
- Bonus History — заглушка: `getManualBonusSummary` отдаёт `client.bonuses` (нули для листа) и пустой список; столбец `bonusLog` приходит в `client.being.bonusLog`, но не отображается (второй источник не подключён).
- `questHistory` живёт только в сессии (сервер не хранит), `readQuestHistory`/`writeQuestHistory` — над объектом клиента.
- Тестовые данные (157–262) нужны placeholder-режиму и fallback'у Yesterday/Dashboard.
- Неиспользуемые id в index.html (`questLiveProgress`, `questProgressSecondaryLabel`, `pageContainer`, `playerTableWrapper`, `clientsScrollArea`, `systemPanel`, `dockPlate`, `reactivationStats30d/12m`) оставлены как якоря разметки.
- `QUEST_MECHANICS[*].trackingKey` — описательное поле, JS его не читает.
- В карточке Being нет строки статуса сохранения (убрана в 1.5.6.0); индикация ошибок — только `console.error` и откат.
- Порядок закреплённых клиентов в Being случайный (`Math.random` в `ensureBeingPinRank`) — так задумано.
