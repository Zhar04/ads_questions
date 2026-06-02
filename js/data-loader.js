// data-loader.js — загрузка банка вопросов и конспекта из data/ с кешем в памяти.
// Только относительные пути (для GitHub Pages в подпапке).

const CACHE = { questions: null, topics: null };

const PATHS = {
  questions: './data/ads_question_bank.json',
  topics: './data/topics.json',
};

async function fetchJSON(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Не удалось загрузить ${url} (HTTP ${res.status})`);
  return res.json();
}

/** Возвращает массив всех вопросов (с кешем). */
export async function loadQuestions() {
  if (CACHE.questions) return CACHE.questions;
  const data = await fetchJSON(PATHS.questions);
  const list = Array.isArray(data) ? data : data.questions || [];
  CACHE.questions = list;
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
