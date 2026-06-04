# CLAUDE.md — архитектура проекта (читается автоматически каждую сессию)

> Назначение этого файла: дать полный контекст по проекту без перечитывания всех файлов.
> **Правило: меняешь архитектуру/добавляешь модуль/поле — обнови соответствующий раздел здесь в том же коммите.**

## Что это

Офлайн-тренажёр (PWA) для подготовки к **КТ в магистратуру РК, ГОП М094 «Информационные технологии»**.
Два профильных предмета:
- **ads** — Алгоритмы и структуры данных (одиночный выбор, 1 верный из A–E).
- **db** — Базы данных (множественный выбор 1–3 из A–H, баллы **2 / 1 / 0**).

Стек: **чистый HTML + ES-модули (vanilla JS), без фреймворков и без сборки**. Хостинг — GitHub Pages
(репозиторий `Zhar04/ads_questions`, ветка `main`). Все пути **относительные** (`./...`) — важно для Pages в подпапке.

## Запуск / деплой

- Сборки нет. Любой статический сервер из корня (напр. `python -m http.server`) — и открыть `index.html`.
- Деплой = `git push origin main` (Pages раздаёт корень). Коммитим прямо в `main` (так исторически работает владелец).
- Самопроверка данных/логики: открыть `tests.html` (набор assert-ов в браузере).
- Валидация банков офлайн: `node tools/validate-banks.mjs` (см. ниже).
- При коммите git ругается `LF will be replaced by CRLF` — это безвредно (Windows), не трогаем.

## Карта файлов

### Страницы (каждая подключает свой ES-модуль или инлайн-скрипт)
- `index.html` — домашняя АиСД (ads). Инлайн-скрипт: прогресс, выбор языка, последние результаты.
- `databases.html` — домашняя БД (db). Аналогично, `SUBJECT='db'`.
- `topics.html` — список тем (`renderTopicList` из `topics.js`). Параметр `?subject=`.
- `topic.html` — одна тема (`renderTopicPage`). `?id=N&subject=`.
- `quiz.html` — тест (`initQuiz` из `quiz.js`). `?mode=&count=&topic=&block=&subject=&lang=`.
- `cheatsheets.html` — шпаргалки (инлайн-скрипт рендерит `data/cheatsheets.json`). `?subject=`.
- `tests.html` — self-check продукта (assert-ы), не часть приложения для ученика.

### JS-модули (`js/`)
- `app.js` — утилиты: `esc`, `qs(name,def)`, `el(tag,attrs,html)`, `renderMarkdown(md)` (мини-markdown:
  заголовки/списки/таблицы/`code`/**bold**/fenced), `showError`, `registerSW()` (вызывается при импорте).
- `data-loader.js` — `loadQuestions(subject,lang)`, `loadTopics(subject)`, `getTopic`, `getQuestionsByTopic`,
  `getQuestionsByBlock`, `loadTopicsWithCounts`, плюс `SUBJECTS`, `LANGS`, `normalizeSubject/Lang`. Кеш в памяти.
  Пути к банкам/конспектам заданы здесь (`QUESTION_PATHS`, `TOPIC_PATHS`).
- `quiz-engine.js` — чистая логика (без DOM, тестируемая): `shuffle`, `stratifiedSample`, `topicSample`,
  `blockSet`, `isCorrect`, `countMistakes`, `questionPoints`, `scoreQuiz`, `createTimer`, `fmtTime`,
  `shuffleQuestion` (перемешивание вариантов с безопасным ремапом ключа и разбора). `FULL_TEST_MINUTES`.
- `quiz.js` — контроллер `quiz.html`: состояние теста, рендер вопроса, навигатор по номерам, горячие клавиши,
  экран результата, запись прогресса/ошибок/истории. Рендер тела вопроса — `buildQuestionBody` (проза + таблица + код).
- `topics.js` — `renderTopicList`, `renderTopicPage` (блоки конспекта + картинки `figures` + тесты блоков).
- `progress.js` — прогресс в localStorage (раздельно по предметам): чтение блоков, лучший квиз/полный тест,
  **журнал ошибок** и **история результатов** (см. ниже).

### Данные (`data/`)
- `ads_question_bank.json` — банк АиСД (ru). `{ meta, questions: [...] }`.
- `ads_question_kz_bank.json` — банк АиСД (kk). ⚠️ грязный OCR, по запросу владельца **пока не трогаем**.
- `db_questions_bank.json` — банк БД (ru).
- `topics.json` / `db_topics.json` — конспекты (`{ meta, topics:[{topic_id,title,blocks:[...]}] }`).
- `cheatsheets.json` — шпаргалки `{ meta, sheets: { ads:[...], db:[...] } }`.

### Прочее
- `css/styles.css` — все стили. CSS-переменные в `:root`: `--accent #7c3aed`, `--accent2 #06b6d4`,
  `--bg`, `--card`, `--border`, `--text`, `--muted`, `--green/--red/--yellow`, `--radius`, `--font-body`, `--font-head`.
- `service-worker.js` — офлайн-кеш. **Статика — cache-first, данные (`/data/`, `*.json`) — network-first.**
- `manifest.json`, `icons/`, `images/` (картинки вопросов и конспектов).
- `tools/validate-banks.mjs` — офлайн-валидатор всех банков (запуск `node`).

## Схемы данных

### Вопрос (элемент `questions[]`)
```jsonc
{
  "id": "ADS-001",                       // уникальный; префикс ADS-/DB-/ADSKZ-
  "question": "текст…",                  // может содержать встроенный код или таблицу (см. рендер)
  "options": [{ "letter": "A", "text": "…" }, …],   // A–E (ads) / A–H (db)
  "correct_answers": ["B"],              // буквы; единственный источник правды о верном ответе
  "answer_type": "single" | "multi",
  "topic_id": 1..N, "topic": "…",
  "difficulty": "А|В|С",                 // опционально
  "explanation": "…",                    // разбор; ЧАСТО называет букву («Верно A»)
  "verification": "verified|corrected|source", "verification_note": "…",  // опц.
  "has_figure": false,                   // true → вопрос про рисунок
  "image": "images/ads-026.png",         // если рисунок есть в банке
  "code": "…\n…",                        // опц. явный блок кода (исторический формат)
  "block_id": "t1_b8",                   // опц. привязка к блоку конспекта
  "source_files": […], "original_keys": {…}  // происхождение
}
```

### Блок конспекта (`topics[].blocks[]`)
```jsonc
{ "block_id": "db_t1_b1", "title": "…", "content_md": "markdown…",
  "figures": [{ "src": "images/db-t1-b1-1.png", "caption": "…" }],   // опц., рендерятся под блоком
  "links": [{ "url": "…", "title": "…" }] }                          // опц. доп. материалы
```

### Шпаргалка (`cheatsheets.json → sheets[subject][]`)
```jsonc
{ "id": "ads-complexity", "emoji": "📈", "title": "…", "content_md": "markdown с таблицами…" }
```

## Рендер вопроса (`quiz.js`)

Тело вопроса строит `buildQuestionBody(q)`:
1. Если есть `q.code` — проза + блок `.code-block`.
2. Иначе `parseTable(text)` ловит таблицы вида «**Названия столбцов:** A, B… **Ниже строки** …: r1c1, …; r2…»
   и рисует `.q-table` (хвост вопроса с запятыми/`;` сохраняется).
3. Остаток гонится через `textOrCodeHtml`: `CODE_START_RE` находит SQL/C++ и переносит операторы по `;`
   (но **не** внутри скобок — `for(;;)` цел), рендерит `.code-block` (моноширинный, `white-space:pre-wrap`).

## Режимы теста (`?mode=`)
`blitz` (обучение, разбор сразу), `full` (формат КТ, таймер, разбор в конце), `topic` (по теме), `block`
(фикс. вопросы блока), `mistakes` (**работа над ошибками** — вопросы из журнала ошибок).
Навигатор по номерам показывается при `n>1`. Горячие клавиши: `1–9`/`A–H` — выбрать вариант,
`←/→` — пред/след, `Enter` — далее/завершить.

## Перемешивание вариантов (`shuffleQuestion`)
- Применяется в обучающих режимах (blitz/topic/block/mistakes), **не** в `full` (реализм КТ).
- Перемешивает **объекты** вариантов и переназначает буквы A,B,…; ключ ремапится по исходной букве
  (биекция → ключ всегда корректен).
- Разбор тоже ремапится (буквы после «верно/вариант/ответ…», в `(X)`, «X»). **Защитный гейт:** если в разборе
  остаётся неучтённая одиночная латинская A–H (напр. «язык C», «C++ цел т.к. C++»), вопрос **не** перемешивается
  (остаётся исходный порядок). Валидатор проверяет биекцию ключа.

## Прогресс (`progress.js`, localStorage, ключи `kt_<subject>:…`)
- Чтение блоков, `bestTopicQuizPct`, `fullTestBest`.
- **Журнал ошибок**: `getMistakes/addMistakes/removeMistake` — id вопросов, отвеченных не на максимум;
  при верном ответе позже id убирается. Используется режимом `mistakes`.
- **История результатов**: `recordResult(subject,mode,pct01)` → массив `{date,pct,mode}` (ограничен),
  `getHistory(subject)`. Показывается на домашних страницах (мини-график) и формирует разбор по темам в конце теста.
- `computeTopicPercent` = 30% за чтение блоков + 70% за лучший квиз темы.

## Конец теста
После полного/любого теста: счёт, **разбор по темам с ошибками** (ссылки на `topic.html?id=`),
запись в журнал ошибок и историю.

## КРИТИЧЕСКИЕ правила (не нарушать)
1. **Любое изменение статики (HTML/CSS/JS/иконки/новая страница) → поднять `VERSION` в `service-worker.js`**
   (`kt-ads-vN` → `vN+1`) и при новой странице добавить её в `STATIC_ASSETS`. Иначе у пользователей старый кеш.
2. `correct_answers` — **только буквы**, и все должны существовать среди `options[].letter`.
3. КТ-лимит: верных вариантов **не более трёх**. `single` → ровно 1 верный.
4. Только относительные пути (`./…`).
5. Данные из OCR — встречаются битые символы (степени `²` → `?`), спорные ключи, дубли вариантов.
   Сомнительные ответы сверять с первоисточником (Лафоре; Дейт по БД), не доверять банку слепо.
6. Перед оверрайтом JSON — сохранять отступ (везде `indent=2`, `ensure_ascii=False`).

## Git
- Коммит в `main`, обычный `push` (без force; владелец работает прямо в main).
- В конце сообщения коммита: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
