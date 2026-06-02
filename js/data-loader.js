// data-loader.js — загрузка банка вопросов и конспекта из data/ с кешем в памяти.
// Только относительные пути (для GitHub Pages в подпапке).

const CACHE = { questions: {}, topics: null };

/** Банки вопросов по языку. ru — основной, kk — казахский. */
const QUESTION_PATHS = {
  ru: './data/ads_question_bank.json',
  kk: './data/ads_question_kz_bank.json',
};

const PATHS = {
  topics: './data/topics.json',
};

/** Поддерживаемые языки и их подписи (для UI). */
export const LANGS = {
  ru: { code: 'ru', label: 'Рус' },
  kk: { code: 'kk', label: 'Қаз' },
};

/** Нормализует код языка к поддерживаемому (по умолчанию ru). */
export function normalizeLang(lang) {
  return QUESTION_PATHS[lang] ? lang : 'ru';
}

async function fetchJSON(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Не удалось загрузить ${url} (HTTP ${res.status})`);
  return res.json();
}

/** Возвращает массив всех вопросов выбранного языка (с кешем). */
export async function loadQuestions(lang = 'ru') {
  const key = normalizeLang(lang);
  if (CACHE.questions[key]) return CACHE.questions[key];
  const data = await fetchJSON(QUESTION_PATHS[key]);
  const list = Array.isArray(data) ? data : data.questions || [];
  CACHE.questions[key] = list;
  return list;
}

/** Возвращает объект { meta, topics } (с кешем). */
export async function loadTopics() {
  if (CACHE.topics) return CACHE.topics;
  const data = await fetchJSON(PATHS.topics);
  CACHE.topics = data;
  return data;
}

/** Тема по её topic_id. */
export async function getTopic(topicId) {
  const { topics } = await loadTopics();
  return topics.find((t) => Number(t.topic_id) === Number(topicId)) || null;
}

/** Все вопросы данной темы. */
export async function getQuestionsByTopic(topicId) {
  const qs = await loadQuestions();
  return qs.filter((q) => Number(q.topic_id) === Number(topicId));
}

/** Вопросы, относящиеся к конкретному блоку конспекта (через поле block_id, если задано). */
export async function getQuestionsByBlock(blockId) {
  const qs = await loadQuestions();
  return qs.filter((q) => q.block_id === blockId);
}

/** Список тем + число вопросов в каждой (для отрисовки). */
export async function loadTopicsWithCounts() {
  const [{ topics }, qs] = await Promise.all([loadTopics(), loadQuestions()]);
  const counts = {};
  for (const q of qs) {
    const id = Number(q.topic_id);
    counts[id] = (counts[id] || 0) + 1;
  }
  return topics.map((t) => ({ ...t, questionCount: counts[Number(t.topic_id)] || 0 }));
}
