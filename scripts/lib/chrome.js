'use strict';
const { BRAND_NAME, WA_LINK, NAV, SITE_URL } = require('./site');
const { escHtml } = require('./md');

// Same visual chrome as the homepage header/footer (chromeHTML() in
// index.html's inline script), hand-rendered as static markup so blog pages
// don't need to boot the homepage's full render pipeline. Uses the exact
// same classes so assets/css/base.css (copied from index.html's <style>)
// styles it identically.
function navHref(key, currentIsBlog) {
  if (key === 'top') return currentIsBlog ? '/' : '#top';
  return currentIsBlog ? `/#${key}` : `#${key}`;
}

function headerHTML({ activeBlog = true } = {}) {
  const links = NAV.map(
    n => `<a href="${navHref(n[0], true)}"${n[0] === 'top' ? '' : ''}>${n[1]}</a>`
  ).join('');
  const blogLink = `<a href="/blog/" data-nav="blog" class="${activeBlog ? 'active' : ''}">Blog</a>`;
  const mmLinks = NAV.map(
    (n, i) => `<a class="ml" href="${navHref(n[0], true)}" tabindex="-1"><span>0${i}</span>${n[1]}</a>`
  ).join('');
  const mmBlog = `<a class="ml" href="/blog/" tabindex="-1"><span>0${NAV.length}</span>Blog</a>`;
  return `<div id="site-header"><header class="hdr" id="hdr"><a class="brand" href="/" aria-label="${escHtml(BRAND_NAME)}, back to home"><span class="bm" aria-hidden="true">SRB</span><span class="bt">${escHtml(BRAND_NAME)}<small>Srinagar, Kashmir</small></span></a><nav class="hnav" aria-label="Primary">${links}${blogLink}</nav><a class="btn btn-p hwa" href="${WA_LINK}" target="_blank" rel="noopener noreferrer" data-magnetic data-cursor="Chat">WhatsApp me</a><button class="burger" id="burger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mm"><span></span><span></span></button></header>
<div class="mm" id="mm" aria-hidden="true">${mmLinks}${mmBlog}<a class="btn btn-p" href="${WA_LINK}" target="_blank" rel="noopener noreferrer" tabindex="-1">WhatsApp me</a></div></div>`;
}

function footerHTML() {
  const sections = NAV.map(n => `<a href="${navHref(n[0], true)}">${n[1]}</a>`).join('') + `<a href="/blog/">Blog</a>`;
  return `<div id="site-footer"><footer class="ftr"><div class="shell"><div class="ftr-grid"><nav aria-label="Footer"><h4>Sections</h4>${sections}</nav><div><h4>Live websites</h4><a href="https://thekashmirparadisetours.com/" target="_blank" rel="noopener noreferrer">The Kashmir Paradise Tours ↗</a><a href="https://adwizardai.netlify.app/" target="_blank" rel="noopener noreferrer">AdWizard AI ↗</a><a href="https://friendskhatamband.com/" target="_blank" rel="noopener noreferrer">Friends Khatam Band ↗</a></div><div><h4>Contact</h4><a href="${WA_LINK}" target="_blank" rel="noopener noreferrer">WhatsApp</a><a href="mailto:rashidsuhail573@gmail.com">rashidsuhail573@gmail.com</a><a href="tel:+917780891426">+91 77808 91426</a><p>Srinagar, Jammu &amp; Kashmir</p></div></div><div class="ftr-bot"><span>© <span id="yr">2026</span> ${escHtml(BRAND_NAME)} · Srinagar, Jammu &amp; Kashmir</span><button class="totop" id="totop" type="button">Back to top ↑</button></div></div></footer></div>`;
}

// Lightweight chrome script: header scroll state, burger menu, year, reading
// progress, TOC scroll-spy, category filter, prev/next & related reveal.
// Deliberately does not load Three.js/Lenis/custom-cursor — keeps the blog
// fast, and those effects are homepage-specific per the design brief
// ("3D effects only where they complement the existing website").
const CHROME_SCRIPT = `
(function(){
"use strict";
var $=function(s,c){return (c||document).querySelector(s)};
var $$=function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))};
var yr=$('#yr');if(yr)yr.textContent=new Date().getFullYear();
var hdr=$('#hdr');
if(hdr){
  var onScroll=function(){hdr.classList.toggle('scrolled',window.scrollY>10)};
  onScroll();document.addEventListener('scroll',onScroll,{passive:true});
}
var burger=$('#burger'),mm=$('#mm');
if(burger&&mm){
  var closeMenu=function(){document.body.classList.remove('mm-open');burger.setAttribute('aria-expanded','false');mm.setAttribute('aria-hidden','true')};
  burger.addEventListener('click',function(){
    var open=!document.body.classList.contains('mm-open');
    document.body.classList.toggle('mm-open',open);
    burger.setAttribute('aria-expanded',String(open));
    mm.setAttribute('aria-hidden',String(!open));
  });
  $$('.ml',mm).forEach(function(a){a.addEventListener('click',closeMenu)});
}
var totop=$('#totop');
if(totop)totop.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'})});
// reading progress (article pages only — .progress element present)
var prog=$('#progress');
if(prog){
  var update=function(){
    var h=document.documentElement;
    var scrolled=h.scrollTop||document.body.scrollTop;
    var height=(h.scrollHeight||document.body.scrollHeight)-h.clientHeight;
    var pct=height>0?scrolled/height:0;
    prog.style.transform='scaleX('+Math.min(1,Math.max(0,pct))+')';
  };
  prog.style.transformOrigin='left';document.addEventListener('scroll',update,{passive:true});update();
}
// TOC scroll-spy
var tocLinks=$$('.art-toc a');
if(tocLinks.length){
  var targets=tocLinks.map(function(a){return document.getElementById(a.getAttribute('href').slice(1))}).filter(Boolean);
  var io=new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(!en.isIntersecting)return;
      tocLinks.forEach(function(a){a.classList.toggle('active',a.getAttribute('href')==='#'+en.target.id)});
    });
  },{rootMargin:'-20% 0px -70% 0px'});
  targets.forEach(function(t){io.observe(t)});
}
// category filters on /blog/
var filterBtns=$$('.chip-f[data-f]');
if(filterBtns.length){
  var cards=$$('.a-card[data-cat]');
  var empty=$('#blog-empty');
  filterBtns.forEach(function(btn){
    btn.addEventListener('click',function(){
      filterBtns.forEach(function(b){b.setAttribute('aria-pressed','false')});
      btn.setAttribute('aria-pressed','true');
      var f=btn.dataset.f;
      var shown=0;
      cards.forEach(function(c){
        var match=f==='all'||c.dataset.cat===f;
        c.hidden=!match;if(match)shown++;
      });
      if(empty)empty.hidden=shown!==0;
    });
  });
}
// scroll reveal (GSAP optional — plain IntersectionObserver fallback keeps this dependency-light)
var reveal=$$('[data-reveal]');
if(reveal.length){
  var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced){reveal.forEach(function(el){el.classList.add('is-in')});}
  else{
    var rio=new IntersectionObserver(function(entries){
      entries.forEach(function(en){if(en.isIntersecting){en.target.classList.add('is-in');rio.unobserve(en.target)}});
    },{threshold:.12});
    reveal.forEach(function(el){rio.observe(el)});
  }
}
})();
`;

const CHROME_CSS_EXTRA = `
.hnav a[data-nav="blog"].active,.hnav a.active{color:var(--lime)}
[data-reveal]{opacity:0;transform:translateY(22px);transition:opacity .7s var(--ease),transform .7s var(--ease)}
[data-reveal].is-in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){[data-reveal]{opacity:1;transform:none;transition:none}}
`;

module.exports = { headerHTML, footerHTML, CHROME_SCRIPT, CHROME_CSS_EXTRA };
