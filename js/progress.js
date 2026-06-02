// progress.js — прогресс пользователя в localStorage (раздельно по предметам).
//
// Ключи: kt_<subject>:...  (kt_ads: — АиСД, kt_db: — Базы данных).
//
// Формула прогресса темы (0..100):
//   до 30 баллов за чтение конспекта: (прочитано блоков / всего блоков) * 30
//   до 70 баллов за лучший результат квиза темы:    bestTopicQuizPct * 70
//   итого 100 только если все блоки прочитаны И квиз пройден на 100%.

const BASE = 'kt_';
const PREFIX = (subject = 'ads') => `${BASE}${subject}:`;
const TOPIC_KEY = (id, subject) => `${PREFIX(subject)}progress:topic:${id}`;
const FULL_BEST_KEY = (subject) => `${PREFIX(subject)}progress:fullTestBest`;

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
export function getTopicProgress(topicId, subject = 'ads') {
  const data = readJSON(TOPIC_KEY(topicId, subject), null);
  return {
    blocksRead: Array.isArray(data?.blocksRead) ? data.blocksRead : [],
    bestTopicQuizPct: typeof data?.bestTopicQuizPct === 'number' ? data.bestTopicQuizPct : 0,
  };
}

function setTopicProgress(topicId, patch, subject = 'ads') {
  const cur = getTopicProgress(topicId, subject);
  writeJSON(TOPIC_KEY(topicId, subject), { ...cur, ...patch });
}

/** Отметить блок прочитанным (идемпотентно). */
export function markBlockRead(topicId, blockId, subject = 'ads') {
  const cur = getTopicProgress(topicId, subject);
  if (!cur.blocksRead.includes(blockId)) {
    cur.blocksRead.push(blockId);
    setTopicProgress(topicId, { blocksRead: cur.blocksRead }, subject);
  }
}

export function isBlockRead(topicId, blockId, subject = 'ads') {
  return getTopicProgress(topicId, subject).blocksRead.includes(blockId);
}

/** Записать результат квиза темы (доля 0..1), сохраняется лучший. */
export function recordTopicQuiz(topicId, pct01, subject = 'ads') {
  const cur = getTopicProgress(topicId, subject);
  if (pct01 > cur.bestTopicQuizPct) {
    setTopicProgress(topicId, { bestTopicQuizPct: pct01 }, subject);
  }
}

/** Записать результат полного теста (доля 0..1), сохраняется лучший. */
export function recordFullTest(pct01, subject = 'ads') {
  const best = getFullTestBest(subject);
  if (pct01 > best) writeJSON(FULL_BEST_KEY(subject), pct01);
}

/** Лучший результат полного теста (доля 0..1). */
export function getFullTestBest(subject = 'ads') {
  const v = readJSON(FULL_BEST_KEY(subject), 0);
  return typeof v === 'number' ? v : 0;
}

/**
 * Прогресс темы 0..100.
 * @param {number} topicId
 * @param {number} totalBlocks — всего блоков конспекта в теме.
 * @param {string} subject
 */
export function computeTopicPercent(topicId, totalBlocks, subject = 'ads') {
  const { blocksRead, bestTopicQuizPct } = getTopicProgress(topicId, subject);
  const readCount = Math.min(blocksRead.length, totalBlocks || 0);
  const readPart = totalBlocks > 0 ? (readCount / totalBlocks) * 30 : 0;
  const quizPart = Math.max(0, Math.min(1, bestTopicQuizPct)) * 70;
  return Math.round(readPart + quizPart);
}

/** Средний процент по всем темам (для главного экрана). */
export function computeOverallPercent(topics, subject = 'ads') {
  if (!topics.length) return 0;
  const sum = topics.reduce(
    (acc, t) => acc + computeTopicPercent(t.topic_id, (t.blocks || []).length, subject),
    0
  );
  return Math.round(sum / topics.length);
}

/** Сколько тем «пройдено» (прогресс == 100). */
export function countCompletedTopics(topics, subject = 'ads') {
  return topics.filter(
    (t) => computeTopicPercent(t.topic_id, (t.blocks || []).length, subject) >= 100
  ).length;
}

/**
 * Полный сброс прогресса.
 * @param {string} [subject] — если задан, сбрасывает только этот предмет; иначе все.
 */
export function resetAllProgress(subject) {
  const target = subject ? PREFIX(subject) : BASE;
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(target)) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}
