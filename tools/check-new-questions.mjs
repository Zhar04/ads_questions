// check-new-questions.mjs — проверка найденных вопросов на дубликаты в банке АиСД.
//   Кидай находки в inbox/*.txt|*.md (один вопрос = абзац, разделитель — пустая строка),
//   запусти: node tools/check-new-questions.mjs
// Использует ту же нечёткую логику поиска, что и сайт (searchQuestions из quiz-engine.js).

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { searchQuestions } from '../js/quiz-engine.js';

const bankUrl = new URL('../data/ads_question_bank.json', import.meta.url);
const inboxUrl = new URL('../inbox/', import.meta.url);
const bank = JSON.parse(readFileSync(bankUrl)).questions;

if (!existsSync(inboxUrl)) {
  console.log('Папки inbox/ нет.');
  process.exit(0);
}

const files = readdirSync(inboxUrl).filter(
  (f) => /\.(txt|md)$/i.test(f) && f.toLowerCase() !== 'readme.md'
);
if (!files.length) {
  console.log('В inbox/ нет файлов (.txt/.md) с вопросами. Брось туда находки и запусти снова.');
  process.exit(0);
}

let total = 0, dup = 0, maybe = 0, fresh = 0;

for (const file of files) {
  const text = readFileSync(new URL(file, inboxUrl), 'utf-8');
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter((b) => b.length >= 8);
  console.log(`\n================ ${file}  (${blocks.length} шт.) ================`);
  for (const block of blocks) {
    total++;
    const hits = searchQuestions(bank, block, 3);
    const topPct = hits[0] ? Math.round(hits[0].score * 100) : 0;
    let verdict;
    if (topPct >= 70) { verdict = '🔴 ВЕРОЯТНО ДУБЛИКАТ'; dup++; }
    else if (topPct >= 40) { verdict = '🟡 ПОХОЖЕ — проверь глазами'; maybe++; }
    else { verdict = '🟢 НОВЫЙ (похожих не нашёл)'; fresh++; }
    const oneLine = block.replace(/\s+/g, ' ');
    console.log(`\n— [${verdict}]  «${oneLine.slice(0, 110)}${oneLine.length > 110 ? '…' : ''}»`);
    for (const h of hits) {
      const q = h.question;
      const ql = (q.question || '').replace(/\s+/g, ' ').slice(0, 90);
      console.log(`     ${String(Math.round(h.score * 100)).padStart(3)}%  ${q.id}: ${ql}`);
    }
  }
}

console.log(`\n==== ИТОГ: всего ${total} · 🔴 дубликаты ${dup} · 🟡 похожие ${maybe} · 🟢 новые ${fresh} ====`);
console.log('🟢/🟡 — кандидаты на добавление. Подтверди — внесу их (ADS-201+) с верным ответом и нормальным разбором.');
