// topics.js — рендер списка тем (topics.html) и страницы темы (topic.html).
// Предмет (subject) берётся из ?subject=ads|db.

import { loadTopicsWithCounts, getTopic, getQuestionsByTopic, normalizeSubject, SUBJECTS } from './data-loader.js';
import {
  computeTopicPercent,
  getTopicProgress,
  markBlockRead,
  isBlockRead,
} from './progress.js';
import { esc, el, renderMarkdown, qs, showError } from './app.js';

const SUFFIX = (subject) => (subject === 'ads' ? '' : `&subject=${subject}`);

/* ---------- Список тем (topics.html) ---------- */
export async function renderTopicList(container) {
  const subject = normalizeSubject(qs('subject', 'ads'));
  // кнопка «назад» ведёт на домашнюю страницу предмета
  const backEl = document.querySelector('.topbar .back');
  if (backEl) backEl.href = './' + SUBJECTS[subject].home;

  try {
    const topics = await loadTopicsWithCounts(subject);
    container.innerHTML = '';
    for (const t of topics) {
      const total = (t.blocks || []).length;
      const pct = computeTopicPercent(t.topic_id, total, subject);
      const prog = getTopicProgress(t.topic_id, subject);
      const readCount = Math.min(prog.blocksRead.length, total);
      const bestPct = Math.round(prog.bestTopicQuizPct * 100);

      const card = el('a', { class: 'card topic-card', href: `./topic.html?id=${t.topic_id}${SUFFIX(subject)}` });
      card.innerHTML = `
        <div class="row">
          <span class="tnum">Тема ${t.topic_id}</span>
          <span class="ttitle">${esc(t.title)}</span>
        </div>
        <div class="progress-label" style="margin-top:12px">
          <span>Прогресс темы</span><span>${pct}%</span>
        </div>
        <div class="progress"><span style="width:${pct}%"></span></div>
        <div class="meta">
          <span>📖 ${readCount}/${total} блоков прочитано</span>
          <span>🎯 лучший квиз: ${bestPct}%</span>
          <span>❓ вопросов: ${t.questionCount}</span>
        </div>`;
      container.appendChild(card);
    }
  } catch (e) {
    showError(container, e.message || 'Ошибка загрузки тем');
  }
}

/* ---------- Страница темы (topic.html?id=N) ---------- */
export async function renderTopicPage(container, titleEl) {
  const subject = normalizeSubject(qs('subject', 'ads'));
  const id = Number(qs('id'));
  // кнопка «назад» ведёт к списку тем этого предмета
  const backEl = document.querySelector('.topbar .back');
  if (backEl) backEl.href = `./topics.html${subject === 'ads' ? '' : `?subject=${subject}`}`;

  if (!id) {
    showError(container, 'Не указан id темы');
    return;
  }
  try {
    const [topic, questions] = await Promise.all([getTopic(id, subject), getQuestionsByTopic(id, subject)]);
    if (!topic) {
      showError(container, 'Тема не найдена');
      return;
    }
    if (titleEl) titleEl.textContent = `Тема ${id}`;

    const blocks = topic.blocks || [];
    const qCount = questions.length;
    const has30 = qCount >= 30;

    container.innerHTML = '';

    // Заголовок
    const head = el('div', {});
    head.innerHTML = `
      <span class="badge">Тема ${topic.topic_id}</span>
      <h1 style="margin-top:10px">${esc(topic.title)}</h1>
      <p class="subtitle">${blocks.length} блоков конспекта · ${qCount} вопросов в банке</p>`;
    container.appendChild(head);

    // Sticky CTA — квиз по теме
    if (qCount > 0) {
      const cta = el('div', { class: 'sticky-cta' });
      cta.innerHTML = `
        <div class="btn-row">
          <a class="btn btn-primary" href="./quiz.html?mode=topic&topic=${id}&count=15${SUFFIX(subject)}">🎯 Квиз по теме (15)</a>
          ${has30 ? `<a class="btn" href="./quiz.html?mode=topic&topic=${id}&count=30${SUFFIX(subject)}">Расширенный (30)</a>` : ''}
        </div>`;
      container.appendChild(cta);
    }

    // Плашка «конспект в разработке»
    if (topic.needs_notes || blocks.length === 0) {
      const notice = el('div', { class: 'notice' });
      notice.textContent = 'Конспект по этой теме в разработке.';
      container.appendChild(notice);
    }

    // Блоки конспекта
    for (const b of blocks) {
      const blockEl = el('section', { class: 'block', id: `block-${b.block_id}`, dataset: { blockId: b.block_id } });
      if (isBlockRead(id, b.block_id, subject)) blockEl.classList.add('read');

      const cleanTitle = b.title.replace(/^\d+\.\s*[^—]*—\s*/, '').trim() || b.title;
      let linksHtml = '';
      if (Array.isArray(b.links) && b.links.length) {
        linksHtml =
          '<p class="muted" style="margin-top:10px">Доп. материалы: ' +
          b.links
            .map((l) => {
              const url = typeof l === 'string' ? l : l.url;
              const text = typeof l === 'string' ? l : l.title || l.url;
              return `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>`;
            })
            .join(', ') +
          '</p>';
      }

      // есть ли фиксированные вопросы блока?
      const blockQs = questions.filter((q) => q.block_id === b.block_id);
      const blockTestBtn = blockQs.length
        ? `<a class="btn" href="./quiz.html?mode=block&block=${encodeURIComponent(b.block_id)}&topic=${id}${SUFFIX(subject)}">📝 Тест по блоку (${Math.min(blockQs.length, 10)})</a>`
        : '';

      blockEl.innerHTML = `
        <div class="block-head">
          <h2>${esc(cleanTitle)}</h2>
          <span class="read-flag">✓ прочитано</span>
        </div>
        <div class="md">${renderMarkdown(b.content_md)}</div>
        ${linksHtml}
        <div class="block-actions">
          <button class="btn btn-ghost mark-read" type="button">Отметить прочитанным</button>
          ${blockTestBtn}
        </div>
        <div class="read-sentinel" style="height:1px"></div>`;
      container.appendChild(blockEl);

      // кнопка «отметить прочитанным»
      blockEl.querySelector('.mark-read').addEventListener('click', () => {
        markBlockRead(id, b.block_id, subject);
        blockEl.classList.add('read');
      });
    }

    // IntersectionObserver — автоотметка «прочитано» при докрутке до конца блока
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const block = entry.target.closest('.block');
              if (block) {
                markBlockRead(id, block.dataset.blockId, subject);
                block.classList.add('read');
              }
              io.unobserve(entry.target);
            }
          }
        },
        { rootMargin: '0px 0px -10% 0px', threshold: 0 }
      );
      container.querySelectorAll('.read-sentinel').forEach((s) => io.observe(s));
    }
  } catch (e) {
    showError(container, e.message || 'Ошибка загрузки темы');
  }
}
