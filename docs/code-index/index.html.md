# Индекс: index.html (разметка)

Один HTML-файл, ≈1370 строк. Вся динамика — в `main.js` (никаких inline-`onclick`,
`<script>`/`<style>` внутри нет). Все элементы, к которым обращается JS, имеют `id`;
JS собирает их один раз при старте в объект `dom` (main.js ≈264–540, см. `main.js.md`).
Ниже номера строк — ориентировочные; точное место: `grep -n 'id="имя"' index.html`.

## Голова (1–15)

- `<html lang="en" data-theme="dark">` — атрибут нужен только CSS (слой приоритета в
  reactivation-v30.css), JS его не меняет.
- `<title>` — U+200B (пустой заголовок окна намеренно).
- Подключения с cache-bust `?v=1.5.6.2`: Google Fonts (только IBM Plex Sans),
  `tokens.css` → `main.css` → `reactivation-v30.css`; в конце `<body>` — `main.js`.
  При релизе `?v=` меняется во всех четырёх местах.

## Скелет тела

| Строки | Блок | Корневой элемент | Кто рисует |
|---|---|---|---|
| 17–29 | Loader | `#appLoader` (`#appLoaderStatus`, `#appLoaderProgress`, `#appLoaderActions` с `#appLoaderRetry`, `#appLoaderContinue`) | `setAppLoaderState`, `hideAppLoader`, `showAppLoaderFailure` |
| 31 | Оболочка | `#app` (класс `app`, модификатор `app--reactivation-portal` ставит JS) | `syncShellState`, `enterReactivationPortal` |
| 33–46 | Кнопка «назад» портала Reactivation | внутри `#app`, до `<main>` | `leaveReactivationPortal` |
| 48–809 | Область экранов | `<main id="pageContainer">` с пятью `<section class="page" data-page-content="…">` | `openPage`, `setActivePage` |
| 811–818 | Полоса статуса выхода | `#versionNotification` (`#versionNotificationText`, `#versionNotificationClose`) — историческое имя, теперь это общий тост «Saving… / Saved / ошибка» при Save & Exit | `setExitStatus`, `hideVersionNotification` |
| 820–964 | Угловой dock | `#dockPlate` (подложка, только CSS), `<aside id="menuShell" data-open>` | `paintDockOpen`, `setDockOpen`, `applyWindowShape` |
| 966–978 | Quick Nav клиента (popover) | `#clientQuickNav` (`#clientQuickNavName`, `#clientQuickNavId`, кнопки `[data-client-quick-destination]`) | `openClientQuickNav`, `openQuickNavDestination` |
| 980–1206 | Карточка Reactivation | `#reactivationCardOverlay` → `#reactivationCardModal` | `renderReactivationCard`, `renderReactivationWorkPanel` |
| 1208–1296 | Карточка Being | `#beingCardOverlay` → `#beingCardModal` | `renderBeingCard` |
| 1298–1309 | Подтверждение завершения квеста | `#questConfirmOverlay` → `#questConfirmModal` | `openQuestCompletionConfirm` |
| 1311–1326 | История квестов | `#questHistoryOverlay` → `#questHistoryModal` | `renderQuestHistory` |
| 1328–1362 | Bonus History | `#bonusHistoryOverlay` → `#bonusHistoryModal` | `renderBonusHistory` |

Все модалки построены одинаково: overlay с `aria-hidden`, внутри `<section role="dialog">`;
открытие = класс `is-open` на overlay + `inert` на остальном (см. «Модалки» в `main.js.md`).

## Экраны (`<section class="page …" id="page-*" data-page-content="*">`)

### Yesterday (51–128) — `#page-yesterday`
KPI-панель: `#yesterdayTurnover`, `#yesterdayGgr`, `#yesterdayNgr`, `#yesterdayBonuses`,
`#yesterdayDepositAmount`/`#yesterdayDeposits`, `#yesterdayWithdrawalAmount`/`#yesterdayWithdrawals`.
Таблица игроков: обёртка `#playerTableWrapper` (только разметка), заголовки с
`[data-yesterday-sort]`, тело `#yesterdayPlayerRows` (строки строит `createYesterdayPlayerRow`).

### Dashboard (130–249) — `#page-dashboard`
Без id: восемь KPI — `article.dashboard-metric[data-dashboard-metric][data-format]`
(значение в `.dashboard-metric__value`, заполняет `renderDashboardMetrics`) и три топ-списка
`.dashboard-top-section` с контейнерами `[data-dashboard-list]` (строки — `createDashboardTopRow`).
JS собирает их через `querySelectorAll` в `dom.dashboard.metricCards/listContainers`.

### Clients (252–657) — `#page-clients`, три вложенных вида в `#clientsPanel`
- Каталог `#clientsDirectory` (256–280): поиск `#clientsSearch`, сетка `#clientsGrid`
  (карточки `.client-card[data-client-key]` строит `createClientCard`), пусто `#clientsEmpty`.
- Профиль `#clientProfileView` (282–409): `#clientProfileBack`, `#clientProfile`;
  идентичность `#profileAvatar`, `#profileClientName`, `#profileClientId`,
  `#profileReactivationBadge`, `#profileReactivationAdd`; периоды `#profilePeriodTabs`
  (`[data-profile-period]` day/30d/12m); таблица `#profilePerformanceTable`; «Where he plays»
  `#profile{Sport,Casino,LiveCasino,Slots,Instant}Activity`; квест `#profileQuestName`,
  `#profileQuestProgressFill/Value`, `#profileQuestStart/End`, `#profileQuestOpen`;
  бонусы `#profileTotalBonuses`, `#profileLastBonusDate`, `#profileLastBonusAmount`.
- Квест `#clientQuestView` (411–657): кнопки возврата `#clientQuestBack`,
  `#clientQuestBeingBack`, `#clientQuestReactivationBack` (какая видна — зависит от
  того, откуда пришли); `#clientQuestDetail` — редактор: `#questDetailNameInput`,
  `#questMechanicSelect`, `#questNameSyncButton`, `#questSectionSelect`, `#questCurrencySelect`,
  `#questGoalInput` (+ `#questGoalLabel`), `#questDetailStartInput`, `#questDetailEndInput`,
  `#questEndNoLimitToggle`, `#questConditionsInput`, `#questRewardInput`; прогресс `#questDetailProgressValue/Fill`, живой прогресс
  `#questLiveProgress` (контейнер, JS держит только его дочерние
  `#questProgressPrimaryLabel/Value`, `#questProgressSecondary/…Value`, `#questProgressStatus`),
  `#questEndNoLimitNote`, кнопки `#questCompleteButton` (`#questCompleteButtonText`),
  `#questHistoryOpen`, режим редактирования/сохранения `#questEditButton`, `#questSaveButton`.

### Reactivation (660–758) — `#page-reactivation`
Шапка: поиск `#reactivationSearch`, счётчик `#reactivationCount`. Панель стадий
(`#reactivationTotalClients`, `#reactivation{Active,CatchUp,CallTwice,PreSleep,Sleeping}Count`,
кнопки-фильтры `[data-reactivation-stage-filter]`) и панель действий
(`#reactivationTotalDeposits`, `#reactivationTotalNgr`, `#reactivationContactsTotal`,
`#reactivationCallsCount`, `#reactivationEmailsCount`). Список: `#reactivationVisibleCount`,
`#reactivationClearFilters`, заголовки колонок `[data-reactivation-sort]`, тело
`#reactivationRows` (строки `.reactivation-row[data-client-id]` строит `createReactivationRow`),
пусто `#reactivationEmpty`.

### Being (761–809) — `#page-being`
Поиск `#beingSearchShell` / `#beingSearch` / `#beingSearchToggle`, счётчик `#beingCount`,
список `#beingRows` (строки `.being-row[data-client-key]` строит `createBeingRow`),
пусто `#beingEmpty`.

## Dock (820–964) — `#menuShell`

Панель `.menu-dock__bar`: `#mainMenuReturn` (назад по лестнице), `#menuDockToggle`
(свернуть/развернуть колонку), `#menuDockCollapse`. Меню `#mainMenu`: `#mainMenuHome`,
пять `.main-menu__button[data-page]`, `#updateButton` (текст в `.update-button__text`, handle `dom.updateButtonText`),
`#themeToggle` (disabled, оставлен ради геометрии колонки), `#appExitButton` (Save & Exit).
Системная строка `#systemPanel`: `#localVersion` (JS перезаписывает `APP_VERSION`),
`#dataUpdated`.

## Карточка Reactivation (980–1206)

- Шапка: `#reactivationCardBackToBeing`, имя-кнопка `#reactivationCardName`
  (открывает Quick Nav), `#reactivationCardClientId`, `#reactivationCardStage`, `#reactivationCardClose`.
- Полоса фактов: `#reactivationCardPlaying`, `#reactivationCardStarted`,
  `#reactivationCardLastActivity`, `#reactivationCard12m{To,Ggr,Ngr,Br}`,
  `#reactivationCard{NgrTotal,DepositsTotal,ContactsTotal}`.
- 12M по продуктам: `#reactivationCard12m{Sport,Casino,Slots,Live,Instant}`.
- Статистика с переключателем периода `#reactivationStats30d` / `#reactivationStats12m`
  (JS ловит по `[data-reactivation-stats-period]`): `#reactivationStats{LastActivity,To,Ggr,Ngr,Br,SportGgr,CasinoGgr,Deposits,Withdrawals,NetLoss,SlotsTo,InstantTo,LiveTo}`.
- Оффер (только чтение): `#reactivationOfferName`, `#reactivationOfferRule`.
- Квест: `#reactivationCardQuestOpen`, `#reactivationCardQuestName/Progress/Fill`.
- Контакты: `#reactivationContactSourceState`, `#reactivationCardContactLast`,
  счётчики `#reactivationCardEmailCount/CallCount/ContactTotal`, дата/время
  `#reactivationContactDate`, `#reactivationContactTime`, кнопки `#reactivationCardEmail`,
  `#reactivationCardCall`, `#reactivationCardContactUndo`, `#reactivationBonusHistoryOpen`.
- Work Menu (правая панель): переключатели `#reactivationTool{Notes,Offer,History}`
  (`[data-reactivation-work-tool]`), панели `[data-reactivation-work-panel]`:
  `#reactivationOfferPanel` (`#reactivationOfferBd/Fb/ToDeposit/Quest`, `#reactivationOfferSave`,
  `#reactivationOfferStatus`, `#reactivationOfferCurrent`), `#reactivationNotesPanel`
  (`#reactivationNotesCount`, `#reactivationNoteDate`, `#reactivationNoteText`,
  `#reactivationNoteSave`, `#reactivationNoteStatus`, `#reactivationNoteList`),
  `#reactivationNoteHistoryPanel` (`#reactivationNoteHistoryList`).

## Карточка Being (1208–1296)

`#beingCardName`, `#beingCardClientId`, переходы `#beingCardBackToReactivation`,
`#beingCardOpenReactivation`, `#beingCardReactivation` (добавить в реактивацию),
`#beingCardPin`, `#beingCardClose`; даты `#beingCardLastContact` (+ кнопка «today»
`#beingCardLastContactToday`), `#beingCardFollowUp`; квест `#beingCardQuestOpen`,
`#beingCardQuestName`, `#beingCardQuestProgress/Fill`; заметки `#beingNoteCount`,
композер `#beingNoteDate`, `#beingNoteText`, `#beingNoteSave`, `#beingNoteCancel`,
список `#beingNoteList` (элементы `[data-being-note-edit]`, `[data-being-note-delete]`);
футер `#beingCardDone`. Строки статуса сохранения в карточке нет (убрана в 1.5.6.0);
результат записи виден только в консоли и через откат значений при ошибке.

## Малые модалки

- Quest confirm: `#questConfirmTitle`, `#questConfirmText`, `#questConfirmContinue`, `#questConfirmNo`.
- Quest history: `#questHistoryClient`, `#questHistoryClose`, `#questHistoryList`.
- Bonus history: `#bonusHistoryClient`, `#bonusHistoryClose`, `#bonusHistoryTotal`,
  `#bonusHistoryLastDate`, `#bonusHistoryLastAmount`, `#bonusHistoryList`.

## Id, которые есть в разметке, но JS/CSS не используют

`#pageContainer`, `#playerTableWrapper`, `#clientsScrollArea`, `#dockPlate`, `#systemPanel`,
`#questLiveProgress`, `#questProgressSecondaryLabel`, `#reactivationStats30d/12m`
(ловятся по data-атрибуту), `#questConfirmModal`, `#questHistoryModal`, `#bonusHistoryModal`,
`#page-yesterday/dashboard/clients/being`, а также `*Title` у модалок (только `aria-labelledby`).
Оставлены как структурные метки — удалять не обязательно.

## Data-атрибуты, которые ставит разметка (JS читает через делегирование)

`data-page` (кнопки меню), `data-page-content` (секции), `data-yesterday-sort`,
`data-reactivation-sort`, `data-reactivation-stage-filter`, `data-reactivation-stats-period`,
`data-reactivation-work-tool`/`-panel`, `data-profile-period`, `data-client-quick-destination`,
`data-open` (dock). Атрибуты, которые ставит JS на лету (`data-shell`, `data-collapsed`,
`data-stage`, `data-direction`, `data-reshaping`, `data-client-key`, `data-client-id`,
`data-reactivation-contact`, `data-being-pin` и т.д.) — см. `main.js.md`, раздел обработчиков.
