# Индекс CSS (tokens.css · main.css · reactivation-v30.css)

Состояние после чистки мёртвого кода: 13 533 строк в трёх файлах.
Цель файла: найти нужное правило grep-ом, не читая 13 тысяч строк. Идентификаторы — как в коде.

## 1. Порядок загрузки и роль файлов

`index.html` подключает (строки 11–14, 1388):

| # | Файл | Строк | Роль |
|---|------|-------|------|
| 1 | Google Fonts `<link>` | — | Шрифты. CSS применяет только `--font-ui` = IBM Plex Sans (9 объявлений `font-family`, все остальные — `inherit`). |
| 2 | `tokens.css` | 70 | Палитра, радиусы, шрифт. Только `:root`-переменные, ни одного селектора-компонента. |
| 3 | `main.css` | 8 645 | Все экраны, карточки, модалки, лоадер. Внутри — свои слои «final priority» (v1.5.4.24–28), накопленные версиями. |
| 4 | `reactivation-v30.css` | 4 818 | **Не** «стили экрана Reactivation», а слой хотфиксов поверх всего main.css: экран Reactivation (строки 1–1563), затем перекраска всего приложения под `[data-theme="dark"]` (1564–2865), док/меню/оболочка окна (2866–3179), «плоская консоль» (3180–4818). Загружается последним, поэтому при равной специфичности побеждает. |
| 5 | `main.js` | — | Ставит state-классы и `data-*`, из которых CSS читает состояние (см. §6). |

Каскад для любого селектора `X`: `tokens → main → reactivation`; внутри — по специфичности; `[data-theme="dark"] X` (+0,1,0) бьёт `X`; `:root[data-theme="dark"] X` (+0,2,0) бьёт оба; `!important` бьёт всё не-important. Атрибут `data-theme="dark"` стоит на `<html>` (index.html:2) один раз и навсегда — это не тема, а самодельный cascade layer (main.js его не трогает).

**Как узнать, кто побеждает для селектора** (без DevTools):
```
grep -n -E '(^|[ ,>])\.being-card-body\b' main.css reactivation-v30.css
```
Смотрим все совпадения сверху вниз; побеждает последнее из самых специфичных (`:root[data-theme]` > `[data-theme]` > без префикса), при `!important` — последнее из important. Списки селекторов (`a, b {}`) тоже считаются. В DevTools: Elements → Styles показывает то же самое зачёркиванием.

## 2. tokens.css — палитра и токены

`:root` (строки 14–59) и типографика (60–70). Использований — в main.css + reactivation-v30.css.

| Токен | Значение | Смысл / где | Uses |
|-------|----------|-------------|------|
| `--ground` | #0B0C0E | фон приложения (`.app`, `body`) | 11 |
| `--panel` | #0B0C0E | header, rail, модалка; сплошные заливки панелей (бывшие вырожденные градиенты) | 73 |
| `--panel-2` | #15171A | tile, input, лента метрик | 146 |
| `--panel-3` | #1F2226 | активное состояние, аватар, поле в фокусе, hover строки | 119 |
| `--line` | #2E3237 | рамка кнопки, край header | 80 |
| `--line-soft` | #23262A | разделитель строк, трек прогресса | 137 |
| `--ink` | #EDEEEF | числа, имена, заголовки (17.6:1) | 167 |
| `--ink-2` | #A8ABAE | вторичные значения (8.5:1) | 154 |
| `--ink-3` | #83868A | подписи, плейсхолдеры, тире (5.3:1) | 160 |
| `--accent` | #E3E5E6 | нейтральный акцент (светом, не цветом) | 63 |
| `--glow` / `--glow-soft` | белые свечения | единственный «свет» (box-shadow) | 2 / 2 |
| `--s1`…`--s5` | зелёный → красный | шкала lifecycle: active / catch up / call twice (+pinned в Being) / pre-sleep / sleeping (+отрицательные суммы). Единственная роль цвета. | 20/2/30/2/7 |
| `--r-s` / `--r-m` | 10px / 16px | радиусы: строка при hover / tile, поле, панель | 121 / 22 |
| `--font-ui` | IBM Plex Sans, Segoe UI… | единственная гарнитура | 9 |

Удалены как неиспользуемые: `--hover`, `--accent-wash`, `--glow-text`, `--shadow`, `--r-l` (24px «для модалок» — так и не применён, см. README «still on the list»), `--font-display` (Archivo), `--font-mono` (IBM Plex Mono). Archivo и Plex Mono из `<link>` в index.html убирает JS-агент.

Токены вне tokens.css (main.css):
- `main.css:4` `:root` — движение: `--ui-speed: 240ms`, `--ui-curve` (255 использований каждый).
- `main.css:45` `:root` — шкалы: `--s-7…--s-30` (фиксированные px), `--t-1…--t-11` (fluid clamp), `--sp-1…--sp-20` (отступы), `--ls-caps-tight/--ls-caps/--ls-caps-wide/--ls-kicker` (трекинг капса), `--num: tabular-nums`.
- `main.css:6660` `:root` — `--ui-positive: var(--s1)`, `--ui-negative: var(--s5)`.
- `main.css:8476` `:root, [data-theme="dark"]` — ролевые имена, оставлены только читаемые: `--text-secondary`, `--border-primary` (= `--line-soft`), `--accent-primary` (= `--ink`), `--accent-hover`, `--button-secondary-bg` (= `--panel-3`), `--scrollbar-track/-thumb/-thumb-soft`. Значения — те, что раньше побеждали из reactivation-v30.css (блок `[data-theme="dark"] {…}` там удалён, источник истины один).
- `reactivation-v30.css:1098–1123` — `--stage-tone` на `.reactivation-stage--*` и `[data-stage]`; `~3196` `:root` — `--overlay-fill`, `--scrim`, `--hairline-soft`; `~3555` `--field-line`; `.cbar` (1462) — `--cbar-*`.

## 3. main.css — структура сверху вниз (диапазоны ≈ после правок)

| Строки | Секция | Что внутри |
|--------|--------|------------|
| 1–24 | RESET / BASE | `:root` движение; reset. |
| 26–194 | TOKEN LADDER | `:root` (45) шкалы `--s-*`, `--t-*`, `--sp-*`, `--ls-*`. |
| 195–225 | APP / PAGE LAYER | `.app`, `.page-container`, `.page` (фон `.app` задаёт reactivation-v30.css:3719+). |
| 226–294 | MAIN MENU (старое) | `.main-menu`, `.update-button`, `.system-meta` — базовые; актуальная геометрия дока в reactivation-v30.css:2866+. |
| 295–309 | SHARED CONTENT OFFSET | общий отступ страниц. |
| 310–588 | YESTERDAY | `.yesterday-*`, `.player-table__*` (418+), сортировка `[data-direction]`. |
| 589–790 | DASHBOARD | `.dashboard-*`, `.dashboard-top-*`. |
| 791–848 | VERSION NOTIFICATION | `.update-button`, версия/дата. |
| 849–993 | @media: LOWER HEIGHT DESKTOP / TABLET / PHONE | брейкпоинты ≤980/760/520 (см. долги). |
| 994–1596 | CLIENTS DIRECTORY + CLIENT PROFILE | `.clients-*`, `.client-card` (1067), `.client-profile-*`, `.profile-*` (1111+), `.where-plays-*` (1190). |
| 1597–1785 | v1.2.x motion / readability | остатки правок движения (анимации входа удалены — их глушил `animation: none !important` в 7025+). |
| 1786–2540 | CLIENT QUEST | `.client-quest-*`, `.quest-*` (окно квеста 1830+, форма/редактор 2254–2384). |
| 2541–2706 | BONUS HISTORY | `.bonus-history-overlay/-modal/-row`. |
| 2707–2723 | REDUCED MOTION | `@media (prefers-reduced-motion)`. |
| 2724–2827 | client destination popover | `.client-quick-nav*`. |
| 2828–3034 | reactivation current quest / contact | `.reactivation-current-quest-*`, `.reactivation-history-action(s)` (кнопка Bonuses в карточке, 2887+). |
| 3035–3614 | card focus, current quest workspace | `.quest-confirm-modal` (3129), `.quest-history-*`. |
| 3615–3726 | BEING CARD | `.being-card-modal` (3631), `.being-card-*`. |
| 3727–3896 | v1.5.4.28/30 reactivation workspace | `.reactivation-comm-*`, `.reactivation-offer-*`, `.reactivation-work-*`. |
| 3897–4459 | v1.5.4.29 reactivation portal | `.reactivation-card-overlay` (3914), таблица `.reactivation-table__*`/`.reactivation-row` (4054+). |
| 4460–4642 | APP LOADER | `.app-loader*`, `@keyframes app-loader-spin`. |
| 4643–4910 | reactivation page | `.reactivation-page/-title/-summary-*/-metric*`. |
| 4911–5156 | reactivation card modal | `.reactivation-card-overlay.is-open`, `.reactivation-stage-badge` (4966). |
| 5157–5450 | zipper back, fullscreen geometry, metric rail | `.reactivation-portal-back`, `.app--reactivation-portal`. |
| 5451–5788 | reactivation search / rows | `.reactivation-search*`, `.reactivation-contact-*`. |
| 5789–6659 | being-note и таблицы | `.being-note-*` (5789+), `.reactivation-12m-*`. |
| 6660–6960 | `:root` positive/negative; transition language | `.reactivation-card-overlay, .bonus-history-overlay` (6672). |
| 6961–7457 | v1.5.4.24 «final cascade» | карточка Reactivation поверх портала; `animation: none !important` (7025) для всех списков. |
| 7458–7472 | v1.5.4.25 final priority layer | однострочники с `!important` (композер заметок). |
| 7473–7651 | v1.5.4.26 | компактные заметки, list-first карточка. |
| 7652–7916 | v1.5.4.27 | dual workspace, `.being-note-*` canvas. |
| 7917–8470 | v1.5.4.28 final priority layer | геометрия dual shell; 8112 native date indicator. |
| 8471–8649 | SEMANTIC TOKENS | `:root, [data-theme="dark"]` ролевые имена (8476), `.theme-toggle` (8505–8568, кнопка disabled, остаётся), reduced motion, transitions `.player-table__row`. |

## 4. reactivation-v30.css — структура

| Строки | Секция | Что внутри |
|--------|--------|------------|
| 1–279 | v1.5.4.38 statistics card | `.reactivation-statistics-*`, `.reactivation-period-toggle` (28), grids (61–279). |
| 280–344 | v1.5.4.36 Being-aligned geometry | `.reactivation-work-section`, `.reactivation-comm-composer`, `.reactivation-offer-fields`. |
| 345–359 | v1.5.4.38 fill geometry | прогресс после async-загрузки. |
| 360–506 | v1.5.4.35 control-center geometry | `.reactivation-page/-title/-summary/-metric` для `.app--reactivation-portal`. |
| 507–665 | v1.5.4.31 tool rail | `.reactivation-work-toolrail`, `[data-reactivation-work-tool]`, `@keyframes reactivation-tool-open`. |
| 666–837 | v1.5.4.32/33 | таблица статистики; dual-card: `.reactivation-card-dual-shell/-main-panel/-notes`. |
| 838–1028 | v1.5.4.35 one panel at a time | `.reactivation-work-panel`, `.reactivation-stage-badge` (861). |
| 1029–1097 | v1.5.4.44 columns | `grid-template-columns` таблицы Reactivation — **единственное живое место ширин колонок**. |
| 1098–1130 | stage colours | `.reactivation-stage--{active,catch_up,call_twice,pre_sleep,sleeping,unassigned}` → `--stage-tone`; `.reactivation-stage-badge[data-stage=…]`. |
| 1131–1563 | statistics / casino / `.cbar` (1462) | панели статистики карточки. |
| 1564–2550 | «Generated» `[data-theme="dark"] X` | перекраска всего приложения: панели, поля, строки, модалки Being/Clients/Yesterday/Dashboard. 239 правил с префиксом остались после чистки (было 341). |
| 2551–2659 | Flat surfaces | `[data-theme="dark"]` панели/плиты/поля. |
| 2660–2865 | headings / panels / lists / cards / compact | высоты строк (`.being-row`, `.reactivation-row`, `.player-table__row` 2746–2865). |
| 2866–3140 | dock & compact menu | `.menu-dock*` (2866), `:root[data-shell]` (2946+), `:root[data-collapsed]` (3007+), `.main-menu` (3019). |
| 3141–3179 | one Back | все прочие back-кнопки `display:none`. |
| 3180–3331 | OVERLAPPING PANES | `:root` overlay-токены, карточки (3228), скримы (3261), экраны (3274). |
| 3332–3698 | «screen is not a card» | `:root[data-theme="dark"]`-слой: убирает фоны/рамки; поля (3485), мелкие контролы (3512). |
| 3699–3925 | ONE GROUND | «всё над землёй прозрачно» (3719), контролы-контуры (3742), hover/selected — единственные заливки (3798). |
| 3926–4300 | Clients/Being card details | вложенные заголовки, «каждое поле с контуром» (3954), квест-блок (4050), last contact (4073), заметки как комментарии (4136), поля квеста (4239). |
| 4301–4409 | quest layout / portrait | `@media (max-aspect-ratio)` стек колонок; textarea в одну строку (4393). |
| 4410–4599 | dock stacks / larger / clearance | `.menu-dock__*` размеры, `.*-header { padding-left }` под док (4482). |
| 4600–4799 | shell states | `.dock-plate`, `:root[data-shell="home"|"page"|"portal"]`, `:root[data-collapsed="true"]`, `[data-reshaping]`. |
| 4800–4818 | STAGE COLOUR | финальное слово для `[data-reactivation-stage-filter]` счётчиков (бывшие `#reactivationActiveCount`). |

## 5. Карта компонентов (класс-семейство → файл: правил, диапазон строк)

| Блок UI | Классы | main.css | reactivation-v30.css |
|---------|--------|----------|----------------------|
| Лоадер | `.app-loader*` | 20 правил, 4464–4635 | 7, 1934–3830 |
| Док (кнопки Back/Collapse/Menu) | `.menu-dock*`, `.dock-plate` | — | 40 + 4, 2866–4799 |
| Меню | `.main-menu*`, `.update-button`, `.system-meta`, `.theme-toggle` | 9/8/2/8 (229–8602) | 41/15/7/9 (1567–4774) |
| Страницы (общее) | `.page`, `.page-container`, `.app--page-open` | 5, 204–7025 | 4, 3007–3720 |
| Yesterday | `.yesterday-*`, `.player-table__*` | 23 + 31, 297–8599 | 18 + 13, 1442–4551 |
| Dashboard | `.dashboard-*` | 52, 297–7086 | 21, 1591–4551 |
| Clients (каталог) | `.clients-*`, `.client-card`, `.client-quick-nav` | 49/20/11 | 18/11/8 |
| Профиль клиента | `.client-profile-*`, `.profile-*`, `.where-plays-*` | 37 + 90 + 11, 964–7455 | 8 + 19 + 1 |
| Квест | `.client-quest-*`, `.quest-*` | 65 + 170, 1786–8650 | 21 + 61, 1657–4724 |
| Bonus history | `.bonus-history-*` | 36, 2543–7016 | 13, 1714–4724 |
| Being (список) | `.being-*` (кроме card/note) | 193, 297–8398 | 120, 456–4724 |
| Being карточка | `.being-card-*` | 85, 3615–8398 | 57 |
| Being заметки | `.being-note-*` | 36, 5789–7966 | 36, 2261–4405 |
| Reactivation экран | `.reactivation-page/-title/-summary/-metric/-search`, `.app--reactivation-portal` | 4/6/26/34/21, 4643–6788 | 1/2/10/16/10 |
| Reactivation таблица | `.reactivation-table__*`, `.reactivation-row`, `.reactivation-stage*`, `.reactivation-contact-*` | 36/34/13/94 | 24/24/24/34 |
| Reactivation карточка | `.reactivation-card-*`, `.reactivation-work-*`, `.reactivation-offer-*`, `.reactivation-comm-*`, `.reactivation-statistics-*`, `.reactivation-12m-*`, `.reactivation-smart-*`, `.reactivation-notes-*`, `.cbar` | 93/7/18/21/—/16/7/10 | 95/55/37/21/24/16/9/12/17 |
| Кнопка Bonuses в карточке | `.reactivation-history-actions/-action` | 12, 2887–7818 | 8, 756–3808 |
| Exit / save toast | ищи `save-exit`, `exit-` (см. `grep -n 'exit' main.css`) | | |

## 6. Соглашения

**Стадии.** JS собирает класс `reactivation-stage reactivation-stage--${status}` (main.js:2167) из статусов `active|catch_up|call_twice|pre_sleep|sleeping|unassigned` (main.js:236–241); CSS читает их в reactivation-v30.css:1098–1103 (`--stage-tone`) и через `[data-stage]` на бейдже (1116–1123). Цвет = только `--s1…--s5`.

**`data-*`, из которых читает CSS, и кто их ставит (main.js):**

| Атрибут | Где ставится | Что означает для CSS |
|---------|--------------|----------------------|
| `data-theme="dark"` | index.html:2, статично | cascade layer для 239 правил reactivation-v30.css + main.css:8476 |
| `data-shell="home\|page\|portal"` | main.js:5977 (`dataset.shell`) на `<html>` | форма окна: что показывает док (2946+), ширина дока (4600+) |
| `data-collapsed="true"` | main.js:6221–6222 на `<html>` | окно свёрнуто: экраны и оверлеи скрыты (3007+) |
| `data-reshaping` | main.js:6050 | окно меняет размер — экран гасится |
| `data-open` | main.js:6584 (`.menu-dock`) | меню открыто |
| `data-direction="asc\|desc"` | main.js:811, 1755 (сортировка) | стрелка сортировки `.player-table-sort` / `.reactivation-sort-button` |
| `data-stage` | main.js:1962, 2292 | цвет бейджа стадии |
| `data-contact-type` | main.js:2037 | иконка/цвет контакта |
| `data-reactivation-stage-filter` | index.html (статично) + main.js:1766 | фильтры-счётчики; цвет active/sleeping в 4800+ |
| `data-reactivation-work-panel` | index.html | панели инструментов карточки |
| `hidden`, `readonly`, `aria-pressed` | JS/HTML | стандартные |

**State-классы** (ставит `classList.toggle/add`): `is-open`, `is-active`, `is-pinned`, `is-empty`, `is-editing`, `is-dirty`, `is-saving`, `is-completed`, `is-inactive`, `is-undated`, `is-visible`, `is-leaving`, `is-placeholder`, `is-note-scroll-limited`, `is-profile-mode`, `is-view-active`, `is-success`/`is-danger`, `is-no-active-quest`, `is-open-ended`; на `<html>`/`body`: `is-being-card-open`, `is-reactivation-card-open`, `is-bonus-modal-open`; на `.app`: `app--page-open`, `app--reactivation-portal`, `app--window-collapsed`.

**Правила именования.** BEM-подобное: `block__element--modifier`; семейства по экрану (`being-`, `reactivation-`, `quest-`, `profile-`). Новые правила для экрана Reactivation — в reactivation-v30.css; для остальных — в main.css, но помни, что reactivation-v30.css:1564+ перекрашивает всё через `[data-theme="dark"]`, и чтобы «победить», правило надо класть туда или давать ему `:root[data-theme="dark"]`-префикс.

## 7. Известные долги (не трогались в этой чистке — отдельные задачи с визуальным риском)

| Долг | Объём | Оценка |
|------|-------|--------|
| Слой `[data-theme="dark"]` — фиктивная тема, нужен только чтобы reactivation-v30.css перебивал main.css | 239 правил в reactivation-v30.css (1564–2865 + точечно), 1 в main.css | Сплющить в базовые селекторы (перенести отличающиеся значения в `X`, снять префикс, убрать атрибут из index.html). Ожидаемо −300…−500 строк и большая часть `!important` ниже станет не нужна. Нужен скриншот-стенд. |
| `!important` | main.css 267, reactivation-v30.css 815 (≈47 % деклараций файла) | Следствие слоёв «final priority» v1.5.4.24–28 (main.css 6961–8470) и хотфиксов reactivation. Снимать только после сплющивания слоёв. |
| Две орфографии `@media (hover: hover) and (pointer: fine)` / `(hover:hover) and (pointer:fine)` | 23 + 31 в main.css, 10 в reactivation; всего 162 `@media`-блока | Привести к одной; блоки одного запроса можно слить (порядок правил внутри сохранить). |
| Брейкпоинты ≤ 1020px | 56 блоков / 752 строки (в основном main.css 849–993, 1538–1596, 2054+) | Окно приложения — вся рабочая область (1920×1032) или верхняя половина портретного экрана (1125 px); эти правила срабатывают только при ручном сужении окна. Решение за владельцем. |
| `::-webkit-scrollbar*` | 30 в main.css | Заменить на `scrollbar-width` / `scrollbar-color` (Chromium ≥121); часть мест уже дублирует оба (например `.being-note-*` в 7652+). |
| `-webkit-font-smoothing`, `-webkit-tap-highlight-color`, `-webkit-text-size-adjust` (main.css 163–196), `-webkit-appearance` (reactivation ~3390) | 4 | Первые три не действуют на Windows-десктопе; последний → `appearance`. |
| 215 правил `[data-theme="dark"] X`, повторяющих базовое значение | reactivation-v30.css 1564–2865 | Не удалены: у каждого есть сосед с промежуточной специфичностью (`:last-child`, `:hover`, `.x:first-of-type`), который выиграл бы после удаления. Уйдут вместе со сплющиванием слоя. |
| `.reactivation-offer-research { display: none !important }` (main.css ≈7559) | 1 правило | Элемент уже удалён из index.html; правило оставлено, пока скриншот-стенд работает на старой разметке. Удалить при следующем проходе. |
| 3-стоповый градиент одного цвета | reactivation-v30.css:2134 | `background: var(--panel-3)`. |
| `:root` объявлен в 4 местах main.css и ~6 в reactivation-v30.css | — | Свести к tokens.css + один блок движения/шкал. |

## 8. Как проверять правки без визуальных изменений

Скриншот-стенд и дамп computed-style лежали в scratchpad сессии (`harness/mock_server.py`, `shots.js`, `diff2.js`, `styledump.js`); принцип воспроизводим: мок `/being-api` с фикстурой из 6 клиентов, Playwright 1920×1032 и 1125×980, 16 состояний (меню, 5 экранов, карточка Being, карточка Reactivation + 3 инструмента, профиль + 3 периода, квест). Две ловушки стенда: порядок двух pinned-строк Being недетерминирован (гонка данных в main.js → нужны два эталона), поле TIME в карточке Reactivation показывает текущие часы (маскировать 130×24 px).
