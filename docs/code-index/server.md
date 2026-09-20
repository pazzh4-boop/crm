# Индекс: локальный мост и запуск (crm_server.ps1, START_CRM.bat, START_CRM_HIDDEN.vbs, DIAGNOSE_CRM.bat, being_config.json)

Назначение: браузер никогда не ходит в Google Apps Script напрямую. Всё идёт через
локальный HTTP-сервер на PowerShell (`http://127.0.0.1:8765`), который отдаёт статику
из папки CRM и проксирует `/being-api` в Apps Script `/exec`, добавляя API-ключ из
`being_config.json`. Ключ и URL никогда не попадают в main.js и в браузер.

## Цепочка запуска

| Файл | Что делает |
|---|---|
| `START_CRM.bat` | `cd` в папку скрипта, запускает `wscript.exe START_CRM_HIDDEN.vbs` в фоне (без окна консоли). Коды выхода: 1 нет wscript, 2 нет vbs. |
| `START_CRM_HIDDEN.vbs` | Собирает команду `powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File crm_server.ps1` и запускает её скрыто (`shell.Run command, 0, False`). |
| `crm_server.ps1` | Сам мост: проверка конфига, TcpListener, открытие окна браузера в режиме `--app`, always-on-top, обработка запросов, безопасное выключение. |
| `DIAGNOSE_CRM.bat` | Ручная диагностика: наличие файлов, PowerShell, порт 8765, поля being_config.json (без вывода секретов), живой мост (`?action=ping`, `?action=getClients`). |
| `being_config.json` | НЕ в репозитории (в `$BlockedFiles`, сервер отдаёт на него 404). Поля: `web_app_url` (Apps Script `/exec`), `api_key`. |

## crm_server.ps1 — структура сверху вниз (строки ≈)

| Строки | Блок | Заметки |
|---|---|---|
| 1-33 | Параметры: `$HostAddress` 127.0.0.1, `$Port` 8765 (переопределяется `-Port N`), флаги `-NoBrowser`, `-NoAlwaysOnTop`; `$ConfigPath`; `$BlockedFiles` (конфиг, сам сервер, bat/vbs) | `$ErrorActionPreference = "Stop"`, TLS 1.2 |
| 35-41 | `Write-Banner` | |
| 43-95 | `Open-VipCrmWindow $Url` | Ищет Edge/Chrome по стандартным путям, открывает `--app=$Url` с отдельным профилем `%LOCALAPPDATA%\VIPCRM\BrowserProfile`, `--window-size=420,300`, `--lang=en-US` (формат date-picker), `--force-dark-mode`. Fallback: `Start-Process $Url`. Запоминает профиль в `$script:BrowserProfilePath` для поиска окна. |
| 97-173 | Always-on-top: `VipCrmWindowApi` (P/Invoke SetWindowPos/GetWindowLong/IsWindow), `Find-VipCrmWindowHandle` (ищет процесс chrome/msedge с нашим профилем в командной строке), `Update-VipCrmTopmost` (раз в 2 с ставит `WS_EX_TOPMOST`, флаги NOSIZE\|NOMOVE\|NOACTIVATE) | Окно само меняет размер при каждом открытии экрана и может выпасть из topmost-полосы, поэтому проверка периодическая |
| 175-222 | `Get-BeingConfig` | Кэш по `LastWriteTimeUtc.Ticks` файла: правка конфига применяется без перезапуска. Валидирует URL по regex `^https://script\.google\.com/macros/s/.+/exec(?:\?.*)?$` и что ключ не `PASTE_*` |
| 224-284 | URL-утилиты: `ConvertTo-UrlEncoded`, `ConvertFrom-UrlEncoded`, `Parse-QueryString`, `Build-QueryString` | |
| 286-318 | `Get-MimeType`, `Get-StatusText` | |
| 320-369 | `Send-HttpResponse`, `Send-Json` | Всегда `Connection: close`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` |
| 371-492 | `Read-HttpRequest` | Заголовки читаются побайтно до `\r\n\r\n` (чтобы не проглотить тело), лимит 64 КБ; тело по Content-Length |
| 494-539 | `Invoke-GoogleGet -Action -Query` | Пробрасывает все query-параметры кроме `_` и `apiKey`, добавляет `action` и `apiKey`, GET на `/exec`, таймаут 60 с |
| 541-580 | `Invoke-GooglePost -Payload` | Тело клиента (JSON) + `apiKey` → form-urlencoded `payload=<json>` (так Apps Script получает `e.parameter.payload`), таймаут 120 с (запись ждёт ScriptLock) |
| 582-639 | `Serve-StaticFile` | `/` → index.html; блок-лист по имени файла; защита от выхода из папки (`GetFullPath` + `StartsWith`) |
| 641-822 | `Handle-Client` — маршрутизация | см. таблицу ниже |
| 824-872 | Старт: баннер, проверка конфига (сервер стартует и без него), `TcpListener`, вывод адреса, открытие окна | Порт занят → exit 2 |
| 874-903 | Главный цикл: пока не `ShutdownRequested`; `CloseDeadline` (окно закрыто → стоп через 6 с, если не пришёл heartbeat); `Update-VipCrmTopmost`; `Poll(200000 мкс)` вместо sleep-опроса; `AcceptTcpClient` → `Handle-Client` (однопоточно, последовательно) | |

## Маршруты

| Путь | Метод | Поведение |
|---|---|---|
| `/crm-control?action=ping` | GET | `{ok, service, status:"online"}` — клиент так узнаёт, что запущен через мост |
| `/crm-control` | POST `{action}` | `heartbeat` — сбрасывает `CloseDeadline` (клиент шлёт раз в 3 с); `window-closing` — дедлайн +6 с (клиент шлёт из `beforeunload`, keepalive); `shutdown` — остановить сервер (Save & Exit). Иначе 400 |
| `/being-api?action=…` | GET | По умолчанию `getClients`. Проксируется в Apps Script как есть. Ошибка Google → 502 `{ok:false,error}` |
| `/being-api` | POST JSON | Логирует `action` и `clientId`, проксирует через `Invoke-GooglePost`. Ошибка → 502 |
| прочее | GET | Статика; не-GET → 405 |

Кто что шлёт с клиента — см. `main.js.md` (раздел API) и `Code.gs.md` (диспетчер).

## Известные особенности

- Сервер однопоточный: пока Apps Script отвечает на один запрос (до 60/120 с), остальные ждут в бэклоге слушателя. Клиент это учитывает (`BEING_SAVE_RETRY_DELAYS`, подтверждение записи через `getClientFields`).
- API-ключ уходит в Google GET-параметром (в URL) — это принято для локального моста; для POST он в теле.
- Файл в UTF-8 с BOM, переводы строк LF — сохранять при правке (PowerShell 5.1 читает BOM, чтобы не сломать кириллицу/тире в строках).
