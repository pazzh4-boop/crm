# Индекс кода VIP CRM — с чего начать

Эта папка — карта репозитория для следующих сессий. Правило из `CLAUDE.md`: сначала
индекс, потом точечный `grep` и чтение нужного диапазона, и никогда — весь файл подряд.

## Файлы репозитория

| Файл | Строк | Роль | Индекс |
|---|---|---|---|
| `index.html` | 1370 | Вся разметка: loader, 5 экранов, dock, модалки | `index.html.md` |
| `tokens.css` | 70 | Палитра, шрифты, радиусы — единственный источник цветов | `css.md` |
| `main.css` | 8645 | Основные стили всех экранов, слои «final priority» | `css.md` |
| `reactivation-v30.css` | 4818 | Слой хотфиксов поверх main.css (не только Reactivation), почти всё под `[data-theme="dark"]` | `css.md` |
| `main.js` | 7216 | Всё поведение: данные, рендер, навигация, окно, API | `main.js.md` |
| `Code.gs` | 4053 | Apps Script API над Google Sheet | `Code.gs.md` |
| `crm_server.ps1` | ≈900 | Локальный HTTP-мост и окно браузера | `server.md` |
| `START_CRM.bat`, `START_CRM_HIDDEN.vbs`, `DIAGNOSE_CRM.bat` | — | Запуск и диагностика | `server.md` |
| `README_START_HERE.txt` | — | Журнал версий (новые сверху), намерения дизайна | — |
| `REACTIVATION_README.txt` | — | Описание since-листов реактивации | `Code.gs.md` |
| `tools/visual-check/` | — | Стенд: мок API, скриншот-дифф 16 экранов, 19 сценариев записи | `tools/visual-check/README.md` |

## Архитектура одной картинкой

```
Edge/Chrome --app окно
  index.html + css + main.js
        |  fetch /being-api?action=…   (GET)      fetch /being-api {action…} (POST)
        |  fetch /crm-control          (heartbeat, window-closing, shutdown)
        v
crm_server.ps1  (127.0.0.1:8765, однопоточный)
        |  + apiKey из being_config.json
        v
Code.gs /exec  (doGet / doPost → authorize_ → диспетчер)
        |
        v
Google Sheet: Being (клиенты, заметки, квест, pin, даты)
              365   (дневные метрики, кэш в CacheService по сигнатуре)
              since DD.MM.YYYY (реактивация: план, COMM, счётчики)
```

## Потоки данных (где искать)

| Поток | main.js | Code.gs |
|---|---|---|
| Старт: loader → `getClients` ∥ `getReactivation` → рендер всех экранов | `initializeApplication`, `loadBeingFromGoogleSheet`, `loadReactivationFromGoogleSheet`, `setBeingData`, `setReactivationData` | `getClients_`, `getReactivationFeed_` |
| Being: заметка/дата/pin из строки или карточки → оптимистичное обновление → POST `updateClient` с ретраями → при потере ответа `getClientFields` для подтверждения | `saveBeingChangeToGoogleSheet`, `confirmBeingChangeLanded`, `saveBeingPinDirect` | `updateClient_`, `verifyWrittenCells_`, `getClientFields_`, `updatePinned_` |
| Квест: редактор на профиле → POST `updateActiveQuest` (колонка D) | `saveActiveQuestToGoogleSheet`, `parseActiveQuestCell`, `serializeActiveQuestCell` | `updateActiveQuest_` |
| Reactivation: Email/Call/Undo, COMM, оффер, добавление клиента → POST `updateReactivation` с под-action | `addReactivationContact`, `undoReactivationContact`, `commitReactivationComm`, `saveReactivationOffer`, `addWorkspaceClientToReactivation` | `updateReactivation_` (client:add, contact:add, contact:undo, comm:update, plan:update) |
| Yesterday/Dashboard: считаются на клиенте из 365-профилей клиентов | `buildAnalyticsFrom365Clients`, `refreshAnalyticsFrom365` | `build365StatisticsProfiles_` |
| Окно: угловой dock ↔ полноэкранный экран, always-on-top | `applyWindowShape`, `shapeCorner`, `shapeWorkArea`, `setDockOpen`, `syncShellState` | `Update-VipCrmTopmost` (ps1) |
| Выход: Save & Exit → дождаться записей → `/crm-control shutdown` | `saveAndExitApplication`, `waitForPendingWrites` | `Handle-Client` (ps1) |

## Типовые задачи → куда смотреть

- **Колонка/поле в списке Reactivation** — `main.js.md` → `createReactivationRow`,
  `getReactivationSortValue`; `css.md` → `.reactivation-table__*`, `.reactivation-row`
  (помнить: ширины колонок задаются в обоих CSS, побеждает reactivation-v30.css).
- **Поле в Being-карточке** — `main.js.md` → `renderBeingCard`, `dom.being.card`;
  `index.html.md` → `#beingCardModal`; `css.md` → `.being-card-*`.
- **Новый action на сервере** — `Code.gs.md` → таблица action'ов; клиентская
  обёртка в `main.js.md` → раздел API; после этого обновить обе таблицы.
- **Новая колонка в листе Being** — `Code.gs.md` → `CONFIG.HEADER_ALIASES`,
  `buildHeaderMap_`, `getClients_`; на клиенте `fetchBeingGoogleSheetRows`,
  `createClientFromBeingSource`.
- **Цвет/отступ** — сначала `tokens.css`; если правится селектор, проверить в
  `css.md`, какой из файлов выигрывает для него, и править побеждающее правило.
- **Что-то не сохраняется** — `main.js.md` → раздел «Сохранение с ретраями»;
  `Code.gs.md` → «LockService / самозапись / read-back».

## Как поддерживать индексы

1. Индекс правится в том же коммите, что и код (правило в `CLAUDE.md`).
2. Имена важнее номеров строк: в таблицах функций и секций номера ориентировочные,
   проверяются grep-ом. Обновлять их, когда сдвиг больше ~50 строк.
3. Если в индексе нет того, что понадобилось найти чтением кода — добавить туда,
   чтобы в следующий раз чтения не потребовалось.
4. Проверка целостности перед коммитом индекса: каждая функция, упомянутая в
   `main.js.md`/`Code.gs.md`, существует (`grep -c "function <name>"`), каждый id из
   `index.html.md` есть в `index.html`.

## Намеренные решения (не «чинить»)

- `getReactivationOffer` в main.js не вызывается — оставлена как шаблон правил оффера.
- `#themeToggle` disabled в доке — держит место, чтобы колонка кнопок не переезжала.
- Режим `file://` («Open CRM Anyway», тестовые данные) — dev-режим без моста.
- `debugSchema`, `debug365`, `clear365Cache` в Code.gs — ручная диагностика.
- Слой `[data-theme="dark"]` в reactivation-v30.css — не тема, а способ выиграть
  специфичность у main.css; тем одна. Сплющивание — отдельная задача с визуальным риском.
