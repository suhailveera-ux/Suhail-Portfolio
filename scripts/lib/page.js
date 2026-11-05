'use strict';
const { SITE_URL, BRAND_NAME } = require('./site');
const { headerHTML, footerHTML, CHROME_SCRIPT, CHROME_CSS_EXTRA } = require('./chrome');

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23050706'/%3E%3Crect x='3' y='3' width='58' height='58' rx='13' fill='none' stroke='%23C6F432' stroke-opacity='.55' stroke-width='2'/%3E%3Ctext x='32' y='40' text-anchor='middle' font-family='Arial,sans-serif' font-weight='800' font-size='20' fill='%23C6F432'%3ESRB%3C/text%3E%3C/svg%3E";

/**
 * Renders a full HTML document using the shared design system
 * (assets/css/base.css, same tokens as index.html) plus the homepage's
 * header/footer chrome. `body` is the page's own markup; `head` is any
 * extra per-page <head> tags (title, meta, JSON-LD); `showProgress` adds
 * the reading-progress bar element used on article pages.
 */
function page({ title, description, canonical, ogImage, ogType = 'website', head = '', body, showProgress = false, jsonLd = [], activeBlog = true }) {
  const jsonLdBlocks = jsonLd
    .map(obj => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
    .join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#050706">
<meta name="color-scheme" content="dark">
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${BRAND_NAME}">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="en_IN">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${ogImage}">
<link rel="icon" type="image/svg+xml" href="${FAVICON}">
<link rel="alternate" type="application/rss+xml" title="${BRAND_NAME} — Blog" href="${SITE_URL}/rss.xml">
${jsonLdBlocks}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Archivo+Black&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/base.css">
<style>${CHROME_CSS_EXTRA}</style>
${head}
</head>
<body class="blog-body">
<a class="skip" href="#main">Skip to content</a>
<div class="grain" aria-hidden="true"></div>
${showProgress ? '<div class="progress" aria-hidden="true"><i id="progress"></i></div>' : ''}
${headerHTML({ activeBlog })}
<main id="main" tabindex="-1">
${body}
</main>
${footerHTML()}
<a class="fab" href="https://wa.me/917780891426?text=Hi%20Suhail%2C%20I%20saw%20your%20blog%20and%20would%20like%20to%20talk%20campaigns." target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z"/></svg></a>
<script>${CHROME_SCRIPT}</script>
</body>
</html>`;
}

module.exports = { page };
