// progress.js — прогресс пользователя в localStorage.
//
// Формула прогресса темы (0..100):
//   до 30 баллов за чтение конспекта: (прочитано блоков / всего блоков) * 30
//   до 70 баллов за лучший результат квиза темы:    bestTopicQuizPct * 70
//   итого 100 только если все блоки прочитаны И квиз пройден на 100%.

const PREFIX = 'kt_ads:';
const TOPIC_KEY = (id) => `${PREFIX}progress:topic:${id}`;
const FULL_BEST_KEY = `${PREFIX}progress:fullTestBest`;

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* приватный режим / переполнение — молча игнорируем */
  }
}

/** Возвращает { blocksRead: [], bestTopicQuizPct: 0 } для темы. */
export function getTopicProgress(topicId) {
  const data = readJSON(TOPIC_KEY(topicId), null);
  return {
    blocksRead: Array.isArray(data?.blocksRead) ? data.blocksRead : [],
    bestTopicQuizPct: typeof data?.bestTopicQuizPct === 'number' ? data.bestTopicQuizPct : 0,
  };
}

function setTopicProgress(topicId, patch) {
  const cur = getTopicProgress(topicId);
  writeJSON(TOPIC_KEY(topicId), { ...cur, ...patch });
}

/** Отметить блок прочитанным (идемпотентно). */
export function markBlockRead(topicId, blockId) {
  const cur = getTopicProgress(topicId);
  if (!cur.blocksRead.includes(blockId)) {
    cur.blocksRead.push(blockId);
    setTopicProgress(topicId, { blocksRead: cur.blocksRead });
  }
}

export function isBlockRead(topicId, blockId) {
  return getTopicProgress(topicId).blocksRead.includes(blockId);
}

/** Записать результат квиза темы (доля 0..1), сохраняется лучший. */
export function recordTopicQuiz(topicId, pct01) {
  const cur = getTopicProgress(topicId);
  if (pct01 > cur.bestTopicQuizPct) {
    setTopicProgress(topicId, { bestTopicQuizPct: pct01 });
  }
}

/** Записать результат полного теста (доля 0..1), сохраняется лучший. */
export function recordFullTest(pct01) {
  const best = getFullTestBest();
  if (pct01 > best) writeJSON(FULL_BEST_KEY, pct01);
}

/** Лучший результат полного теста (доля 0..1). */
export function getFullTestBest() {
  const v = readJSON(FULL_BEST_KEY, 0);
  return typeof v === 'number' ? v : 0;
}

/**
 * Прогресс темы 0..100.
 * @param {number} topicId
 * @param {number} totalBlocks — всего блоков конспекта в теме.
 */
export function computeTopicPercent(topicId, totalBlocks) {
  const { blocksRead, bestTopicQuizPct } = getTopicProgress(topicId);
  const readCount = Math.min(blocksRead.length, totalBlocks || 0);
  const readPart = totalBlocks > 0 ? (readCount / totalBlocks) * 30 : 0;
  const quizPart = Math.max(0, Math.min(1, bestTopicQuizPct)) * 70;
  return Math.round(readPart + quizPart);
}

/** Средний процент по всем темам (для главного экрана). */
export function computeOverallPercent(topics) {
  if (!topics.length) return 0;
  const sum = topics.reduce(
    (acc, t) => acc + computeTopicPercent(t.topic_id, (t.blocks || []).length),
    0
  );
  return Math.round(sum / topics.length);
}

/** Сколько тем «пройдено» (прогресс == 100). */
export function countCompletedTopics(topics) {
  return topics.filter(
    (t) => computeTopicPercent(t.topic_id, (t.blocks || []).length) >= 100
  ).length;
}

/** Полный сброс прогресса. */
export function resetAllProgress() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}
