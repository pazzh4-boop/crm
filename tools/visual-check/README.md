# Визуальная проверка (скриншот-дифф)

Стенд для проверки, что правка CSS/JS не изменила вид экранов. Ничего из этого
не нужно для работы CRM и не попадает в окно приложения.

Состав:
- `mock_server.py <папка> <порт>` — отдаёт статику из папки и подменяет `/being-api` и
  `/crm-control` фикстурой (6 клиентов, 4 строки реактивации, ping версии 3.4). Запросы
  на запись отвечают `{ok:true}`.
- `shots.js <outDir> <baseUrl> [width height]` — Playwright: загружает приложение, ждёт
  конец загрузчика и снимает 16 экранов (меню, 5 страниц, Being-карточка, Reactivation-карточка
  и её инструменты, профиль клиента и периоды, квест). Пишет `console.log` с ошибками страницы.
- `diff.js <dirA> <dirB>` — процент отличающихся пикселей по каждому скриншоту.

Требуется Node 18+ и пакет `playwright` с Chromium (в облачной сессии Claude он есть
глобально: `NODE_PATH=/opt/node22/lib/node_modules`).

Порядок:

```bash
# 1. эталон на исходниках (например, из git)
git stash            # или git worktree add /tmp/orig HEAD
python3 tools/visual-check/mock_server.py . 8766 &
node tools/visual-check/shots.js /tmp/shots/baseline http://127.0.0.1:8766/
git stash pop

# 2. после правок
node tools/visual-check/shots.js /tmp/shots/after http://127.0.0.1:8766/
node tools/visual-check/diff.js /tmp/shots/baseline /tmp/shots/after
```

Ожидание для чистки/рефакторинга: 0.000% на всех экранах. Любое отличие — найти
правило или строку, которая его дала, и объяснить в отчёте.
