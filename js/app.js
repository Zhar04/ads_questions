// app.js — общие утилиты, навигация, markdown-рендер, инициализация PWA.

/** Безопасное экранирование HTML. */
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Параметры строки запроса. */
export function qs(name, def = null) {
  const v = new URLSearchParams(location.search).get(name);
  return v === null ? def : v;
}

/** Создать DOM-элемент. */
export function el(tag, attrs = {}, html) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  if (html !== undefined) node.innerHTML = html;
  return node;
}

/**
 * Минимальный markdown → HTML (без внешних зависимостей).
 * Поддержка: заголовки ###, **жирный**, `inline code`, ```fenced code```,
 * маркированные/нумерованные списки, таблицы (| .. |), абзацы.
 * Вход экранируется, потом размечается.
 */
export function renderMarkdown(src) {
  if (!src) return '';
  const lines = String(src).split('\n');
  const out = [];
  let i = 0;

  const inline = (t) => {
    // важно: code раньше, чтобы внутри не сработали ** и т.п.
    t = esc(t);
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return t;
  };

  while (i < lines.length) {
    let line = lines[i];

    // fenced code block ```
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // закрывающий ```
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }

    // таблица: строка с | и следующая строка-разделитель |---|
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const header = splitRow(line);
      i += 2; // заголовок + разделитель
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      let html = '<table><thead><tr>' + header.map((h) => `<th>${inline(h)}</th>`).join('') + '</tr></thead><tbody>';
      for (const r of rows) html += '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>';
      html += '</tbody></table>';
      out.push(html);
      continue;
    }

    // заголовки ### / ## / #
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = Math.min(h[1].length + 1, 4); // # -> h2 (h1 занят страницей)
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    // маркированный список
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*[-*]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // нумерованный список
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // пустая строка
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    // абзац (склеиваем до пустой строки/спецблока)
    const para = [];
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*\|.*\|\s*$/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }

  return out.join('\n');
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/** Показать сообщение об ошибке в контейнере. */
export function showError(container, message) {
  container.innerHTML = `<div class="error-box">⚠️ ${esc(message)}</div>`;
}

/** Регистрация service worker (PWA). */
export function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {
        /* офлайн-режим необязателен для работы */
      });
    });
  }
}

// автоинициализация PWA на каждой странице, которая импортирует app.js
registerSW();
