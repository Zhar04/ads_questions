// validate-banks.mjs — офлайн-валидатор банков вопросов, конспектов и шпаргалок.
// Запуск:  node tools/validate-banks.mjs
// Выход 1 при наличии ошибок (для CI). Предупреждения не валят сборку.

import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, ROOT), 'utf8'));

let errors = 0;
let warns = 0;
const err = (m) => { console.error('  ✗ ' + m); errors++; };
const warn = (m) => { console.warn('  ! ' + m); warns++; };
globalThis.__err = err;
globalThis.__warn = warn;

// --- shuffle-биекция (повтор логики quiz-engine, без зависимости от браузерного модуля) ---
function shuffleOnce(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function bijectionOk(q) {
  const origCorrect = new Set(q.correct_answers || []);
  const arr = shuffleOnce(q.options.map((o) => ({ ...o })));
  const LET = 'ABCDEFGHIJ';
  const newCorrectTexts = new Set();
  arr.forEach((o, i) => { if (origCorrect.has(o.letter)) newCorrectTexts.add(o.text); });
  const origCorrectTexts = new Set((q.correct_answers || []).map((L) => q.options.find((o) => o.letter === L)?.text));
  if (origCorrectTexts.size !== newCorrectTexts.size) return false;
  for (const t of origCorrectTexts) if (!newCorrectTexts.has(t)) return false;
  return true;
}

function checkBank(path, { strict = true } = {}) {
  console.log(`\n# ${path}${strict ? '' : '  (известный «грязный» банк — проблемы как предупреждения)'}`);
  // В нестрогом режиме (kz-банк) ошибки понижаются до предупреждений, чтобы не валить CI.
  const err = strict ? globalThis.__err : globalThis.__warn;
  const data = read('./data/' + path);
  const qs = Array.isArray(data) ? data : data.questions || [];
  const ids = new Set();
  for (const q of qs) {
    const id = q.id || '(no id)';
    if (!q.id) err(`вопрос без id`);
    else if (ids.has(q.id)) err(`дубль id ${q.id}`);
    ids.add(q.id);

    if (!Array.isArray(q.options) || q.options.length < 2) { err(`${id}: <2 вариантов`); continue; }
    const letters = q.options.map((o) => o.letter);
    if (new Set(letters).size !== letters.length) err(`${id}: дубль букв вариантов`);
    for (const o of q.options) {
      if (!o.text || !String(o.text).trim()) err(`${id}: пустой текст варианта ${o.letter}`);
      if (/\b[nN]\?|[0-9]\?\)|\(n\?\)/.test(o.text || '')) warn(`${id}: подозрительный символ «?» в варианте ${o.letter}: ${o.text}`);
    }

    const ca = q.correct_answers || [];
    const hasFig = q.has_figure && !q.image;
    if (!Array.isArray(ca) || ca.length === 0) {
      if (!hasFig) err(`${id}: нет correct_answers`);
    } else {
      const set = new Set(letters);
      for (const c of ca) if (!set.has(c)) err(`${id}: верный ответ ${c} вне вариантов [${letters.join('')}]`);
      if (q.answer_type === 'single' && ca.length !== 1) err(`${id}: single, но verных ${ca.length}`);
      if (ca.length > 3) err(`${id}: больше 3 верных (лимит КТ) — ${ca.length}`);
      if (!bijectionOk(q)) err(`${id}: перемешивание ломает ключ (биекция нарушена)`);
    }

    if (q.topic_id == null) err(`${id}: нет topic_id`);
    if (!q.explanation || !String(q.explanation).trim()) warn(`${id}: пустой explanation`);
  }
  console.log(`  вопросов: ${qs.length}`);
}

function checkTopics(path) {
  console.log(`\n# ${path}`);
  const { topics } = read('./data/' + path);
  let blocks = 0, figs = 0;
  for (const t of topics || []) {
    if (t.topic_id == null) err(`${path}: тема без topic_id`);
    for (const b of t.blocks || []) {
      blocks++;
      if (!b.block_id) err(`${path}/тема ${t.topic_id}: блок без block_id`);
      for (const f of b.figures || []) {
        figs++;
        if (!/^images\//.test(f.src || '')) err(`${path}/${b.block_id}: figure.src не из images/: ${f.src}`);
      }
    }
  }
  console.log(`  тем: ${(topics || []).length}, блоков: ${blocks}, картинок: ${figs}`);
}

function checkCheats(path) {
  console.log(`\n# ${path}`);
  const { sheets } = read('./data/' + path);
  let n = 0;
  for (const subj of Object.keys(sheets || {})) {
    for (const s of sheets[subj]) {
      n++;
      if (!s.id) err(`${path}/${subj}: шпаргалка без id`);
      if (!s.title || !s.content_md) err(`${path}/${s.id}: нет title/content_md`);
    }
  }
  console.log(`  шпаргалок: ${n}`);
}

checkBank('ads_question_bank.json');
checkBank('db_questions_bank.json');
checkBank('ads_question_kz_bank.json', { strict: false }); // грязный OCR-банк, по запросу владельца не блокирует CI
checkTopics('topics.json');
checkTopics('db_topics.json');
checkCheats('cheatsheets.json');

console.log(`\n=== Итог: ошибок ${errors}, предупреждений ${warns} ===`);
process.exit(errors ? 1 : 0);
