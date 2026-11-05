'use strict';
/**
 * Blog build script. Reads content/blog/*.md, renders the blog homepage,
 * individual article pages, 404.html, sitemap.xml and rss.xml, and writes
 * them into the repo root (so Netlify's `publish = "."` serves them as
 * real static files — real directories with index.html, so direct URL
 * access and browser refresh both work with zero redirect/routing config).
 *
 * Zero npm dependencies on purpose: this environment has no package
 * registry access, and Netlify's build container shouldn't depend on one
 * being reachable either. Everything here is hand-rolled (see scripts/lib).
 *
 * Generated output (/blog/, /404.html, /sitemap.xml, /rss.xml) is
 * gitignored — content/blog/*.md is the only source of truth, rebuilt on
 * every Netlify deploy via `npm run build`.
 */
const fs = require('fs');
const path = require('path');

const { parseFrontmatter } = require('./lib/frontmatter');
const { renderMarkdown, escHtml, slugify } = require('./lib/md');
const { page } = require('./lib/page');
const { SITE_URL, BRAND_NAME, CONTACT } = require('./lib/site');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'blog');
const OUT_BLOG_DIR = path.join(ROOT, 'blog');

const ARROW_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';

function readPosts() {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
  const posts = files.map(file => {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
    const { data, content } = parseFrontmatter(raw);
    const { html, toc } = renderMarkdown(content);
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const readingTime = data.readingTime || Math.max(1, Math.round(words / 200));
    const slug = data.slug || slugify(data.title || file.replace(/\.md$/, ''));
    return {
      ...data,
      slug,
      html,
      toc,
      readingTime,
      status: data.status || 'draft',
      isDraft: (data.status || 'draft') !== 'published',
    };
  });
  // newest first
  posts.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return posts;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function categorySlug(cat) {
  return slugify(cat || '');
}

function authorInitials(name) {
  return (name || '')
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function draftBadge(post) {
  if (!post.isDraft) return '';
  return `<span class="ill" title="Demo content — not yet approved for publication">Draft</span>`;
}

function postCardHTML(post) {
  const cat = categorySlug(post.category);
  return `<article class="a-card" data-cat="${cat}" data-reveal>
<a class="a-media" href="/blog/${escHtml(post.slug)}/" aria-hidden="true" tabindex="-1">
<span class="a-cat">${escHtml(post.category || '')}</span>
<img src="${escHtml(post.image || '')}" alt="${escHtml(post.imageAlt || '')}" width="640" height="400" loading="lazy" decoding="async">
</a>
<div class="a-body">
<div class="a-meta"><span>${fmtDate(post.date)}</span><i></i><span>${post.readingTime} min read</span>${post.isDraft ? '<i></i>' + draftBadge(post) : ''}</div>
<h3><a href="/blog/${escHtml(post.slug)}/">${escHtml(post.title || '')}</a></h3>
<p>${escHtml(post.description || '')}</p>
<a class="a-more" href="/blog/${escHtml(post.slug)}/">Read more ${ARROW_SVG}</a>
</div>
</article>`;
}

function featuredHTML(post) {
  const cat = categorySlug(post.category);
  return `<div class="feat" data-reveal>
<div class="feat-media"><span class="feat-badge"><span class="feat-cat">${escHtml(post.category || '')}</span></span><img src="${escHtml(post.image || '')}" alt="${escHtml(post.imageAlt || '')}" width="960" height="660" loading="eager" fetchpriority="high" decoding="async"></div>
<div>
<div class="feat-meta"><span>${fmtDate(post.date)}</span><i></i><span>${post.readingTime} min read</span>${post.isDraft ? '<i></i>' + draftBadge(post) : ''}</div>
<h2><a href="/blog/${escHtml(post.slug)}/">${escHtml(post.title || '')}</a></h2>
<p>${escHtml(post.description || '')}</p>
<a class="btn-visit sm" href="/blog/${escHtml(post.slug)}/" data-magnetic><span class="bv-t">Read article</span><span class="bv-c" aria-hidden="true"></span><span class="bv-i" aria-hidden="true"><svg class="a1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg><svg class="a2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span><span class="bv-sh" aria-hidden="true"></span></a>
</div>
</div>`;
}

const ALL_CATEGORIES = [
  'Digital Marketing',
  'Performance Marketing',
  'Meta Ads',
  'Google Ads',
  'SEO',
  'Website Development',
  'AI & Automation',
  'Business Growth',
];

function buildIndex(posts) {
  const featured = posts[0];
  const rest = posts.slice(1);
  // Filters only act on the grid below (`rest`), not the featured post above
  // it — deriving categories from `posts` would show a filter chip that,
  // once clicked, has nothing to show.
  const usedCats = new Set(rest.map(p => p.category).filter(Boolean));
  const filterCats = ALL_CATEGORIES.filter(c => usedCats.has(c));

  const filtersHTML = `<div class="filters" role="group" aria-label="Filter by category"><button class="chip-f" type="button" data-f="all" aria-pressed="true">All</button>${filterCats
    .map(c => `<button class="chip-f" type="button" data-f="${categorySlug(c)}" aria-pressed="false">${escHtml(c)}</button>`)
    .join('')}</div>`;

  const gridHTML = rest.map(postCardHTML).join('\n');

  const body = `
<section class="blog-hero shell">
<div class="blog-crumb"><a href="/">Home</a><span class="sep">/</span><span class="cur">Blog</span></div>
<div class="kicker" data-reveal><span class="sn">Blog</span><span>Field notes</span></div>
<h1 data-reveal>Insights, Ideas &amp; Perspectives</h1>
<p class="lead" data-reveal>Practical notes on performance marketing, Meta and Google Ads, SEO, website development and AI automation — written from day-to-day campaign and build work, not theory.</p>
</section>
${featured ? `<section class="sec shell" aria-label="Featured article">${featuredHTML(featured)}</section>` : ''}
<section class="sec shell" aria-labelledby="latest-h">
<div class="blog-filters"><h2 class="h2" id="latest-h" style="font-size:clamp(24px,2.6vw,36px)">Latest <span class="accent it">articles.</span></h2>${filtersHTML}</div>
<div class="grid-articles" id="blog-grid">${gridHTML}</div>
<p class="wall-empty a-empty" id="blog-empty" hidden>No articles in this category yet.</p>
</section>
<section class="sec shell" aria-labelledby="blog-cta-h">
<div class="contact-grid" style="grid-template-columns:1fr">
<div style="max-width:640px">
<div class="kicker" data-reveal><span class="sn">·</span><span>Let's talk</span></div>
<h2 class="h2" id="blog-cta-h" data-reveal>Thinking about a campaign, a site, or an automation?</h2>
<p class="lead" data-reveal style="margin-top:18px">Tell me what you're trying to grow and I'll reply with the first tests I'd run.</p>
<div class="hero-actions" data-reveal style="margin-top:26px"><a class="btn btn-p" href="https://wa.me/${CONTACT.wa}?text=${encodeURIComponent('Hi Suhail, I read your blog and would like to talk campaigns.')}" target="_blank" rel="noopener noreferrer" data-magnetic data-cursor="Chat">WhatsApp me ${ARROW_SVG}</a><a class="btn btn-s" href="/#contact" data-magnetic>Other ways to reach me</a></div>
</div>
</div>
</section>`;

  const title = `Blog | ${BRAND_NAME}`;
  const description =
    'Practical notes on performance marketing, Meta Ads, Google Ads, SEO, website development and AI automation — from Suhail Rashid Bhat.';
  const canonical = `${SITE_URL}/blog/`;
  const ogImage = `${SITE_URL}/assets/img/og-image.jpg`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: `${BRAND_NAME} — Blog`,
      url: canonical,
      description,
      author: { '@type': 'Person', name: BRAND_NAME, url: `${SITE_URL}/` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: canonical },
      ],
    },
  ];

  const html = page({ title, description, canonical, ogImage, head: '', body, jsonLd });
  fs.mkdirSync(OUT_BLOG_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_BLOG_DIR, 'index.html'), html);
}

function tocHTML(toc) {
  if (!toc || !toc.length) return '';
  const items = toc
    .map(t => `<li class="${t.level === 3 ? 'lvl3' : ''}"><a href="#${t.id}">${escHtml(t.text)}</a></li>`)
    .join('');
  return `<aside class="art-toc" aria-label="Table of contents"><h4>On this page</h4><ol>${items}</ol></aside>`;
}

function shareHTML(post, url) {
  const text = encodeURIComponent(post.title || '');
  const u = encodeURIComponent(url);
  return `<div class="art-share"><span>Share</span>
<a href="https://twitter.com/intent/tweet?text=${text}&url=${u}" target="_blank" rel="noopener noreferrer" aria-label="Share on X"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-7.6 8.7L23.3 22h-7.1l-5.5-7.2L4.3 22H1.2l8.2-9.4L.9 2h7.3l5 6.6L18.9 2zm-1.2 18h1.9L6.4 4H4.3l13.4 16z"/></svg></a>
<a href="https://www.linkedin.com/sharing/share-offsite/?url=${u}" target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45z"/></svg></a>
<a href="https://wa.me/?text=${text}%20${u}" target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z"/></svg></a>
<a href="mailto:?subject=${text}&body=${u}" aria-label="Share by email"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 4h16v16H4zM4 6l8 7 8-7"/></svg></a>
</div>`;
}

function buildArticles(posts) {
  posts.forEach((post, i) => {
    const prev = posts[i - 1]; // newer
    const next = posts[i + 1]; // older
    const url = `${SITE_URL}/blog/${post.slug}/`;
    const title = post.seoTitle || `${post.title} | ${BRAND_NAME}`;
    const description = post.metaDescription || post.description || '';
    const ogImage = post.ogImage ? `${SITE_URL}${post.ogImage}` : `${SITE_URL}${post.image || '/assets/img/og-image.jpg'}`;

    const related = posts
      .filter(p => p.slug !== post.slug && p.category === post.category)
      .slice(0, 3);
    const relatedFallback = related.length
      ? related
      : posts.filter(p => p.slug !== post.slug).slice(0, 3);

    const body = `
<section class="art-top shell">
<div class="blog-crumb"><a href="/">Home</a><span class="sep">/</span><a href="/blog/">Blog</a><span class="sep">/</span><span class="cur">${escHtml(post.title || '')}</span></div>
<div class="art-head">
${post.isDraft ? `<div class="art-draft">● Draft / demo content — not yet approved for publication</div>` : ''}
<div class="kicker"><span class="sn">${escHtml(post.category || '')}</span><span>Article</span></div>
<h1>${escHtml(post.title || '')}</h1>
${post.subtitle ? `<p class="art-sub">${escHtml(post.subtitle)}</p>` : ''}
<div class="art-meta">
<div class="art-author"><span class="av">${escHtml(authorInitials(post.author))}</span><span><b>${escHtml(post.author || BRAND_NAME)}</b><small>Author</small></span></div>
<span class="art-sep"></span><span class="art-chip">${fmtDate(post.date)}</span>
${post.updated ? `<span class="art-sep"></span><span class="art-chip">Updated ${fmtDate(post.updated)}</span>` : ''}
<span class="art-sep"></span><span class="art-chip">${post.readingTime} min read</span>
<span class="art-sep"></span><span class="art-chip">${escHtml(post.category || '')}</span>
</div>
</div>
${post.image ? `<div class="art-media"><img src="${escHtml(post.image)}" alt="${escHtml(post.imageAlt || '')}" width="1200" height="600" loading="eager" fetchpriority="high" decoding="async"></div>` : ''}
</section>
<section class="sec shell" style="padding-top:clamp(36px,4vw,56px)">
<div class="art-layout">
<div>
<div class="prose">${post.html}</div>
${shareHTML(post, url)}
<div class="art-author-box"><span class="av">${escHtml(authorInitials(post.author))}</span><div><h4>${escHtml(post.author || BRAND_NAME)}</h4><p>Performance Marketing &amp; AI Manager at Global Chinar, Srinagar. Writes about what actually moves the numbers in Meta Ads, Google Ads, SEO and AI-assisted lead flows.</p></div></div>
<div class="art-nav">
${next ? `<a href="/blog/${escHtml(next.slug)}/"><span class="dir">← Older</span><b>${escHtml(next.title || '')}</b></a>` : '<span></span>'}
${prev ? `<a class="next" href="/blog/${escHtml(prev.slug)}/"><span class="dir">Newer →</span><b>${escHtml(prev.title || '')}</b></a>` : '<span></span>'}
</div>
${relatedFallback.length ? `<div class="related-head"><h3 class="h2" style="font-size:clamp(22px,2.4vw,30px)">Related <span class="accent it">reading.</span></h3></div><div class="grid-articles">${relatedFallback.map(postCardHTML).join('')}</div>` : ''}
</div>
${tocHTML(post.toc)}
</div>
</section>`;

    const jsonLd = [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        description,
        image: ogImage,
        datePublished: post.date ? `${post.date}T00:00:00+05:30` : undefined,
        dateModified: (post.updated || post.date) ? `${post.updated || post.date}T00:00:00+05:30` : undefined,
        author: { '@type': 'Person', name: post.author || BRAND_NAME, url: `${SITE_URL}/` },
        publisher: { '@type': 'Person', name: BRAND_NAME, url: `${SITE_URL}/` },
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog/` },
          { '@type': 'ListItem', position: 3, name: post.title, item: url },
        ],
      },
    ];

    const html = page({
      title,
      description,
      canonical: url,
      ogImage,
      ogType: 'article',
      body,
      showProgress: true,
      jsonLd,
    });

    const dir = path.join(OUT_BLOG_DIR, post.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
  });
}

function build404() {
  const body = `<section class="err404 shell">
<span class="mono big">404</span>
<h1>This page wandered off the map.</h1>
<p>The page you're looking for doesn't exist, or the link may be out of date. Try the homepage or the blog instead.</p>
<div class="hero-actions"><a class="btn btn-p" href="/">Back to homepage ${ARROW_SVG}</a><a class="btn btn-s" href="/blog/">Visit the blog</a></div>
</section>`;
  const html = page({
    title: `Page not found | ${BRAND_NAME}`,
    description: 'The page you requested could not be found.',
    canonical: `${SITE_URL}/404.html`,
    ogImage: `${SITE_URL}/assets/img/og-image.jpg`,
    body,
    activeBlog: false,
  });
  fs.writeFileSync(path.join(ROOT, '404.html'), html);
}

function buildSitemap(posts) {
  const urls = [
    { loc: `${SITE_URL}/`, priority: '1.0', changefreq: 'monthly' },
    { loc: `${SITE_URL}/blog/`, priority: '0.9', changefreq: 'weekly' },
    ...posts.map(p => ({
      loc: `${SITE_URL}/blog/${p.slug}/`,
      priority: '0.7',
      changefreq: 'monthly',
      lastmod: p.updated || p.date || undefined,
    })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    u => `  <url>
    <loc>${u.loc}</loc>
${u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : ''}    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
}

function rssEscape(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildRSS(posts) {
  const items = posts
    .filter(p => !p.isDraft)
    .map(
      p => `  <item>
    <title>${rssEscape(p.title)}</title>
    <link>${SITE_URL}/blog/${p.slug}/</link>
    <guid>${SITE_URL}/blog/${p.slug}/</guid>
    <description>${rssEscape(p.description)}</description>
    <pubDate>${p.date ? new Date(p.date + 'T00:00:00+05:30').toUTCString() : ''}</pubDate>
  </item>`
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${BRAND_NAME} — Blog</title>
  <link>${SITE_URL}/blog/</link>
  <description>Performance marketing, Meta Ads, Google Ads, SEO, website development and AI automation.</description>
  <language>en-in</language>
${items}
</channel>
</rss>
`;
  fs.writeFileSync(path.join(ROOT, 'rss.xml'), xml);
}

function main() {
  const posts = readPosts();
  if (fs.existsSync(OUT_BLOG_DIR)) fs.rmSync(OUT_BLOG_DIR, { recursive: true, force: true });
  buildIndex(posts);
  buildArticles(posts);
  build404();
  buildSitemap(posts);
  buildRSS(posts);
  console.log(`Blog build complete: ${posts.length} post(s).`);
  posts.forEach(p => console.log(`  - /blog/${p.slug}/  (${p.status})`));
}

main();
