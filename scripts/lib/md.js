'use strict';
/**
 * Small, dependency-free Markdown -> HTML renderer, built for the specific
 * subset used in content/blog/*.md: h2/h3 headings, paragraphs, bold/italic,
 * links, inline code, unordered/ordered lists, blockquotes, hr, and a custom
 * ":::callout Title\n...\n:::" block mapped to the .callout component
 * already defined in assets/css/base.css. Not a general CommonMark engine —
 * there's no registry access in this environment to pull one in, and a
 * renderer scoped to what we actually author is easier to trust than a
 * partial reimplementation of a large spec.
 */

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// inline-level: code, bold, italic, links — order matters (code first so its
// contents are never re-processed by bold/italic/link patterns)
function renderInline(text) {
  const codeStash = [];
  let out = text.replace(/`([^`]+)`/g, (_, code) => {
    codeStash.push(`<code>${escHtml(code)}</code>`);
    return `\u0000${codeStash.length - 1}\u0000`;
  });
  out = escHtml(out).replace(/\u0000(\d+)\u0000/g, (_, i) => codeStash[Number(i)]);
  // links [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => {
    const external = /^https?:\/\//.test(u);
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${escHtml(u)}"${attrs}>${t}</a>`;
  });
  // bold then italic (bold uses **, italic uses single *)
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  return out;
}

function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  const toc = [];
  let i = 0;
  let listBuf = null; // {type:'ul'|'ol', items:[]}

  function flushList() {
    if (!listBuf) return;
    const tag = listBuf.type;
    html.push(`<${tag}>${listBuf.items.map(it => `<li>${renderInline(it)}</li>`).join('')}</${tag}>`);
    listBuf = null;
  }

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { flushList(); i++; continue; }

    // callout block: ::: callout Title \n body \n :::
    const calloutStart = line.match(/^:::callout\s*(.*)$/);
    if (calloutStart) {
      flushList();
      const title = calloutStart[1].trim();
      const body = [];
      i++;
      while (i < lines.length && lines[i].trim() !== ':::') { body.push(lines[i]); i++; }
      i++; // skip closing :::
      html.push(
        `<div class="callout">${title ? `<div><b>${escHtml(title)}</b><p>${renderInline(body.join(' ').trim())}</p></div>` : `<p>${renderInline(body.join(' ').trim())}</p>`}</div>`
      );
      continue;
    }

    // horizontal rule
    if (/^-{3,}$/.test(line.trim())) { flushList(); html.push('<hr>'); i++; continue; }

    // headings
    const h = line.match(/^(#{2,3})\s+(.*)$/);
    if (h) {
      flushList();
      const level = h[1].length; // 2 or 3
      const text = h[2].trim();
      const id = slugify(text);
      toc.push({ level, text, id });
      html.push(`<h${level} id="${id}">${renderInline(text)}</h${level}>`);
      i++; continue;
    }

    // blockquote
    if (/^>\s?/.test(line)) {
      flushList();
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      html.push(`<blockquote>${renderInline(buf.join(' '))}</blockquote>`);
      continue;
    }

    // ordered list
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      if (!listBuf || listBuf.type !== 'ol') { flushList(); listBuf = { type: 'ol', items: [] }; }
      listBuf.items.push(ol[1]);
      i++; continue;
    }

    // unordered list
    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ul) {
      if (!listBuf || listBuf.type !== 'ul') { flushList(); listBuf = { type: 'ul', items: [] }; }
      listBuf.items.push(ul[1]);
      i++; continue;
    }

    // paragraph: collect until blank line or a line starting a new block
    flushList();
    const buf = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{2,3})\s+/.test(lines[i]) &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^-{3,}$/.test(lines[i].trim()) &&
      !/^:::callout/.test(lines[i])
    ) { buf.push(lines[i]); i++; }
    html.push(`<p>${renderInline(buf.join(' '))}</p>`);
  }
  flushList();

  return { html: html.join('\n'), toc };
}

module.exports = { renderMarkdown, slugify, escHtml };
