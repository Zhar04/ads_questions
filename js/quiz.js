// quiz.js — контроллер страницы теста (quiz.html). Режимы: blitz | full | topic | block.
// Поддержка двух предметов: ads (одиночный выбор) и db (множественный выбор, баллы 2/1/0).

import { loadQuestions, normalizeLang, normalizeSubject, SUBJECTS } from './data-loader.js';
import { recordTopicQuiz, recordFullTest } from './progress.js';
import { esc, qs, el, showError } from './app.js';
import {
  stratifiedSample,
  topicSample,
  blockSet,
  scoreQuiz,
  createTimer,
  fmtTime,
  FULL_TEST_MINUTES,
} from './quiz-engine.js';

const MODE_TITLES = {
  blitz: 'Блиц-тест',
  full: 'Полный тест (формат КТ)',
  topic: 'Квиз по теме',
  block: 'Тест по блоку',
};

const state = {
  mode: 'blitz',
  subject: 'ads',
  multi: false,       // множественный выбор (предмет db)
  questions: [],
  index: 0,
  answers: {},        // { qid: ['B', ...] }
  revealed: {},       // { qid: true } — показан ли ответ на этом вопросе
  topicId: null,
  lang: 'ru',
  finished: false,
  timer: null,
};

let root, titleEl;

export async function initQuiz(container, titlebar) {
  root = container;
  titleEl = titlebar;
  const mode = qs('mode', 'blitz');
  const count = parseInt(qs('count', '15'), 10) || 15;
  const topicId = qs('topic') ? Number(qs('topic')) : null;
  const blockId = qs('block');
  const subject = normalizeSubject(qs('subject', 'ads'));
  // Язык банка вопросов поддерживается в блице и полном тесте; темы/блоки — только рус.
  const lang = (mode === 'blitz' || mode === 'full') ? normalizeLang(qs('lang', 'ru'), subject) : 'ru';
  state.mode = mode;
  state.subject = subject;
  state.multi = !!SUBJECTS[subject].multiAnswer;
  state.topicId = topicId;
  state.lang = lang;

  // Навигация: кнопка «назад» ведёт на домашнюю страницу предмета.
  const backEl = document.querySelector('.topbar .back');
  if (backEl) backEl.href = './' + SUBJECTS[subject].home;

  if (titleEl) {
    const langTag = lang === 'kk' ? ' · Қаз' : '';
    titleEl.textContent = (MODE_TITLES[mode] || 'Тест') + langTag;
  }

  try {
    const all = await loadQuestions(subject, lang);
    let selected = [];
    if (mode === 'full') selected = stratifiedSample(all, count || 30);
    else if (mode === 'blitz') selected = stratifiedSample(all, count || 15);
    else if (mode === 'topic') selected = topicSample(all, topicId, count || 15);
    else if (mode === 'block') selected = blockSet(all, blockId, 10);

    if (!selected.length) {
      showError(root, 'Для выбранного режима не нашлось вопросов.');
      return;
    }
    state.questions = selected;
    state.index = 0;

    if (mode === 'full') startTimer();
    renderQuestion();
  } catch (e) {
    showError(root, e.message || 'Ошибка загрузки вопросов');
  }
}

/* ---------- Таймер (только full) ---------- */
let timerEl = null;
function startTimer() {
  state.timer = createTimer(
    FULL_TEST_MINUTES * 60,
    (left) => {
      if (!timerEl) return;
      timerEl.textContent = '⏱ ' + fmtTime(left);
      timerEl.classList.toggle('warn', left <= 300 && left > 60);
      timerEl.classList.toggle('danger', left <= 60);
    },
    () => finishQuiz(true)
  );
  state.timer.start();
}

/* ---------- Форматирование встроенного кода в тексте вопроса ---------- */
// Сильные признаки начала кода (SQL / C++) внутри текста вопроса.
const CODE_START_RE = /(create\s+table|insert\s+into|delete\s+from|alter\s+table|drop\s+table|update\s+\w+\s+set|select\s+[\w*(]|#\s*include|using\s+namespace|cout\s*<<|cin\s*>>|printf\s*\(|scanf\s*\(|for\s*\(|while\s*\(|(?:unsigned\s+|signed\s+|long\s+|short\s+)*int\s+\w+\s*[=;[]|double\s+\w+\s*=|float\s+\w+\s*=|char\s+\w+\s*[=[])/i;

/**
 * Перенос каждого оператора на отдельную строку (после ';'), но только на
 * верхнем уровне — ';' внутри скобок (например, заголовок for(;;)) не разрываем.
 */
function formatCode(code) {
  let out = '';
  let depth = 0;
  for (const ch of code) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    out += ch;
    if (ch === ';' && depth === 0) out += '\n';
  }
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/\n{2,}/g, '\n').trim();
}

/** HTML для куска текста: проза в .q-text + (если найден код) блок .code-block. */
function textOrCodeHtml(text) {
  text = (text || '').trim();
  if (!text) return '';
  const m = text.match(CODE_START_RE);
  if (!m) return `<div class="q-text">${esc(text)}</div>`;
  const lead = text.slice(0, m.index).trim();
  const code = formatCode(text.slice(m.index).trim());
  return (lead ? `<div class="q-text">${esc(lead)}</div>` : '') + `<div class="code-block">${esc(code)}</div>`;
}

/**
 * Распознаёт вопросы-таблицы вида «… Названия столбцов: A, B, C. Ниже строки
 * этой таблицы …: r1c1, r1c2, …; r2c1, …; … . <вопрос>».
 * Возвращает { before, columns, rows, after } либо null.
 */
function parseTable(text) {
  const m = text.match(/Названия столбцов:\s*([^.]+?)\.\s*Ниже строки[^:]*:\s*([\s\S]+)/i);
  if (!m) return null;
  const columns = m[1].split(',').map((s) => s.trim()).filter(Boolean);
  if (columns.length < 2) return null;
  const n = columns.length;
  const before = text.slice(0, m.index).trim();
  const segs = m[2].trim().split(';');
  const rows = [];
  let after = '';
  for (let i = 0; i < segs.length; i++) {
    const cells = segs[i].split(',').map((s) => s.trim());
    if (cells.length < n) {
      after = segs.slice(i).join(';');
      break;
    }
    const row = cells.slice(0, n);
    const tailParts = [];
    // В последней ячейке строки может «прилипнуть» начало вопроса: «2. Выберите…».
    const split = row[n - 1].split(/\.\s+/);
    if (split.length > 1) {
      row[n - 1] = split[0];
      tailParts.push(split.slice(1).join('. '));
    }
    // Лишние ячейки сверх n — продолжение вопроса, разрезанное запятыми.
    if (cells.length > n) tailParts.push(cells.slice(n).join(', '));
    rows.push(row);
    if (tailParts.length) {
      after = tailParts.join(', ') + (i + 1 < segs.length ? ';' + segs.slice(i + 1).join(';') : '');
      break;
    }
  }
  if (!rows.length) return null;
  return { before, columns, rows, after: after.trim() };
}

/** HTML таблицы вопроса. */
function tableHtml(columns, rows) {
  const thead = '<thead><tr>' + columns.map((c) => `<th>${esc(c)}</th>`).join('') + '</tr></thead>';
  const tbody =
    '<tbody>' +
    rows.map((r) => '<tr>' + r.map((c) => `<td>${esc(c)}</td>`).join('') + '</tr>').join('') +
    '</tbody>';
  return `<div class="q-table-wrap"><table class="q-table">${thead}${tbody}</table></div>`;
}

/** Полный HTML тела вопроса: проза + таблица + блок кода (в нужном порядке). */
function buildQuestionBody(q) {
  // Явное поле code (исторический формат банка) имеет приоритет.
  if (q.code) {
    const lead = q.question ? `<div class="q-text">${esc(q.question)}</div>` : '';
    return lead + `<div class="code-block">${esc(q.code)}</div>`;
  }
  const parts = [];
  let text = q.question || '';
  const tbl = parseTable(text);
  if (tbl) {
    if (tbl.before) parts.push(textOrCodeHtml(tbl.before));
    parts.push(tableHtml(tbl.columns, tbl.rows));
    text = tbl.after || '';
  }
  if (text) parts.push(textOrCodeHtml(text));
  return parts.join('');
}

/* ---------- Рендер одного вопроса ---------- */
function renderQuestion() {
  const q = state.questions[state.index];
  const n = state.questions.length;
  const k = state.index + 1;
  const pct = Math.round((k / n) * 100);
  // в blitz/block открываем разбор; в full — скрыто (формат КТ)
  const isBlitz = state.mode === 'blitz' || state.mode === 'block';
  const isMulti = state.multi;
  const revealed = !!state.revealed[q.id];
  const selected = state.answers[q.id] || [];

  root.innerHTML = '';

  const head = el('div', { class: 'quiz-head' });
  head.innerHTML = `<div class="muted">Вопрос ${k} из ${n}</div>
    ${state.mode === 'full' ? '<div class="timer" id="timer">⏱ --:--</div>' : `<div class="muted">${MODE_TITLES[state.mode] || ''}</div>`}`;
  root.appendChild(head);
  timerEl = document.getElementById('timer');
  if (state.mode === 'full' && state.timer && timerEl) {
    timerEl.textContent = '⏱ ' + fmtTime(state.timer.remaining());
  }

  const prog = el('div', { class: 'progress' }, `<span style="width:${pct}%"></span>`);
  root.appendChild(prog);

  // Навигатор по вопросам — переход на любой вопрос по номеру.
  if (n > 1) {
    const grid = el('div', { class: 'qnav-grid' });
    for (let qi = 0; qi < n; qi++) {
      const qq = state.questions[qi];
      const answered = (state.answers[qq.id] || []).length > 0;
      let cls = 'qnav-cell';
      if (qi === state.index) cls += ' current';
      else if (answered) cls += ' answered';
      const cell = el('button', { class: cls, type: 'button' }, String(qi + 1));
      cell.addEventListener('click', () => {
        state.index = qi;
        renderQuestion();
      });
      grid.appendChild(cell);
    }
    root.appendChild(grid);
  }

  const card = el('div', { class: 'card', style: 'margin-top:16px' });

  // Иллюстрация: если есть image — показываем картинку; иначе (если помечен рисунок) — предупреждение.
  const figHtml = q.image
    ? `<figure class="q-figure"><img src="./${esc(q.image)}" alt="Иллюстрация к вопросу" loading="lazy" /></figure>`
    : q.has_figure
      ? '<div class="q-fig-note">⚠️ Вопрос относится к рисунку, которого нет в банке — оценивайте по тексту.</div>'
      : '';

  const bodyHtml = buildQuestionBody(q);

  const multiHint = isMulti
    ? '<div class="q-multi-hint">Множественный выбор: отметьте все верные варианты (1–3). Баллы: 2 / 1 / 0.</div>'
    : '';

  card.innerHTML = `${bodyHtml}${figHtml}${multiHint}<div class="options"></div>`;
  const optsEl = card.querySelector('.options');

  const correct = new Set(q.correct_answers || []);
  for (const opt of q.options) {
    const btn = el('button', { class: 'option', type: 'button' });
    btn.innerHTML = `<span class="letter">${esc(opt.letter)}</span><span class="otext">${esc(opt.text)}</span>`;
    const isSel = selected.includes(opt.letter);
    if (isSel) btn.classList.add('selected');

    if (revealed) {
      btn.disabled = true;
      if (correct.has(opt.letter)) btn.classList.add('correct');
      else if (isSel) btn.classList.add('wrong');
    } else {
      btn.addEventListener('click', () => {
        if (isMulti) {
          // переключаем выбор варианта
          const cur = state.answers[q.id] || [];
          state.answers[q.id] = cur.includes(opt.letter)
            ? cur.filter((l) => l !== opt.letter)
            : [...cur, opt.letter];
        } else {
          state.answers[q.id] = [opt.letter]; // одиночный выбор
          if (isBlitz) state.revealed[q.id] = true; // обучающий режим: сразу показать
        }
        renderQuestion();
      });
    }
    optsEl.appendChild(btn);
  }

  // блок объяснения
  if (revealed) {
    const exp = el('div', { class: 'explain' });
    const correctLetters = (q.correct_answers || []).join(', ');
    exp.innerHTML = `<span class="lbl">Разбор · верный ответ: ${esc(correctLetters)}</span>${esc(q.explanation || '')}`;
    card.appendChild(exp);
  }

  root.appendChild(card);

  // кнопка «Показать ответ» (для множественного выбора — после отметки вариантов)
  if (!revealed) {
    const showBtn = el('button', { class: 'btn btn-ghost btn-block', type: 'button', style: 'margin-top:12px' }, '👁 Показать ответ');
    showBtn.addEventListener('click', () => {
      state.revealed[q.id] = true;
      renderQuestion();
    });
    root.appendChild(showBtn);
  }

  // навигация
  const nav = el('div', { class: 'quiz-nav' });
  const prevBtn = el('button', { class: 'btn', type: 'button' }, '← Назад');
  prevBtn.disabled = state.index === 0;
  prevBtn.addEventListener('click', () => {
    if (state.index > 0) { state.index--; renderQuestion(); }
  });

  const isLast = state.index === n - 1;
  const nextBtn = el('button', { class: 'btn btn-primary', type: 'button' }, isLast ? 'Завершить ✓' : 'Далее →');
  nextBtn.addEventListener('click', () => {
    if (isLast) finishQuiz(false);
    else { state.index++; renderQuestion(); }
  });

  nav.appendChild(prevBtn);
  nav.appendChild(nextBtn);
  root.appendChild(nav);
}

/* ---------- Экран результата ---------- */
function finishQuiz(byTimeout) {
  if (state.finished) return;
  state.finished = true;
  if (state.timer) state.timer.stop();

  const partial = state.multi;
  const result = scoreQuiz(state.questions, state.answers, { partial });
  const pct = Math.round(result.pct01 * 100);

  // сохранение прогресса
  if (state.mode === 'topic' && state.topicId) recordTopicQuiz(state.topicId, result.pct01, state.subject);
  if (state.mode === 'full') recordFullTest(result.pct01, state.subject);

  if (titleEl) titleEl.textContent = 'Результат';
  root.innerHTML = '';

  const home = './' + SUBJECTS[state.subject].home;
  const subLine = partial
    ? `${result.points} из ${result.maxPoints} баллов · полностью верно: ${result.correct} из ${result.total}`
    : `${result.correct} из ${result.total} верно`;

  const summary = el('div', { class: 'card center' });
  summary.innerHTML = `
    ${byTimeout ? '<div class="notice">⏱ Время вышло — тест завершён автоматически.</div>' : ''}
    <div class="result-score">${pct}%</div>
    <div class="result-sub">${subLine}</div>
    <div class="btn-row" style="justify-content:center">
      <button class="btn btn-primary" type="button" id="retry">Пройти заново</button>
      <a class="btn" href="${home}">На главную</a>
    </div>`;
  root.appendChild(summary);

  const protocolTitle = state.mode === 'full' ? 'Протокол ответов' : 'Разбор вопросов';
  root.appendChild(el('h2', {}, protocolTitle));

  result.details.forEach((d, idx) => {
    const q = d.question;
    const cls = d.status === 'full' ? 'ok' : d.status === 'partial' ? 'partial' : 'no';
    const item = el('div', { class: `review-item ${cls}` });
    const selLetters = (d.selected || []).join(', ') || '—';
    const correctLetters = (q.correct_answers || []).join(', ');
    let tag;
    if (partial) {
      const word = d.points === 2 ? 'ok' : d.points === 1 ? 'partial' : 'no';
      tag = `<span class="ri-tag ${word}">${d.points} балл${d.points === 1 ? '' : d.points === 0 ? 'ов' : 'а'}</span>`;
    } else {
      tag = d.correct ? '<span class="ri-tag ok">верно</span>' : '<span class="ri-tag no">неверно</span>';
    }
    const bodyHtml = buildQuestionBody(q);
    const figHtml = q.image ? `<figure class="q-figure"><img src="./${esc(q.image)}" alt="Иллюстрация к вопросу" loading="lazy" /></figure>` : '';
    item.innerHTML = `
      <div class="ri-q">${idx + 1}. ${tag}</div>
      ${bodyHtml}
      ${figHtml}
      <div class="ri-ans">Ваш ответ: <strong>${esc(selLetters)}</strong></div>
      <div class="ri-ans">Верный ответ: <strong>${esc(correctLetters)}</strong></div>
      <div class="explain"><span class="lbl">Разбор</span>${esc(q.explanation || '')}</div>`;
    root.appendChild(item);
  });

  document.getElementById('retry').addEventListener('click', () => location.reload());
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
