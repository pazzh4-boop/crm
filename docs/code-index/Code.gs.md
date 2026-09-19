# Code.gs — индекс (Apps Script backend VIP CRM / Being)

Файл: `/home/user/crm/Code.gs` (≈4053 строки, API version `3.4`). Один .gs-файл, деплоится как Web App (`/exec`). Номера строк — ориентировочные (после правок 2026-09-19); ищите grep-ом по идентификатору.

## Назначение
JSON-API над Google Sheet: лист `Being_Archive` (клиенты VIP, заметки, квест, pin, даты), лист `365` (ежедневные метрики за год), листы `since DD.MM.YYYY` (реактивация: попытки, план, COMM, счётчики контактов) и опциональные статистические листы. Клиент — `main.js` через локальный прокси `crm_server.ps1`.

## Структура файла сверху вниз
| Строки | Блок | Что внутри |
|---|---|---|
| 1–25 | шапка | версия `v3.4`, поддерживаемые заголовки Last Contact / Follow-up |
| 27–150 | `const CONFIG` | `SHEET_NAME`, `STATISTICS_365_SHEET_NAME`, `ACTIVE_QUEST_COLUMN` (=4, колонка D), `EMPTY_ACTIVE_QUEST`, `REACTIVATION.SHEET_PATTERN` + `REACTIVATION.HEADER_ALIASES`, `HEADER_ALIASES` (Being), `OPTIONAL_REACTIVATION_ALIASES` (30D/12M колонки в Being), `CANONICAL_HEADERS` |
| 153–252 | 1. RUN ONCE | `setupBeingApi`, `setupReactivationApi` |
| 255–325 | 2. MANUAL DEBUG | `debugBeingApi`, `debug365Statistics_`, `getBeingApiInfo` |
| 328–655 | Reactivation feed / mutations | `getReactivationFeed_`, `updateReactivation_` |
| 656–825 | Reactivation: листы и опц. статистика | `getReactivationSheets_`, `getReactivationStatisticsProfiles_`, `detectReactivationStatisticPeriod_`, `parseReactivationStatisticField_`, `mergeReactivationProfiles_` |
| 826–1185 | 365 read | `QUEST_DAILY_FIELDS` (845), `STATISTICS_365_READ` (872), `STATISTICS_365_CACHE` (879), `memoized365Profiles_/Signature_` (896), `get365StatisticsProfiles_`, `detect365Layout_`, `merge365ColumnBlocks_`, `build365StatisticsProfiles_`, `read365Number_` |
| 1186–1365 | 365 CACHE | generation, self-write marker, onChange-триггер, chunked CacheService |
| 1368–1407 | 365 metric parsing | `parse365MetricField_`, `add365MetricValue_` |
| 1409–1810 | Reactivation helpers | схема since-листа, чтение строк, сборка карточки, парсинг COMM, числа, verified-write |
| 1812–1874 | 3. WEB APP GET | `doGet` |
| 1878–1925 | 4. WEB APP POST | `doPost` |
| 1926–2083 | 5. READ ALL CLIENTS | `memoizedClients_` (1935), `invalidateClientsMemo_`, `getClients_` |
| 2084–2298 | 6. DIRECT PIN UPDATE | `updatePinned_`, `ensurePinnedColumn_` |
| 2299–2387 | 7. ACTIVE QUEST | `updateActiveQuest_` (пишет всегда в колонку D) |
| 2388–2522 | 8. UPDATE CLIENT + BEING SHEET LOOKUP CACHE | `BEING_LOOKUP_CACHE` (2407), `beingCacheKey_`, `readBeingCache_`, `writeBeingCache_`, `getBeingHeaderMap_`, `resolveClientRow_`, `verifyWrittenCells_` |
| 2523–2830 | 8. UPDATE CLIENT | `getClientFields_`, `updateClient_` |
| 2831–2868 | 9. FIND CLIENT ROW | `findClientRow_` |
| 2869–3007 | 10. WRITE HELPERS | `writeText_`, `normalizeBoolean_`, `writeBoolean_`, `writeDate_` |
| 3008–3095 | 11. HEADER SETUP | `ensureActiveQuestColumn_`, `ensureHeaders_` (только setup) |
| 3096–3311 | 12. HEADER MAP | `buildHeaderMap_`, `getActiveQuestColumnIndex_`, `findHeaderIndex_`, `findBestPopulatedHeaderIndex_`, `requireColumn_` |
| 3312–3400 | 13. READ HELPERS | `readDisplayCell_`, `readBooleanCell_`, `readDateCell_` |
| 3401–3467 | 14. SHEET FORMAT | `formatSheet_` (setup) |
| 3468–3600 | 15. SCHEMA DEBUG + timezone | `inspectSchema_`, `getSafeTimezone_`, `resolveSafeTimezone_` |
| 3601–3714 | 16. GET SHEET | memo-переменные (3610–3614), `resetSpreadsheetMemo_`, `openSpreadsheet_`, `getSpreadsheet_`, `getBeingSheet_`, `getSpreadsheetId_` |
| 3715–3746 | 17. API AUTHORIZATION | `authorize_` |
| 3747–3777 | 18. PARSE POST | `parsePostRequest_` |
| 3778–3988 | 19. DATE NORMALIZATION | `formatDateForApi_`, `normalizeDateText_`, `buildIsoDate_` |
| 3989–4027 | 20. HELPERS | `cleanString_`, `maskSecret_`, `normalizeHeader_` |
| 4028–4053 | 21. JSON | `json_`, `errorResponse_` |

## Транспорт
- Браузер (`main.js`, `BEING_GOOGLE_SHEET.LOCAL_API_URL = "/being-api"`) → `crm_server.ps1` (`Handle-Client`, путь `/being-api`) → Apps Script `/exec`.
- GET: прокси убирает входящие `_` и `apiKey`, добавляет свой `apiKey` из `being_config.json` и пробрасывает остальные query-параметры (`Invoke-GoogleGet`, ps1 ≈495–540). Без `action` прокси подставляет `getClients`.
- POST: прокси добавляет `apiKey` в JSON и шлёт `application/x-www-form-urlencoded` с полем `payload=<json>` (`Invoke-GooglePost`, ps1 ≈543–580). Поэтому в `parsePostRequest_` живая ветка — `e.parameter.payload`; ветка `e.postData.contents` (raw JSON) и `e.parameter` — запасные для прямых вызовов.
- Авторизация: `authorize_(key)` сравнивает с ScriptProperty `BEING_API_KEY`; только `action=ping` без ключа. Ошибка → `{ok:false,error:'Unauthorized.'}`.
- Все ошибки: `errorResponse_` → `{ok:false, error:<message>}` (HTTP 200, статус в теле).
- Каждый POST начинается с `markBeingSelfWrite_()` (см. кэш 365). Локальные action'ы `/crm-control` (ping, heartbeat, window-closing, shutdown) до Apps Script не доходят.

## Таблица action → функция → вход/выход
Клиент реально шлёт: GET `ping`, `getClients`, `updatePinned`, `getClientFields`, `getReactivation`; POST `updateClient`, `updateReactivation`, `updateActiveQuest`.

| Метод / action | Функция | Вход | Ответ (читает клиент) |
|---|---|---|---|
| GET `ping` | inline в `doGet` | — | `{ok:true, service:'VIP CRM Being API', version:'3.4', status:'online'}` — main.js требует `version >= 3.4` |
| GET `getClients` | `getClients_` | — | `{ok:true, clients:[Client]}`; `Client = {clientId, clientName, notes, activeQuest, bonusLog, pinned:boolean, followUpDate:'YYYY-MM-DD'|'', lastContactDate, reactivationProfile:{playing, daily:{'YYYY-MM-DD':{to,ggr,casino,sport,deposits,withdrawals}}, performance:{day,'7d','30d','12m': {to,ggr,ngr,bonusRate,sport,casino,slots,live,instant, ggrSport…ngrLive, bonus, deposits, withdrawals, depositCount, withdrawalCount, sourceLatestDate, lastActivityDate}}}}` (отсутствующие метрики не присутствуют, не 0) |
| GET `updatePinned&clientId&pinned` | `updatePinned_` | `pinned` = 'true'/'false' и т.п. (`normalizeBoolean_`) | `{ok:true, action:'updatePinned', clientId, row, column:<header>, pinned:boolean, displayValue}` — клиент требует поле `pinned` |
| GET `getClientFields&clientId` | `getClientFields_` | — | `{ok:true, clientId, row, fields:{notes, followUpDate, lastContactDate, activeQuest, bonusLog, pinned:boolean}}` (display-значения ячеек; клиент сверяет после потерянного ответа на save) |
| GET `getReactivation` | `getReactivationFeed_` | — | `{ok:true, service:'VIP CRM Reactivation Adapter', configured, ready, currentSheet, currentSheetDate, historicalSheets:[], baselineDate, rows:[R], archiveRows:[R]}`; без since-листов: `configured:false, ready:false, rows:[], archiveRows:[]`. `R = {clientId, name, reactivationStartedAt, daysInReactivation, lastActivityDate, lastContactDate, daysInactive, reactivationNgr, depositAmount, previousWeekLog:[{date,sheetName,text}], currentCommText, reactivationNotes:[{date,text,sheetName,isCurrent,order}], offerText, emails, calls, contactsTotal, currentSheetName, currentSheetDate, playing, performance:{day,'7d','30d','12m'}, quest:{name}, reactivationTotals:{deposits, ngr}}` |
| GET `debugSchema` | `inspectSchema_(getBeingSheet_())` | ручная диагностика | `{ok:true, schema:{headers:[], mapping:{clientId,clientName,notes,activeQuest,bonusLog,pinned,followUpDate,lastContact}}}` |
| GET `debug365` | `debug365Statistics_` | ручная диагностика (README) | `{ok, sheetName, lastRow, lastColumn, clientCount, coverage:{field:count}, sample:{clientId, performance}}` или `{ok:false,error}` |
| GET `clear365Cache` | `resetBeing365Cache` | ручная | `{ok:true, generation:'<n>'}` |
| POST `updateClient` | `updateClient_(clientId, changes)` | `changes` ⊆ `{notes, pinned, followUpDate, lastContactDate, clientName, activeQuest, bonusLog}` (абсолютные значения; даты `YYYY-MM-DD` или пусто = очистить) | `{ok:true, clientId, row, verified:[поля-тексты], confirmedChanges:{pinned:boolean|undefined}}` |
| POST `updateActiveQuest` | `updateActiveQuest_(clientId, activeQuest)` | строка `Quest Name: …; Start Date: …; End Date: …; Quest Conditions: …; Reward: …` (пусто → `CONFIG.EMPTY_ACTIVE_QUEST`) | `{ok:true, action:'updateActiveQuest', clientId, row, column:'D', activeQuest:<saved>}` |
| POST `updateReactivation` | `updateReactivation_(mutation)` | `mutation.action` ∈ `client:add`, `plan:update`, `comm:update`, `contact:add`, `contact:undo`; `clientId`; `value` (текст) или `type`/`entry.type` ('call' иначе email) | `client:add` → `{ok, action, clientId, sheetName, row, duplicate}`; `plan:update`/`comm:update` → `{ok, action, clientId, sheetName, row, value}`; `contact:*` → `{ok, action, clientId, sheetName, row, type, counters:{emails, calls, total}}` |
| иное | — | — | `{ok:false, error:'Unknown GET action: …'}` / `'Unknown POST action: …'` / `'Unknown Reactivation mutation: …'` |

## Схема листов Google Sheet
### Being (`Being_Archive`, имя из ScriptProperty `BEING_SHEET_NAME`)
- Строка 1 — заголовки. Поиск по алиасам `CONFIG.HEADER_ALIASES` через `normalizeHeader_` (lower, `_`/`-` → пробел, схлопывание пробелов). Обязательна только `Client ID`.
- `Active Quest` — всегда колонка D (`CONFIG.ACTIVE_QUEST_COLUMN=4`); `getActiveQuestColumnIndex_` берёт D если заголовок совпадает, иначе ищет по алиасам; `ensureActiveQuestColumn_` создаёт заголовок D1 (setup и `updateActiveQuest_`).
- Даты (`Follow Up Date`, `Last Contact Date`/`Data`/`Date`): `findBestPopulatedHeaderIndex_` предпочитает первый алиас с данными. Читаются `readDateCell_` → `formatDateForApi_` (display-текст → raw-текст → Date через `Utilities.formatDate`), выход всегда `YYYY-MM-DD`. Пишутся `writeDate_` (Date в полдень, формат `dd.MM.yyyy`).
- `Pinned`: boolean или текст (`normalizeBoolean_`: true/1/yes/y/on/pinned/tak). Отсутствующую колонку создаёт `ensurePinnedColumn_`.
- Опциональные колонки статистики (`CONFIG.OPTIONAL_REACTIVATION_ALIASES`: `Playing`, `TO 30D`, `GGR 12M` …) попадают в `reactivationProfile` как fallback; поверх них мержится 365 (`mergeReactivationProfiles_(being, profiles365)`).
- Кэш (CacheService, TTL 21600): ключ `vipcrmBeingLookup` + base64(MD5(`vipcrmBeingLookup|headers|<строка 1 через \u0001>`)) → карта колонок (`getBeingHeaderMap_`); ключ `…|row|<sheetId>|<colClientId>|<id>` → номер строки, перед использованием подтверждается чтением ячейки ID (`resolveClientRow_`). Промах → `findClientRow_` (скан колонки ID).

### 365 (`CONFIG.STATISTICS_365_SHEET_NAME='365'`, имя сравнивается через `normalizeHeader_`)
- Раскладка (`detect365Layout_`, сканирует первые `STATISTICS_365_READ.HEADER_SCAN_ROWS=6` строк): строка заголовков — та, где есть `Player Id`/`Client ID`/`ID` и рядом `Level 1`/`Last Activity Date`; строкой выше (до 3 строк) — названия метрических секций (`GGR`, `NGR`, `Turnover`, `Bonus Rate`, `Clear Bonus`, `Casino TO`, `Sport TO`, `Deposits`…), распознаваемые `parse365MetricField_`; под каждой секцией — даты по дням. `Bonus Rate` не читается (считается как `bonus/ggr*100`), колонки без даты (`Total`, `sort by`) пропускаются.
- Чтение (`build365StatisticsProfiles_`): только нужные колонки, слитые в блоки с зазором ≤ `MAX_COLUMN_GAP=8`; пара `Player Id`/`Level 1` читается display-значениями; строки `Player Id`/`Total`/`Grand Total` пропускаются. Периоды: `day` (последняя дата), `7d`, `30d`, `12m` (окна от последней даты); `daily` — по датам для полей `QUEST_DAILY_FIELDS` (to, ggr, casino, sport, deposits, withdrawals). `Level 1` → `lastActivityDate`.
- Кэш: память (`memoized365Profiles_` по сигнатуре) + CacheService чанками (`STATISTICS_365_CACHE`: префикс `vipcrm365`, TTL 21600, чанк 90000, ≤40 чанков; head-ключ = сигнатура, значение = число чанков; чанки `sig:i`). Сигнатура: `vipcrm365|<generation>|<lastRow>|<lastColumn>|<latestIsoDate>|<descriptors.length>`. `generation` = ScriptProperty `VIPCRM_365_CACHE_GENERATION` (`get365CacheGeneration_`, по умолчанию '1').

### since-листы (реактивация)
- Имя `since DD.MM.YYYY` (`CONFIG.REACTIVATION.SHEET_PATTERN`), сортировка по дате, последний — текущий (`getReactivationSheets_`). Заголовки по `CONFIG.REACTIVATION.HEADER_ALIASES`: `ID`, `Last Activity Date`/`Last Dep`/…, `Days no dep`, `NGR`, `Dep`, `PREV ATTEMPTS`, `PLAN`, `COMM`, `Mail counter`, `Phone counter`, `Contact total` (`inspectReactivationSheetSchema_`; обязательные для мутаций — `requireReactivationColumn_`).
- Feed: история по всем листам (первое появление → `reactivationStartedAt`; `PREV ATTEMPTS` → `previousWeekLog` и заметки), текущий лист → `rows`, все когда-либо встреченные ID → `archiveRows`. COMM/PREV парсится `parseReactivationCommEntries_` (строки `[YYYY-MM-DD]: …`, `DD.MM.YYYY: …`, продолжения с отступом), сортировка `compareReactivationNotesNewestFirst_`; offer = `PLAN`, иначе последняя заметка `BD:`/`FB:`/`TO Deposit:`/`Quest:` (`findLatestReactivationOffer_`).
- Мутации пишут в текущий лист, каждая — `setValue` + `SpreadsheetApp.flush()` + `invalidateClientsMemo_()` + чтение обратно (`writeVerifiedReactivationText_`, счётчики — одним чтением строки). `client:add` требует наличие ID в Being (скан одной колонки).

### Опциональные статистические листы (`getReactivationStatisticsProfiles_`)
Любой лист кроме Being, 365 и since-*, у которого есть колонка `ID`/`Client ID` и ≥2 метрических заголовков (`parseReactivationStatisticField_`: ggr/ngr по продуктам, br, last activity). Период — из колонки `Period`/`Range`, из имени листа или из заголовка (`detectReactivationStatisticPeriod_`: 30D/12M). Не кэшируется; используется как fallback под 365-профилем (`mergeReactivationProfiles_(statistics, being.reactivationProfile)` в `buildReactivationClient_`).

## ScriptProperties
`BEING_SPREADSHEET_ID`, `BEING_SHEET_NAME`, `BEING_API_KEY` (создаёт `setupBeingApi`), `VIPCRM_365_CACHE_GENERATION`, `VIPCRM_365_LAST_SELF_WRITE`.

## Ручные точки входа и триггеры
- `setupBeingApi()` — из редактора внутри таблицы: заголовки, формат, свойства, ключ (в лог — маскированно `maskSecret_`).
- `setupReactivationApi()` — проверка since-листов; `debugBeingApi()`, `getBeingApiInfo()` — отладка.
- `setupBeing365CacheTrigger()` / `removeBeing365CacheTrigger()` — устанавливают/снимают onChange-триггер с обработчиком `STATISTICS_365_CACHE.TRIGGER_HANDLER = 'onBeing365Change'`.
- `onBeing365Change()` — если запись не «своя» (`isRecentBeingSelfWrite_`, окно `SELF_WRITE_WINDOW_MS=30000`), вызывает `resetBeing365Cache()` (инкремент generation).
- `resetBeing365Cache()` — также GET `clear365Cache`.

## LockService, самозапись, инвалидация
- `LockService.getScriptLock()` в `updatePinned_` (30 с), `updateActiveQuest_` (20 с), `updateClient_` (30 с, только вокруг записи+flush+read-back; поиск строки — до лока), `updateReactivation_` (20 с).
- `doPost` → `markBeingSelfWrite_()` (ScriptProperty с `Date.now()`), чтобы onChange-триггер не сбрасывал кэш 365 на собственные записи.
- Мемо на одно выполнение (сбрасываются с окончанием выполнения): `memoizedClients_` (сбрасывает `invalidateClientsMemo_` после каждой записи), `memoized365Profiles_`, `memoizedSpreadsheet_`/`memoizedSpreadsheetId_`/`memoizedBeingSheet_`/`memoizedTimezone_` (секция 16; `resetSpreadsheetMemo_` вызывается в `setupBeingApi`). Объекты Spreadsheet/Sheet — живые ссылки, чтение после `flush()` актуально.

## Функции по группам (строка → назначение)
**Setup / debug**: `setupBeingApi` 156 — разовая настройка; `setupReactivationApi` 225 — проверка since-схемы; `debugBeingApi` 258 — схема + 3 клиента; `debug365Statistics_` 276 — покрытие 365 (GET debug365); `getBeingApiInfo` 309 — свойства.
**Reactivation**: `getReactivationFeed_` 328 — сборка feed; `updateReactivation_` 460 — мутации; `getReactivationSheets_` 656 — since-листы по дате; `getReactivationStatisticsProfiles_` 703 — опц. статистика; `detectReactivationStatisticPeriod_` 769; `parseReactivationStatisticField_` 777; `mergeReactivationProfiles_` 810 — слияние профилей (day/7d/30d/12m + daily + playing); `inspectReactivationSheetSchema_` 1409; `reactivationColumnLetter_` 1433; `requireReactivationColumn_` 1446; `readReactivationSheetRows_` 1461 — строки листа в объекты; `buildReactivationClient_` 1507 — карточка R; `extractActiveQuestName_` 1579; `readReactivationInactiveDays_` 1588; `readReactivationLastActivity_` 1598; `isoDateDaysAgo_` 1625; `readReactivationCounter_` 1642; `normalizeReactivationNoteDate_` 1648; `parseReactivationCommEntries_` 1660; `compareReactivationNotesNewestFirst_` 1705; `findLatestReactivationOffer_` 1716; `daysSinceIsoDate_` 1730; `readReactivationNumber_` 1741 — числа с запятыми/пробелами; `readOptionalSheetNumber_` 1772 — число или null; `writeVerifiedReactivationText_` 1783.
**365**: `get365StatisticsProfiles_` 900 — вход с кэшами; `detect365Layout_` 941; `merge365ColumnBlocks_` 1022; `build365StatisticsProfiles_` 1039; `read365Number_` 1179; `get365CacheGeneration_` 1193; `resetBeing365Cache` 1208; `markBeingSelfWrite_` 1227; `isRecentBeingSelfWrite_` 1238; `onBeing365Change` 1267; `setupBeing365CacheTrigger` 1277; `removeBeing365CacheTrigger` 1297; `read365ProfilesCache_` 1310; `write365ProfilesCache_` 1338; `createEmpty365Profile_` 1360; `parse365MetricField_` 1368 — заголовок секции → поле; `add365MetricValue_` 1402.
**Web app**: `doGet` 1812; `doPost` 1878; `invalidateClientsMemo_` 1937; `getClients_` 1942; `updatePinned_` 2087; `ensurePinnedColumn_` 2250; `updateActiveQuest_` 2302; `beingCacheKey_` 2413; `readBeingCache_` 2422; `writeBeingCache_` 2432; `getBeingHeaderMap_` 2449; `resolveClientRow_` 2474; `verifyWrittenCells_` 2497 — read-back одной строкой; `getClientFields_` 2523; `updateClient_` 2559; `findClientRow_` 2834.
**Запись / заголовки / чтение**: `writeText_` 2872; `normalizeBoolean_` 2897; `writeBoolean_` 2927; `writeDate_` 2944; `ensureActiveQuestColumn_` 3011; `ensureHeaders_` 3040; `buildHeaderMap_` 3099 (нормализует заголовки один раз и передаёт третьим аргументом); `getActiveQuestColumnIndex_` 3168; `findHeaderIndex_` 3190; `findBestPopulatedHeaderIndex_` 3235; `requireColumn_` 3296; `readDisplayCell_` 3315; `readBooleanCell_` 3331; `readDateCell_` 3366; `formatSheet_` 3404; `inspectSchema_` 3471.
**Инфраструктура**: `getSafeTimezone_` 3542 (memo) / `resolveSafeTimezone_` 3550; `resetSpreadsheetMemo_` 3617; `openSpreadsheet_` 3626; `getSpreadsheet_` 3638; `getBeingSheet_` 3643; `getSpreadsheetId_` 3691; `authorize_` 3718; `parsePostRequest_` 3750; `formatDateForApi_` 3782; `normalizeDateText_` 3860; `buildIsoDate_` 3941; `cleanString_` 3992; `maskSecret_` 4009; `normalizeHeader_` 4016; `json_` 4031; `errorResponse_` 4042.

## Известные ограничения
- `updateClient_` после flush перечитывает только текстовые поля (`written`: notes, clientName, activeQuest, bonusLog); даты и pinned в `verified` не входят (pinned подтверждается отдельно в `confirmedChanges.pinned`).
- `updateActiveQuest_` ищет строку полным сканом колонки ID (`findClientRow_`) и не использует CacheService-кэш строки, в отличие от `updateClient_`/`getClientFields_`.
- `getReactivationStatisticsProfiles_` обходит все листы книги на каждый `getReactivation` (без кэша).
- Кэш 365 без установленного onChange-триггера обновляется только при изменении размеров/последней даты листа или по TTL 6 ч; правка «на месте» может быть невидима до `clear365Cache`.
- `updatePinned` — изменяющий GET (так шлёт клиент). API-ключ уходит GET-параметром через прокси.
- Дубликаты ID в Being: кэшированная строка (`resolveClientRow_`) подтверждается своей ячейкой ID и может указывать не на первое вхождение, тогда как `findClientRow_` возвращает первое.
- `parsePostRequest_` парсит JSON без try — ошибка уходит как `{ok:false, error}` через `doPost`.
