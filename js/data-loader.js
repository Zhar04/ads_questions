// data-loader.js — загрузка банка вопросов и конспекта из data/ с кешем в памяти.
// Только относительные пути (для GitHub Pages в подпапке).
//
// Два предмета (subject):
//   ads — Алгоритмы и структуры данных (ru + kk),
//   db  — Базы данных (ru).

const CACHE = { questions: {}, topics: {} };

/** Банки вопросов: subject -> { lang -> path }. */
const QUESTION_PATHS = {
  ads: {
    ru: './data/ads_question_bank.json',
    kk: './data/ads_question_kz_bank.json',
  },
  db: {
    ru: './data/db_questions_bank.json',
  },
};

/** Конспекты тем: subject -> path. */
const TOPIC_PATHS = {
  ads: './data/topics.json',
  db: './data/db_topics.json',
};

/** Поддерживаемые предметы и их подписи (для UI и навигации). */
export const SUBJECTS = {
  ads: { code: 'ads', label: 'Алгоритмы и структуры данных', short: 'АиСД', home: 'index.html', multiAnswer: false },
  db: { code: 'db', label: 'Базы данных', short: 'Базы данных', home: 'databases.html', multiAnswer: true },
};

/** Поддерживаемые языки и их подписи (для UI). */
export const LANGS = {
  ru: { code: 'ru', label: 'Рус' },
  kk: { code: 'kk', label: 'Қаз' },
};

/** Нормализует код предмета к поддерживаемому (по умолчанию ads). */
export function normalizeSubject(subject) {
  return QUESTION_PATHS[subject] ? subject : 'ads';
}

/** Нормализует код языка к поддерживаемому для предмета (по умолчанию ru). */
export function normalizeLang(lang, subject = 'ads') {
  const s = normalizeSubject(subject);
  return QUESTION_PATHS[s][lang] ? lang : 'ru';
}

async function fetchJSON(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Не удалось загрузить ${url} (HTTP ${res.status})`);
  return res.json();
}

/** Возвращает массив всех вопросов предмета/языка (с кешем). */
export async function loadQuestions(subject = 'ads', lang = 'ru') {
  const s = normalizeSubject(subject);
  const l = normalizeLang(lang, s);
  const key = `${s}:${l}`;
  if (CACHE.questions[key]) return CACHE.questions[key];
  const data = await fetchJSON(QUESTION_PATHS[s][l]);
  const list = Array.isArray(data) ? data : data.questions || [];
  CACHE.questions[key] = list;
  return list;
}

/** Возвращает объект { meta, topics } предмета (с кешем). */
export async function loadTopics(subject = 'ads') {
  const s = normalizeSubject(subject);
  if (CACHE.topics[s]) return CACHE.topics[s];
  const data = await fetchJSON(TOPIC_PATHS[s]);
  CACHE.topics[s] = data;
  return data;
}

/** Тема по её topic_id. */
export async function getTopic(topicId, subject = 'ads') {
  const { topics } = await loadTopics(subject);
  return topics.find((t) => Number(t.topic_id) === Number(topicId)) || null;
}

/** Все вопросы данной темы. */
export async function getQuestionsByTopic(topicId, subject = 'ads') {
  const qs = await loadQuestions(subject);
  return qs.filter((q) => Number(q.topic_id) === Number(topicId));
}

/** Вопросы, относящиеся к конкретному блоку конспекта (через поле block_id, если задано). */
export async function getQuestionsByBlock(blockId, subject = 'ads') {
  const qs = await loadQuestions(subject);
  return qs.filter((q) => q.block_id === blockId);
}

/** Список тем + число вопросов в каждой (для отрисовки). */
export async function loadTopicsWithCounts(subject = 'ads') {
  const [{ topics }, qs] = await Promise.all([loadTopics(subject), loadQuestions(subject)]);
  const counts = {};
  for (const q of qs) {
    const id = Number(q.topic_id);
    counts[id] = (counts[id] || 0) + 1;
  }
  return topics.map((t) => ({ ...t, questionCount: counts[Number(t.topic_id)] || 0 }));
}
