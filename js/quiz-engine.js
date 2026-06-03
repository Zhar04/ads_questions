// quiz-engine.js — стратифицированная рандомизация, скоринг, таймер.

/** Полный тест: длительность таймера в минутах (настраиваемая константа). */
export const FULL_TEST_MINUTES = 50;

/** Перемешивание Фишера–Йетса (на копии массива). */
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Стратифицированный набор вопросов: равномерно по темам (round-robin).
 *  - группируем по topic_id;
 *  - перемешиваем внутри каждой темы;
 *  - набираем по кругу, пока не наберём count;
 *  - итог ещё раз перемешиваем по порядку показа.
 * Вопросы с has_figure пропускаются в авто-наборе, КРОМЕ тех, у кого есть картинка (поле image).
 */
export function stratifiedSample(questions, count) {
  const usable = questions.filter((q) => (!q.has_figure || q.image) && hasValidAnswer(q));
  const groups = new Map();
  for (const q of usable) {
    const t = Number(q.topic_id);
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t).push(q);
  }
  const buckets = [...groups.values()].map((g) => shuffle(g));
  // round-robin
  const picked = [];
  let exhausted = false;
  while (picked.length < count && !exhausted) {
    exhausted = true;
    for (const b of buckets) {
      if (b.length) {
        picked.push(b.pop());
        exhausted = false;
        if (picked.length >= count) break;
      }
    }
  }
  return shuffle(picked).slice(0, count);
}

/** Случайные вопросы одной темы (для mode=topic). */
export function topicSample(questions, topicId, count) {
  const pool = questions.filter(
    (q) => Number(q.topic_id) === Number(topicId) && hasValidAnswer(q)
  );
  return shuffle(pool).slice(0, count);
}

/** Фиксированный (не случайный) набор вопросов блока (mode=block). */
export function blockSet(questions, blockId, max = 10) {
  return questions
    .filter((q) => q.block_id === blockId && hasValidAnswer(q))
    .slice(0, max);
}

function hasValidAnswer(q) {
  return Array.isArray(q.correct_answers) && q.correct_answers.length > 0;
}

/** Правильно ли отвечено: сравнение множеств выбранных и верных букв. */
export function isCorrect(question, selectedLetters) {
  const correct = new Set(question.correct_answers || []);
  const sel = new Set(selectedLetters || []);
  if (correct.size !== sel.size) return false;
  for (const c of correct) if (!sel.has(c)) return false;
  return true;
}

/** Число ошибок: (недобранные верные) + (выбранные лишние неверные). */
export function countMistakes(question, selectedLetters) {
  const correct = new Set(question.correct_answers || []);
  const sel = new Set(selectedLetters || []);
  let missing = 0;
  for (const c of correct) if (!sel.has(c)) missing++;
  let extra = 0;
  for (const s of sel) if (!correct.has(s)) extra++;
  return missing + extra;
}

/**
 * Баллы за вопрос с множественным выбором (правила КТ, 2-й профильный предмет):
 *   0 ошибок → 2 балла, 1 ошибка → 1 балл, ≥2 ошибок → 0 баллов.
 */
export function questionPoints(question, selectedLetters, maxPoints = 2) {
  const m = countMistakes(question, selectedLetters);
  return Math.max(0, maxPoints - m);
}

/**
 * Подсчёт результата.
 * @param {Array} questions
 * @param {Object} answers — { [questionId]: ['B', ...] }
 * @param {Object} [opts] — { partial: bool } — частичное начисление баллов (2/1/0) для БД.
 * @returns { correct, total, pct01, points, maxPoints, details: [{question, selected, correct, points, status}] }
 */
export function scoreQuiz(questions, answers, opts = {}) {
  const partial = !!opts.partial;
  const MAX = 2;
  let correct = 0;
  let points = 0;
  const details = questions.map((q) => {
    const sel = answers[q.id] || [];
    const ok = sel.length > 0 && isCorrect(q, sel);
    if (ok) correct++;
    let pts = ok ? MAX : 0;
    if (partial) {
      pts = questionPoints(q, sel, MAX);
      points += pts;
    }
    const status = pts === MAX ? 'full' : pts > 0 ? 'partial' : 'zero';
    return { question: q, selected: sel, correct: ok, points: pts, status };
  });
  const total = questions.length;
  const maxPoints = total * MAX;
  const pct01 = partial
    ? (maxPoints ? points / maxPoints : 0)
    : (total ? correct / total : 0);
  return { correct, total, pct01, points, maxPoints, details };
}

/** Простой таймер обратного отсчёта. onTick(secondsLeft), onEnd(). */
export function createTimer(totalSeconds, onTick, onEnd) {
  let left = totalSeconds;
  let id = null;
  function tick() {
    onTick(left);
    if (left <= 0) {
      stop();
      onEnd();
      return;
    }
    left--;
  }
  function start() {
    tick();
    id = setInterval(tick, 1000);
  }
  function stop() {
    if (id) clearInterval(id);
    id = null;
  }
  return { start, stop, remaining: () => left };
}

/** Формат MM:SS. */
export function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
