#!/usr/bin/env node
// Render the repository's Markdown into static HTML pages for the live site,
// plus a sitemap.xml that lists them.
//
//   node tools/gen-site-pages.js            write story.html, apps/*.html, articles/*.html, docs/**/*.html, sitemap.xml
//   node tools/gen-site-pages.js --list     print what would be written, write nothing
//
// WHY THIS EXISTS: story.html used to fetch PROJECT_STORY.md and render it
// with marked in the browser, so the served HTML held a "Loading..." div and
// nothing else. Googlebot may execute that script; Bing, DuckDuckGo, link
// unfurlers and the LLM crawlers do not, and none of them saw a word of the
// story. The design docs and reverse-engineering notes under docs/ were not
// on the site at all -- tools/deploy-berrry.js only walks lib/ and src/.
//
// Every page gets a real <title>, a meta description taken from its first
// paragraph, canonical + Open Graph tags, and an Article JSON-LD block, so a
// search result and a chat-app link preview both have something to show.
//
// Output is generated, not source: story.html is committed so a local
// http.server has it, docs/**/*.html and sitemap.xml are gitignored and
// deploy-berrry.js regenerates all three right before it uploads.

const fs = require('fs');
const path = require('path');
const { createGitDates } = require('./site-page-dates');
const { marked } = require('marked');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://wine-assembly.berrry.app';
const SITE_NAME = 'Wine-Assembly';
const AUTHOR = 'Vladimir Grichina';
const REPO = 'https://github.com/vgrichina/wine-assembly';
const OG_IMAGE = `${SITE}/icons/og-image.png`;
// Pinned: a diagram that rendered under one mermaid parser should keep
// rendering, and a floating "latest" has broken flowchart syntax before.
const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs';

const STYLE = `
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { background: #f5f2ea; color: #1a1a1a; line-height: 1.55; font-size: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-text-size-adjust: 100%; }
    .wrap { max-width: 760px; margin: 0 auto; padding: 24px 18px 64px; }
    nav.top { font-size: 13px; padding-bottom: 12px; border-bottom: 1px solid #d8d2c4; margin-bottom: 24px; }
    nav.top a { color: #0645ad; text-decoration: none; margin-right: 14px; }
    nav.top a:hover { text-decoration: underline; }
    h1, h2, h3, h4 { line-height: 1.25; margin: 1.6em 0 0.5em; }
    h1 { font-size: 1.9em; border-bottom: 2px solid #1a1a1a; padding-bottom: 6px; margin-top: 0.4em; }
    h2 { font-size: 1.45em; border-bottom: 1px solid #d8d2c4; padding-bottom: 4px; }
    h3 { font-size: 1.15em; }
    p, ul, ol { margin: 0.7em 0; }
    ul, ol { padding-left: 1.4em; }
    li { margin: 0.2em 0; }
    hr { border: 0; border-top: 1px solid #d8d2c4; margin: 2em 0; }
    a { color: #0645ad; }
    strong { color: #000; }
    blockquote { margin: 1em 0; padding: 0.2em 1em; border-left: 4px solid #d8d2c4; color: #444; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.9em;
      background: #ebe7dc; padding: 1px 4px; border-radius: 3px; }
    pre { background: #1e1e1e; color: #e6e6e6; padding: 12px 14px; border-radius: 6px;
      overflow-x: auto; font-size: 13px; line-height: 1.45; }
    pre code { background: none; padding: 0; color: inherit; font-size: inherit; }
    table { border-collapse: collapse; margin: 1em 0; font-size: 0.93em; display: block; overflow-x: auto; }
    th, td { border: 1px solid #d8d2c4; padding: 5px 9px; text-align: left; vertical-align: top; }
    th { background: #ebe7dc; }
    img { max-width: 100%; height: auto; }
    footer { margin-top: 48px; padding-top: 14px; border-top: 1px solid #d8d2c4; font-size: 13px; color: #555; }
    .dateline { margin: -0.6em 0 1.6em; font-size: 13px; color: #666; }
    .pager { display: flex; justify-content: space-between; gap: 16px; margin-top: 40px; padding-top: 14px; border-top: 1px solid #d8d2c4; }
    .pager a { flex: 1; text-decoration: none; }
    .pager a small { display: block; color: #666; font-size: 12px; }
    .pager .next { text-align: right; }
    .docs-index li { margin: 0.35em 0; }
    .docs-index small { color: #666; display: block; }
    pre.mermaid { background: #fff; color: #222; border: 1px solid #d8d2c4; text-align: center; overflow-x: auto; padding: 10px 6px; }
    pre.mermaid svg { max-width: 100%; height: auto; }
    .app-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; margin: 0.8em 0 1.6em; }
    .app-card { display: block; text-decoration: none; color: inherit; background: #fff; border: 1px solid #d8d2c4; border-radius: 6px; overflow: hidden; }
    .app-card:hover { border-color: #0645ad; }
    .app-card img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: contain; background: #008080; }
    .app-shot { max-width: 100%; height: auto; }
    .app-card span { display: block; padding: 6px 9px; font-size: 14px; font-weight: 600; }
    .app-card small { display: block; padding: 0 9px 8px; font-size: 12px; color: #666; font-weight: 400; }
    .app-launch { display: inline-block; background: #008080; color: #fff !important; text-decoration: none; padding: 9px 16px; border-radius: 4px; font-weight: 600; margin: 0.4em 0 1em; }
    .app-launch:hover { background: #006666; }
    .app-shot { border: 1px solid #d8d2c4; }
`;

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Title = first H1. Description: an explicit `<!-- description: ... -->`
// comment when the page has one (invisible on GitHub, so the .md stays the
// source), else the first real paragraph cut at a sentence end that fits a
// search snippet, else a word cut with an ellipsis. Markdown is stripped by
// rendering the paragraph and dropping the tags, so a description never
// carries a stray backtick, and entities are decoded so esc() at the tag
// does not double-escape an apostrophe.
const DESC_MAX = 158;
const unescapeHtml = s => s.replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n))
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function extractMeta(md) {
  const lines = md.split('\n');
  let title = null;
  const explicit = md.match(/<!--\s*description:\s*([\s\S]*?)-->/);
  const paras = [];
  let cur = [];
  let inFence = false;
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');
    if (/^```/.test(line)) { inFence = !inFence; cur = []; continue; }
    if (inFence) continue;
    if (!title && /^# /.test(line)) { title = line.replace(/^# /, '').trim(); continue; }
    if (/^\s*$/.test(line) || /^(#|\||>|-|\*|\d+\.|---)/.test(line)) {
      if (cur.length) { paras.push(cur.join(' ')); cur = []; }
      continue;
    }
    cur.push(line.trim());
  }
  if (cur.length) paras.push(cur.join(' '));
  if (explicit) return { title: title || SITE_NAME, description: explicit[1].replace(/\s+/g, ' ').trim() };
  // A page that opens with a table or a list has no paragraph to quote;
  // the title is a better snippet than an empty attribute.
  if (!paras.length) return { title: title || SITE_NAME, description: `${title || SITE_NAME}: notes from the ${SITE_NAME} Windows 98 emulator.` };
  const first = paras.find(p => p.replace(/[*_`]/g, '').length > 40) || paras[0] || '';
  let text = unescapeHtml(marked.parseInline(first).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  if (text.length > DESC_MAX) {
    // Prefer ending on a whole sentence: the last ". " that still leaves a
    // description of useful length. Otherwise cut at a word.
    const head = text.slice(0, DESC_MAX);
    const end = head.lastIndexOf('. ');
    text = end >= 40 ? head.slice(0, end + 1) : text.slice(0, DESC_MAX - 3).replace(/\s+\S*$/, '') + '…';
  }
  return { title: title || SITE_NAME, description: text };
}

// Markdown links are resolved from the source document, not the generated
// page. Documents rendered by this generator get their public HTML route;
// repository-only Markdown stays useful by linking to its GitHub source
// instead of inventing a local .html URL that the deploy does not contain.
function markdownPublicUrl(sourceRel, href, hash) {
  const absolute = href.startsWith('/');
  const target = path.posix.normalize(absolute
    ? href.slice(1)
    : path.posix.join(path.posix.dirname(sourceRel), href));
  if (target === 'PROJECT_STORY.md') return `/story.html${hash || ''}`;
  if (target === 'articles/README.md') return `/articles/${hash || ''}`;
  if (target === 'docs/re-notes/README.md') return `/docs/re-notes/${hash || ''}`;
  if (/^articles\/[^/]+\.md$/.test(target) || /^docs\/(?:re-notes\/)?[^/]+\.md$/.test(target)) {
    return `/${target.replace(/\.md$/, '.html')}${hash || ''}`;
  }
  const githubPath = target.split('/').map(encodeURIComponent).join('/');
  return `${REPO}/blob/main/${githubPath}${hash || ''}`;
}

function rewriteMdLinks(html, sourceRel) {
  return html.replace(/href="([^"#]+\.md)(#[^"]*)?"/g,
    (match, href, hash) => `href="${markdownPublicUrl(sourceRel, href, hash)}"`);
}

function pageHtml({ md, title, description, urlPath, sourceRel, nav = NAV, dates, extraHead, ldExtra, ldMore = [], ogImage = OG_IMAGE, canonical }) {
  const url = `${SITE}/${urlPath}`;
  // A page that has been folded into another (articles/ and docs/ into
  // design/) keeps serving its old URL but declares the new one canonical,
  // so what search engines already indexed transfers instead of competing.
  const canonicalUrl = canonical ? `${SITE}/${canonical}` : url;
  let body = rewriteMdLinks(marked.parse(md, { gfm: true, breaks: false }), sourceRel);
  // ```mermaid fences: GitHub renders them in the .md; here they become
  // <pre class="mermaid"> and the page loads mermaid only when it has one.
  // marked's entity escaping is fine, mermaid reads the element's textContent.
  const hasMermaid = /<pre><code class="language-mermaid">/.test(body);
  body = body.replace(/<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g, '<pre class="mermaid">$1</pre>');
  const mermaidHead = hasMermaid
    ? `\n  <script type="module">import mermaid from "${MERMAID_URL}"; mermaid.initialize({ startOnLoad: true, theme: "neutral", securityLevel: "strict", flowchart: { htmlLabels: true, curve: "basis" } });</script>`
    : '';
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    url,
    image: ogImage,
    author: { '@type': 'Person', name: AUTHOR, url: REPO },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE },
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE },
    inLanguage: 'en',
  };
  if (dates.published) ld.datePublished = dates.published;
  if (dates.modified) ld.dateModified = dates.modified;
  if (ldExtra) Object.assign(ld, ldExtra);
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(fullTitle)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:title" content="${esc(fullTitle)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(fullTitle)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${ogImage}">
  <meta name="theme-color" content="#008080">
  <link rel="icon" href="${SITE}/icons/icon-192.png">
  <script type="application/ld+json">${JSON.stringify(ld)}</script>${ldMore.map(x => `\n  <script type="application/ld+json">${JSON.stringify(x)}</script>`).join('')}${extraHead || ''}${mermaidHead}
  <style>${STYLE}  </style>
</head>
<body>
  <div class="wrap">
    <nav class="top">${nav}</nav>
    <article>
${body}
    </article>
    <footer>
      <a href="${SITE}/">Run Windows 98 apps in your browser</a> ·
      <a href="${REPO}">Source on GitHub</a> ·
      <a href="${REPO}/blob/main/${esc(sourceRel)}">Edit this page</a>${dates.modified ? ` · Updated ${dates.modified}` : ''}
    </footer>
  </div>
</body>
</html>
`;
}

const NAV_HOME = `<a href="/">&larr; Run the emulator</a>`;
const NAV_STORY = `<a href="/story.html">The Story</a>`;
const NAV_REPO = `<a href="${REPO}">GitHub</a>`;
const NAV_APPS = `<a href="/apps/">Apps</a>`;
const NAV_DESIGN = `<a href="/design/">Design</a>`;
// One nav on every page, mirroring the Start menu in index.html: the two
// hubs (Apps, Design), the story, the repo. Five identical links everywhere
// concentrate internal links on the hubs instead of spreading them over
// per-page variants.
const NAV = [NAV_HOME, NAV_APPS, NAV_DESIGN, NAV_STORY, NAV_REPO].join(' ');

// Per-app pages, one for each production desktop icon and nothing else: a search for
// "space cadet pinball in browser" should land on a page that says what the
// program is, shows it running here and has one launch button. Candidates,
// SDK samples and demos stay in the ?debug dropdown without a page.
//
// Name and emoji come from DESKTOP_APPS; the group comes from the <optgroup>
// the id sits under in index.html's selector so the two never disagree; the
// prose comes from tools/site-app-blurbs.json; everything else (exe, format,
// DLLs, data files, command line) is read off the registry entry itself.
const APP_BLURBS_REL = 'tools/site-app-blurbs.json';
const APP_FAQ_REL = 'tools/site-app-faq.json';
const OG_DIR = 'screenshots/og';
const { ogCard } = require('./gen-og-images');
// The selector's groups are about where a binary came from; the pages group
// by what a visitor is looking for, so a few labels fold together.
const GROUP_LABELS = {
  'Other': 'Games and players',
  'Local Candidates': 'Games and players',
  'DirectX Shareware': 'Games and players',
  'Entertainment Pack 2 (16-bit)': 'Entertainment Pack',
};
const NO_GROUP = 'More games';

// Width/height straight from the PNG's IHDR, so the <img> attributes match
// the file: the captures are cropped to the window by tools/png-crop-desktop.js
// and are no longer all 640x480, and a wrong attribute pair makes the browser
// reserve the wrong box and reflow when the picture arrives.
function pngSize(file) {
  const b = Buffer.alloc(24);
  const fd = fs.openSync(file, 'r');
  fs.readSync(fd, b, 0, 24, 0);
  fs.closeSync(fd);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}
const sizeAttrs = s => s ? `width="${s.width}" height="${s.height}"` : '';

// The Questions section of an app page, and the FAQPage JSON-LD that mirrors
// it. Answers are built from facts the registry and the code already state
// (touch layout, LAN flag, exe format, localStorage-backed registry/INI
// persistence, the AudioContext resume on first input) plus the per-app
// controls line in tools/site-app-faq.json. Nothing here claims a feature the
// program has not been seen to use.
function appFaq(app, faq) {
  const qa = [];
  qa.push([`How do I play ${app.name} in my browser?`,
    `Open the ${app.name} page and click Launch. The program's files are fetched from this site and run inside the tab as WebAssembly; nothing is installed and nothing is uploaded.`]);
  qa.push([`What are the controls for ${app.name}?`,
    faq[app.id] || `${app.name} is played with the mouse and the same keyboard shortcuts as the original Windows 98 program; its menus list them.`]);
  qa.push([`Does ${app.name} work on a phone?`,
    app.touch
      ? `Yes. On a phone the desktop scales to the screen and ${app.name} gets on-screen controls for the keys it needs, plus a keyboard button for anything else.`
      : `It loads in mobile Safari and Chrome and the desktop scales to the screen, but ${app.name} was made for a mouse and a keyboard, so it plays best on a desktop browser. Taps act as clicks.`]);
  qa.push([`Are my scores and settings saved?`,
    `Whatever ${app.name} writes to the Windows registry or to its INI file is kept in this browser's local storage, so it is there next time on the same device and browser.` +
    (app.persist.length ? ` So are the files it writes to ${app.persist.map(p => '`' + p + '`').join(' and ')}, which is where it keeps its ${/\.cfg$/i.test(app.persist[0]) ? 'settings' : 'saved games'}.` : '') +
    ` Clearing site data removes it.`]);
  qa.push([`Does ${app.name} have sound here?`,
    (faq._sound && faq._sound[app.id])
      || `Yes. Sound the program plays through the Windows wave and DirectSound APIs is routed to the browser's Web Audio. Browsers only allow audio after a click or a key press, so it starts with your first input.`]);
  if (app.lan) qa.push([`Can I play ${app.name} against someone else?`,
    `Yes, over the emulator's virtual LAN: two copies of the game on the same page share a network segment, so one can host and the other join as the original did on a 1990s LAN.`]);
  qa.push([`Is this the real ${app.name} or a remake?`,
    `It is the original ${app.format || 'Windows'} executable${app.exe ? ` (${app.exe})` : ''}, run instruction by instruction by an x86 interpreter written in WebAssembly Text. The emulator provides the Windows API underneath it, not a rewrite of the program.`]);
  return qa;
}
const faqLd = qa => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: qa.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
});

// Snippet for an app page: the blurb, plus the "runs in your browser" line
// when a one-line blurb leaves room for it; a long blurb is cut at a
// sentence end rather than padded.
function appDescription(app) {
  const tail = ` Runs in your browser on ${SITE_NAME}, a Windows 98 emulator in WebAssembly.`;
  const short = app.game ? ' Plays in your browser, no install.' : ' Runs in your browser, no install.';
  const base = app.blurb.length <= DESC_MAX ? app.blurb : extractMeta(app.blurb).description;
  if (base.length + tail.length <= DESC_MAX) return base + tail;
  return base.length + short.length <= DESC_MAX ? base + short : base;
}

// Searches for these pages are "play X online" / "X in browser": a game's
// title and H1 lead with the verb. Accessories and players keep the plain form.
const appHeading = app => `${app.game ? 'Play ' : ''}${app.name} in your browser`;

function dropdownGroups() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
  const start = html.indexOf('id="app-select"');
  const end = html.indexOf('</select>', start);
  const map = new Map();
  if (start < 0 || end < 0) return map;
  let group = 'Win98 Accessories';
  const re = /<optgroup label="([^"]*)"|<option value="([^"]*)"/g;
  let m;
  while ((m = re.exec(html.slice(start, end)))) {
    if (m[1]) group = m[1];
    else map.set(m[2], GROUP_LABELS[group] || group);
  }
  return map;
}

function exeFormat(rel) {
  try {
    const fd = fs.openSync(path.join(ROOT, rel), 'r');
    const head = Buffer.alloc(0x40);
    fs.readSync(fd, head, 0, 0x40, 0);
    if (head[0] !== 0x4d || head[1] !== 0x5a) { fs.closeSync(fd); return null; }
    const off = head.readUInt32LE(0x3c);
    const sig = Buffer.alloc(2);
    fs.readSync(fd, sig, 0, 2, off);
    fs.closeSync(fd);
    if (sig[0] === 0x4e && sig[1] === 0x45) return '16-bit Windows (NE)';
    if (sig[0] === 0x50 && sig[1] === 0x45) return '32-bit Windows (PE)';
    return null;
  } catch (_) { return null; }
}

// An app that streams its data from a browser manifest mounts those files
// too; counting only `files` made a whole game look like two INI files.
function manifestFileCount(app) {
  if (!app.localFileManifest) return 0;
  try {
    const m = JSON.parse(fs.readFileSync(path.join(ROOT, app.localFileManifest), 'utf-8'));
    return Array.isArray(m.files) ? m.files.length : 0;
  } catch (_) { return 0; }
}

function loadDesktopApps() {
  const { APPS, DESKTOP_APPS, appFileUrl } = require(path.join(ROOT, 'lib', 'apps.js'));
  const blurbs = JSON.parse(fs.readFileSync(path.join(ROOT, APP_BLURBS_REL), 'utf-8'));
  const groups = dropdownGroups();
  const reDir = path.join(ROOT, 'docs', 're-notes');
  const reNotes = fs.existsSync(reDir)
    ? fs.readdirSync(reDir).filter(f => f.endsWith('.md') && f !== 'README.md')
        .map(f => ({ rel: `docs/re-notes/${f}`, md: fs.readFileSync(path.join(reDir, f), 'utf-8') }))
    : [];
  // `_skip` names desktop ids the pages leave out: not on the production
  // desktop yet, or no usable screenshot. The live site's lib/apps.js is the
  // reference for "production desktop", not this checkout's.
  const skip = new Set(blurbs._skip || []);
  const notGames = new Set(blurbs._not_games || []);
  const titles = blurbs._titles || {};
  return DESKTOP_APPS.filter(([id]) => !skip.has(id)).map(([id, desktopName, emoji]) => {
    const name = titles[id] || desktopName;
    const app = APPS[id] || {};
    const exe = app.exe || '';
    const shot = `screenshots/apps/${id}.png`;
    const notes = reNotes
      .filter(n => n.md.includes('`' + id + '`') || n.md.includes(`--app=${id}`))
      .map(n => ({ rel: n.rel, title: extractMeta(n.md).title }));
    const group = groups.get(id) || NO_GROUP;
    return {
      id, name, emoji,
      blurb: blurbs[id] || `${name}, one of the programs on the Wine-Assembly desktop.`,
      group,
      game: group !== 'Win98 Accessories' && !notGames.has(id),
      persist: app.persistFiles || [],
      exe: exe ? path.posix.basename(exe) : null,
      format: exe ? exeFormat(exe) : null,
      dlls: (app.dlls || []).map(d => path.posix.basename(d)),
      files: (app.files || []).map(appFileUrl).filter(Boolean).length + manifestFileCount(app),
      about: (blurbs._about && blurbs._about[id]) || null,
      opengl: (blurbs._opengl || []).includes(id),
      args: app.args || '',
      lan: !!app.lan,
      touch: !!app.touchControls,
      shot: fs.existsSync(path.join(ROOT, shot)) ? shot : null,
      shotSize: fs.existsSync(path.join(ROOT, shot)) ? pngSize(path.join(ROOT, shot)) : null,
      notes,
    };
  });
}

const ARTICLE_FOR_FORMAT = {
  '16-bit Windows (NE)': ['/articles/running-16-bit-windows-apps-in-webassembly.html', 'how 16-bit Windows programs run here'],
  '32-bit Windows (PE)': ['/articles/loading-real-windows-dlls-in-the-browser.html', 'how the program and its DLLs are loaded'],
};

// A hosted title's compat data lives on its app page: the app page is the one
// answer to "does X run in the browser", and compat/<slug>.html only points
// at it (see generatePages). `compat` is { t, affiliate } or null.
function appCompatMd(app, compat) {
  if (!compat) return [];
  const { t, affiliate } = compat;
  const st = COMPAT_STATUS[t.status] || COMPAT_STATUS.unknown;
  const L = [];
  L.push(`## Does ${esc(t.title)} run in the browser?`);
  L.push('');
  const who = [t.developer, t.year].filter(Boolean).join(', ');
  L.push(`**${st.mark} ${st.label}.** ${esc(t.title)}${who ? ` (${esc(who)})` : ''}, measured edition by edition:`);
  L.push('');
  L.push(...compatTableMd(t));
  const unhosted = t.editions.some(e => !e.playId) || (t.store || []).length;
  if (unhosted) {
    // The section heads one level down: they belong to this game, not the page.
    L.push(...bringYourOwnMd().map(l => l.replace(/^## /, '### ')));
  }
  L.push(...whereToGetMd(t, affiliate).map(l => l.replace(/^## /, '### ')));
  return L;
}

function appPageMd(app, siblings, qa, compat = null) {
  const L = [];
  L.push(`# ${appHeading(app)}`);
  L.push('');
  L.push(`${app.blurb} ${app.name} runs in Wine-Assembly, a Windows 98 emulator written in WebAssembly Text, so it starts in the browser with nothing to install.`);
  L.push('');
  L.push(`<a class="app-launch" href="/?app=${app.id}">Launch ${app.name} &rarr;</a>`);
  L.push('');
  if (app.shot) {
    L.push(`<img class="app-shot" src="/${app.shot}" alt="${esc(app.name)} running in Wine-Assembly" ${sizeAttrs(app.shotSize)}>`);
    L.push('');
  }
  // `_about` in site-app-blurbs.json: a few paragraphs on what the program
  // is and what this copy contains, for titles a one-line blurb undersells.
  if (app.about) {
    L.push(`## About ${app.game ? 'the game' : 'the program'}`);
    L.push('');
    for (const p of [].concat(app.about)) { L.push(p); L.push(''); }
  }
  L.push(...appCompatMd(app, compat));
  L.push('## About this program');
  L.push('');
  L.push('| Detail | |');
  L.push('|---|---|');
  if (app.exe) L.push(`| Executable | \`${app.exe}\` |`);
  if (app.format) L.push(`| Format | ${app.format} |`);
  L.push(`| Libraries loaded beside it | ${app.dlls.length ? app.dlls.map(d => '`' + d + '`').join(', ') : 'none; everything else is the emulator\'s own Win32 layer'} |`);
  if (app.files) L.push(`| Data files mounted | ${app.files} |`);
  if (app.args) L.push(`| Command line | \`${app.args.replace(/\|/g, '\\|')}\` |`);
  if (app.lan) L.push('| Network | plays over the emulator\'s virtual LAN |');
  if (app.touch) L.push('| Phones | on-screen controls in single-app mode |');
  L.push(`| Desktop group | ${app.group} |`);
  L.push('');
  L.push('## How it runs here');
  L.push('');
  const fmt = ARTICLE_FOR_FORMAT[app.format];
  L.push(`The x86 code is interpreted by [threaded code written in WebAssembly Text](/articles/x86-interpreter-in-webassembly-text.html); ` +
    `windows, controls, menus and dialogs are the emulator's own [Win32 layer](/articles/win32-api-in-webassembly.html)` +
    (app.opengl
      ? `, and the 3D world goes through the emulator's [OpenGL 1.x frontend](/articles/directdraw-direct3d-in-the-browser.html), which hands its draw calls to WebGL.`
      : `, and every pixel is drawn by a [software GDI](/articles/software-gdi-in-webassembly.html) in the same module.`) +
    (fmt ? ` See [${fmt[1]}](${fmt[0]}).` : ''));
  L.push('');
  if (app.notes.length) {
    L.push('Reverse-engineering notes for this program:');
    L.push('');
    for (const n of app.notes) L.push(`- [${n.title}](/${n.rel})`);
    L.push('');
  }
  L.push(`Something wrong? The emulator is open source; [report it on GitHub](${REPO}/issues) with the app name and what you clicked.`);
  L.push('');
  L.push('## Questions');
  L.push('');
  for (const [q, a] of qa) {
    L.push(`### ${q}`);
    L.push('');
    L.push(a);
    L.push('');
  }
  if (siblings.length) {
    L.push(`## Also under "${app.group}"`);
    L.push('');
    L.push(siblings.map(s => `[${s.name}](/apps/${s.id}.html)`).join(' · '));
    L.push('');
  }
  L.push(`[All programs on the desktop](/apps/) · [How Wine-Assembly was built](/story.html)`);
  L.push('');
  return L.join('\n');
}

function appsIndexMd(apps) {
  const byGroup = new Map();
  for (const a of apps) {
    if (!byGroup.has(a.group)) byGroup.set(a.group, []);
    byGroup.get(a.group).push(a);
  }
  const L = [];
  L.push('# Windows 98 programs you can run in your browser');
  L.push('');
  L.push(`Every icon on the Wine-Assembly desktop, with a page each: what the program is, a picture of it running here, and a link that starts it. ` +
    `They are real Windows 98 executables, not ports; the emulator underneath is an x86 interpreter and Win32 layer written in WebAssembly Text. ` +
    `Programs the site cannot redistribute (game demos, shareware installers, the DirectX SDK samples) are in the debug dropdown on the [main page](/?debug) instead. ` +
    `For everything else the emulator has been tried on, and how to run your own copy, see the [compatibility list](/compat/).`);
  L.push('');
  for (const [group, list] of byGroup) {
    L.push(`## ${group}`);
    L.push('');
    L.push('<div class="app-grid">');
    for (const a of list) {
      const img = a.shot ? `<img src="/${a.shot}" alt="" loading="lazy" ${sizeAttrs(a.shotSize)}>` : '';
      const first = a.blurb.split(/(?<=\.)\s/)[0];
      L.push(`<a class="app-card" href="/apps/${a.id}.html">${img}<span>${esc(a.name)}</span><small>${esc(first)}</small></a>`);
    }
    L.push('</div>');
    L.push('');
  }
  return L.join('\n');
}

// compat/: one page per title the emulator has been tried on, answering the
// search "does X run in the browser" with the measured status of each
// edition, the way to bring your own copy, and where to get the game.
// tools/site-compat.json is the data; every status there comes from an RE
// note's evidence, never from a guess. Store links are plain unless
// `_affiliate` holds a template for that store, and then they are marked
// rel="sponsored" and disclosed on the page.
const COMPAT_REL = 'tools/site-compat.json';
const COMPAT_STATUS = {
  playable: { rank: 6, label: 'Plays', mark: '●' },
  issues: { rank: 5, label: 'Plays, with issues', mark: '◐' },
  // Gameplay is on screen and answers input, but only a moment of it was
  // driven (one shot aimed, a unit selected): too little to say "plays".
  ingame: { rank: 4, label: 'Reaches gameplay', mark: '◑' },
  menus: { rank: 3, label: 'Reaches the menu', mark: '◔' },
  starts: { rank: 2, label: 'Starts only', mark: '○' },
  fails: { rank: 1, label: 'Does not run yet', mark: '✕' },
  unknown: { rank: 0, label: 'Not tested yet', mark: '?' },
};
const EDITION_LABEL = {
  demo: 'Demo', shareware: 'Shareware', trial: 'Trial', freeware: 'Freeware', retail: 'Full game',
  gog: 'GOG release', beta: 'Beta demo', installer: 'Installer', other: 'Other build',
  wep: 'Entertainment Pack (16-bit)', bundled: 'Came with Windows',
};

function loadCompat(desktopIds) {
  const file = path.join(ROOT, COMPAT_REL);
  if (!fs.existsSync(file)) return null;
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const titles = (data.titles || []).map(t => {
    const editions = (t.editions || []).map(e => ({
      ...e,
      // Playable here only when the site hosts it: the public desktop set.
      playId: (e.appIds || []).find(id => desktopIds.has(id)) || null,
    }));
    const best = editions.reduce((b, e) => (COMPAT_STATUS[e.status] || COMPAT_STATUS.unknown).rank > (COMPAT_STATUS[b] || COMPAT_STATUS.unknown).rank ? e.status : b, 'unknown');
    // The desktop app whose page stands for the whole title, if the site hosts one.
    const hostId = (editions.find(e => e.playId) || {}).playId || null;
    return { ...t, editions, status: best, hostId };
  });
  titles.sort((a, b) => a.title.localeCompare(b.title));
  return { affiliate: data._affiliate || {}, titles };
}

function storeLink(store, affiliate) {
  // Keyed by store ("GOG"); a listing's name may add the edition after it.
  const key = Object.keys(affiliate).find(k => affiliate[k] && store.name.startsWith(k));
  const tpl = key && affiliate[key];
  const href = tpl ? tpl.replace('{url}', encodeURIComponent(store.url)).replace('{raw}', store.url) : store.url;
  return { href, sponsored: !!tpl };
}

// The pieces of a title's compat page that an app page reuses when the site
// hosts that title: the measured status per edition, how to try your own
// copy, and where to buy it. Each returns markdown lines ending in a blank.
function compatTableMd(t) {
  const L = [];
  L.push('| Edition | Status | Tested | What works | Not yet |');
  L.push('|---|---|---|---|---|');
  const cell = s => esc(s || '').replace(/\|/g, '\\|');
  for (const e of t.editions) {
    const es = COMPAT_STATUS[e.status] || COMPAT_STATUS.unknown;
    L.push(`| ${cell(EDITION_LABEL[e.edition] || e.edition)} | ${es.mark} ${es.label} | ${e.statusDate || '—'} | ${cell(e.works)} | ${cell(e.issues)} |`);
  }
  L.push('');
  return L;
}

function bringYourOwnMd() {
  return [
    '## Bring your own copy',
    '',
    `Have the CD or the installer? Drop the \`.iso\`, \`.zip\` or \`setup.exe\` on the [desktop](/), or use Start → Add a Game. ` +
      `The disc stays in your browser and is never uploaded; only small save files can sync, and only if you sign in. ` +
      `Retail discs are not hosted here, so this is how the full game is tried.`,
    '',
    `<a class="app-launch" href="/?add-game">Add your copy &rarr;</a>`,
    '',
  ];
}

function whereToGetMd(t, affiliate) {
  const L = [];
  const stores = t.store || [];
  if (!(stores.length || t.demo || t.archive || t.bundled)) return L;
  L.push(`## Where to get ${esc(t.title)}`);
  L.push('');
  if (t.bundled) L.push(`- It came with ${esc(t.bundled)}.`);
  let sponsored = false;
  for (const s of stores) {
    const { href, sponsored: sp } = storeLink(s, affiliate);
    sponsored = sponsored || sp;
    L.push(`- Buy the full game: <a href="${esc(href)}" rel="${sp ? 'sponsored ' : ''}noopener">${esc(s.name)}</a>${sp ? ' ¹' : ''}`);
  }
  if (t.demo) L.push(`- ${esc(t.demo.label || 'Demo')}: <a href="${esc(t.demo.url)}" rel="noopener">${esc(new URL(t.demo.url).hostname)}</a>`);
  if (t.archive && !stores.length) L.push(`- Not sold today. A preservation copy is on the <a href="${esc(t.archive)}" rel="noopener">Internet Archive</a>.`);
  if (sponsored) { L.push(''); L.push('¹ Affiliate link: a purchase through it supports this project at no extra cost to you.'); }
  L.push('');
  return L;
}

function compatPageMd(t, affiliate) {
  const st = COMPAT_STATUS[t.status] || COMPAT_STATUS.unknown;
  const L = [];
  L.push(`# Does ${t.title} run in the browser?`);
  L.push('');
  const who = [t.developer, t.year].filter(Boolean).join(', ');
  L.push(`**${st.mark} ${st.label}.** ${esc(t.title)}${who ? ` (${esc(who)})` : ''} has been tried on Wine-Assembly, a Windows 98 emulator that runs the original program in a browser tab. This is what was measured, edition by edition.`);
  L.push('');
  const play = t.editions.find(e => e.playId);
  if (play) L.push(`<a class="app-launch" href="/apps/${play.playId}.html">Play the ${esc((EDITION_LABEL[play.edition] || 'hosted').toLowerCase())} here &rarr;</a>`);
  L.push('');
  L.push(...compatTableMd(t));
  L.push(...bringYourOwnMd());
  L.push(...whereToGetMd(t, affiliate));
  const notes = [...new Set(t.editions.map(e => e.note).filter(Boolean))];
  if (notes.length) {
    L.push('## Technical notes');
    L.push('');
    L.push(`How it runs, what was fixed and what is still open, for the curious: ${notes.map(n => `[${n}](/docs/re-notes/${n}.html)`).join(', ')}.`);
    L.push('');
  }
  L.push('See the [whole compatibility list](/compat/) or the [programs on the desktop](/apps/).');
  return L.join('\n');
}

function compatDescription(t) {
  const st = COMPAT_STATUS[t.status] || COMPAT_STATUS.unknown;
  const lead = `${t.title}${t.year ? ` (${t.year})` : ''} in the browser: ${st.label.toLowerCase()} on Wine-Assembly, the Windows 98 emulator.`;
  const best = t.editions.find(e => e.status === t.status);
  const more = best && best.works ? ` ${best.works}` : '';
  const full = lead + more;
  if (full.length <= 158) return full;
  return lead.length <= 158 ? lead : lead.slice(0, 157) + '…';
}

function compatIndexMd(titles) {
  const L = [];
  L.push('# Windows games in the browser: compatibility list');
  L.push('<!-- description: Which Windows 95 and 98 games run in a browser tab on Wine-Assembly, edition by edition, from measured runs: plays, reaches the menu or not yet. -->');
  L.push('');
  L.push(`Every program Wine-Assembly has been tried on, with what was measured, not hoped. ` +
    `Titles with a ▶ are hosted and start with one click; for the rest, [add your own copy](/?add-game) (an ISO, a zip or an installer), which stays in your browser.`);
  L.push('');
  const legend = Object.values(COMPAT_STATUS).map(s => `${s.mark} ${s.label}`).join(' · ');
  L.push(`<small>${legend}</small>`);
  L.push('');
  const order = Object.keys(COMPAT_STATUS).sort((a, b) => COMPAT_STATUS[b].rank - COMPAT_STATUS[a].rank);
  for (const key of order) {
    const list = titles.filter(t => t.status === key);
    if (!list.length) continue;
    const st = COMPAT_STATUS[key];
    L.push(`## ${st.mark} ${st.label} (${list.length})`);
    L.push('');
    L.push('| Game | Year | Tested editions |');
    L.push('|---|---|---|');
    for (const t of list) {
      // A hosted title's page is its app page; compat/<slug>.html only points there.
      const play = t.hostId ? ' ▶' : '';
      const href = t.hostId ? `/apps/${t.hostId}.html` : `/compat/${t.slug}.html`;
      const eds = t.editions.map(e => EDITION_LABEL[e.edition] || e.edition).join(', ');
      L.push(`| [${esc(t.title)}](${href})${play} | ${t.year || ''} | ${esc(eds)} |`);
    }
    L.push('');
  }
  return L.join('\n');
}

// articles/*.md: one standalone page per question ("how do lazy flags
// work", "how are real DLLs loaded"), written to be found by a search for
// that question rather than read top to bottom like the story. README.md
// there is the hand-kept index and becomes articles/index.html.
// Articles in reading order: the order articles/README.md lists them, which
// is the order the Design hub shows and the prev/next chain follows. An
// article the README does not mention comes last, alphabetically.
function listArticles() {
  const dir = path.join(ROOT, 'articles');
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).sort().filter(f => f.endsWith('.md') && f !== 'README.md');
  const order = [];
  const titles = {};
  const readme = path.join(dir, 'README.md');
  if (fs.existsSync(readme)) {
    for (const m of fs.readFileSync(readme, 'utf-8').matchAll(/^- \[([^\]]+)\]\(\/articles\/([^)#]+\.md)\)/gm)) {
      order.push(m[2]);
      titles[m[2]] = m[1];
    }
  }
  const rank = f => { const i = order.indexOf(f); return i < 0 ? order.length : i; };
  return files.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map(f => ({ rel: `articles/${f}`, urlPath: `articles/${f.replace(/\.md$/, '.html')}`, listTitle: titles[f] || null }));
}

// The dateline under an article's H1 and the prev/next pager at its foot,
// both as HTML inside the markdown (marked passes block HTML through).
function articleDateline(dates) {
  const parts = [];
  if (dates.published) parts.push(`Published ${dates.published}`);
  if (dates.modified && dates.modified !== dates.published) parts.push(`updated ${dates.modified}`);
  parts.push(`<a href="/design/">How Wine-Assembly works</a>`);
  return `<p class="dateline">${parts.join(' · ')}</p>`;
}
function articlePager(prev, next) {
  const link = (a, cls, label) => a
    ? `<a class="${cls}" href="/${a.urlPath}"><small>${label}</small>${esc(a.listTitle || a.title)}</a>`
    : `<span class="${cls}"></span>`;
  return `\n\n<nav class="pager" aria-label="Articles in order">${link(prev, 'prev', 'Previous')}${link(next, 'next', 'Next')}</nav>\n`;
}
// Insert HTML right after the H1 line (and after a description comment if
// one follows it), so the dateline sits under the title.
function insertAfterH1(md, html) {
  return md.replace(/^(# [^\n]*\n(?:<!--[\s\S]*?-->\n)?)/, `$1\n${html}\n`);
}

function listDocs() {
  const out = [];
  const dirs = [['docs', ''], ['docs/re-notes', 're-notes/']];
  for (const [dir, prefix] of dirs) {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) continue;
    for (const f of fs.readdirSync(full).sort()) {
      if (!f.endsWith('.md')) continue;
      const page = f === 'README.md' ? 'index.html' : f.replace(/\.md$/, '.html');
      out.push({ rel: `${dir}/${f}`, urlPath: `docs/${prefix}${page}` });
    }
  }
  return out;
}

function generatePages({ progress = () => {} } = {}) {
  const started = Date.now();
  const history = createGitDates(ROOT, { progress });
  const gitDate = (rel, which) => history.get(rel)[which === 'first' ? 'published' : 'modified'];
  progress('rendering static pages');
  const pages = [];
  const urls = [{ loc: `${SITE}/`, priority: '1.0', changefreq: 'weekly' }];

  // The story.
  const storyMd = fs.readFileSync(path.join(ROOT, 'PROJECT_STORY.md'), 'utf-8');
  const storyMeta = extractMeta(storyMd);
  const storyDates = { published: gitDate('PROJECT_STORY.md', 'first'), modified: gitDate('PROJECT_STORY.md') };
  pages.push({
    name: 'story.html',
    content: pageHtml({
      md: storyMd,
      title: 'How Wine-Assembly was built: a Windows 98 emulator in raw WebAssembly',
      description: 'The history of Wine-Assembly, a Windows 98 emulator in WebAssembly: from the first x86 decoder to a browser running Pinball, Winamp, DirectX and Win16 apps.',
      urlPath: 'story.html', sourceRel: 'PROJECT_STORY.md',
      dates: storyDates,
    }),
  });
  urls.push({ loc: `${SITE}/story.html`, lastmod: storyDates.modified, priority: '0.8', changefreq: 'monthly' });

  // Articles, in reading order, each with a dateline and a prev/next pager.
  const articles = listArticles().map(a => {
    const md = fs.readFileSync(path.join(ROOT, a.rel), 'utf-8');
    const meta = extractMeta(md);
    return { ...a, md, title: meta.title, description: meta.description,
      dates: { published: gitDate(a.rel, 'first'), modified: gitDate(a.rel) } };
  });
  articles.forEach((a, i) => {
    const md = insertAfterH1(a.md, articleDateline(a.dates)) + articlePager(articles[i - 1], articles[i + 1]);
    pages.push({
      name: a.urlPath,
      content: pageHtml({
        md, title: a.title, description: a.description,
        urlPath: a.urlPath, sourceRel: a.rel,
        dates: a.dates,
      }),
    });
    urls.push({ loc: `${SITE}/${a.urlPath}`, lastmod: a.dates.modified, priority: '0.8', changefreq: 'monthly' });
  });
  // Per-app pages for the desktop set.
  const apps = loadDesktopApps();
  const blurbDates = { published: gitDate(APP_BLURBS_REL, 'first'), modified: gitDate(APP_BLURBS_REL) };
  const faq = fs.existsSync(path.join(ROOT, APP_FAQ_REL)) ? JSON.parse(fs.readFileSync(path.join(ROOT, APP_FAQ_REL), 'utf-8')) : {};
  const compat = loadCompat(new Set(apps.map(a => a.id)));
  // Every desktop app that plays an edition of a compat title carries that
  // title's status, own-copy route and store links on its own page.
  const compatFor = new Map();
  for (const t of (compat ? compat.titles : [])) {
    for (const e of t.editions) {
      if (e.playId && !compatFor.has(e.playId)) compatFor.set(e.playId, { t, affiliate: compat.affiliate });
    }
  }
  for (const app of apps) {
    const siblings = apps.filter(s => s.group === app.group && s.id !== app.id);
    const qa = appFaq(app, faq);
    const md = appPageMd(app, siblings, qa, compatFor.get(app.id) || null);
    // Its compat data changes the page too: the later of the two edits.
    const appDates = compatFor.has(app.id) && gitDate(COMPAT_REL) > (blurbDates.modified || "")
      ? { ...blurbDates, modified: gitDate(COMPAT_REL) } : blurbDates;
    // The app's own 1200x630 link-preview card, built from its screenshot.
    // Generated beside the pages (screenshots/og/ is not committed) and
    // uploaded by deploy-berrry.js with the other binary directories.
    let ogImage = OG_IMAGE;
    if (app.shot) {
      const card = `${OG_DIR}/${app.id}.png`;
      ogCard(path.join(ROOT, app.shot), path.join(ROOT, card));
      ogImage = `${SITE}/${card}`;
    }
    pages.push({
      name: `apps/${app.id}.html`,
      content: pageHtml({
        md,
        title: appHeading(app),
        // The blurb is the description; the boilerplate sentence after it
        // in the page body only pads a snippet.
        description: appDescription(app),
        urlPath: `apps/${app.id}.html`, sourceRel: APP_BLURBS_REL,
        dates: appDates,
        ogImage,
        ldMore: [faqLd(qa)],
        ldExtra: {
          '@type': 'WebPage',
          about: { '@type': 'SoftwareApplication', name: app.name, operatingSystem: 'Windows 98', applicationCategory: app.group },
          ...(app.shot ? { image: [ogImage, `${SITE}/${app.shot}`] } : {}),
        },
      }),
    });
    urls.push({ loc: `${SITE}/apps/${app.id}.html`, lastmod: appDates.modified, priority: '0.7', changefreq: 'monthly' });
  }
  const appsIndex = appsIndexMd(apps);
  pages.push({
    name: 'apps/index.html',
    content: pageHtml({
      md: appsIndex,
      title: 'Windows 98 programs you can run in your browser',
      description: extractMeta(appsIndex).description,
      urlPath: 'apps/', sourceRel: APP_BLURBS_REL,
      dates: blurbDates,
    }),
  });
  urls.push({ loc: `${SITE}/apps/`, lastmod: blurbDates.modified, priority: '0.8', changefreq: 'monthly' });

  if (compat) {
    const compatDates = { published: gitDate(COMPAT_REL, 'first'), modified: gitDate(COMPAT_REL) };
    for (const t of compat.titles) {
      // A hosted title is answered by its app page. Its compat URL is already
      // indexed and the deploy cannot delete a file, so it keeps serving the
      // same content but names the app page canonical and forwards visitors
      // there, like the articles folded into design/; it leaves the sitemap.
      const host = t.hostId ? `apps/${t.hostId}.html` : null;
      pages.push({
        name: `compat/${t.slug}.html`,
        content: pageHtml({
          md: compatPageMd(t, compat.affiliate),
          title: `Does ${t.title} run in the browser?`,
          description: compatDescription(t),
          urlPath: `compat/${t.slug}.html`, sourceRel: COMPAT_REL,
          dates: compatDates,
          ...(host ? { canonical: host, extraHead: `\n  <meta http-equiv="refresh" content="0; url=/${host}">` } : {}),
          ldExtra: {
            '@type': 'WebPage',
            about: {
              '@type': 'VideoGame', name: t.title, gamePlatform: 'PC', operatingSystem: 'Windows 95, Windows 98',
              ...(t.year ? { datePublished: String(t.year) } : {}),
              ...(t.developer ? { author: { '@type': 'Organization', name: t.developer } } : {}),
              ...(t.publisher ? { publisher: { '@type': 'Organization', name: t.publisher } } : {}),
            },
          },
        }),
      });
      if (!host) urls.push({ loc: `${SITE}/compat/${t.slug}.html`, lastmod: compatDates.modified, priority: '0.6', changefreq: 'monthly' });
    }
    const indexMd = compatIndexMd(compat.titles);
    pages.push({
      name: 'compat/index.html',
      content: pageHtml({
        md: indexMd,
        title: 'Windows games in the browser: compatibility list',
        description: extractMeta(indexMd).description,
        urlPath: 'compat/', sourceRel: COMPAT_REL,
        dates: compatDates,
      }),
    });
    urls.push({ loc: `${SITE}/compat/`, lastmod: compatDates.modified, priority: '0.8', changefreq: 'weekly' });
  }

  const articlesIndexRel = 'articles/README.md';
  if (fs.existsSync(path.join(ROOT, articlesIndexRel))) {
    const md = fs.readFileSync(path.join(ROOT, articlesIndexRel), 'utf-8');
    const meta = extractMeta(md);
    const dates = { published: gitDate(articlesIndexRel, 'first'), modified: gitDate(articlesIndexRel) };
    pages.push({
      name: 'articles/index.html',
      content: pageHtml({
        md, title: meta.title, description: meta.description,
        urlPath: 'articles/', sourceRel: articlesIndexRel,
        canonical: 'design/',
        dates,
      }).replace('class="wrap"', 'class="wrap docs-index"'),
    });
  }

  // Design docs and reverse-engineering notes.
  const docs = listDocs();
  const index = [];
  for (const d of docs) {
    const md = fs.readFileSync(path.join(ROOT, d.rel), 'utf-8');
    const meta = extractMeta(md);
    const dates = { published: gitDate(d.rel, 'first'), modified: gitDate(d.rel) };
    const isIndex = d.rel === 'docs/re-notes/README.md';
    const content = pageHtml({
      md, title: meta.title, description: meta.description,
      urlPath: d.urlPath, sourceRel: d.rel,
      dates,
    });
    pages.push({
      name: d.urlPath,
      content,
    });
    // README.html was the original public route. Berry updates do not delete
    // old files, so keep that URL current while making the directory index the
    // canonical page used by navigation and the sitemap.
    if (isIndex) {
      pages.push({
        name: 'docs/re-notes/README.html',
        content: pageHtml({
          md, title: meta.title, description: meta.description,
          urlPath: 'docs/re-notes/README.html', sourceRel: d.rel,
          canonical: 'docs/re-notes/', dates,
        }),
      });
    }
    urls.push({ loc: `${SITE}/${d.urlPath}`, lastmod: dates.modified, priority: isIndex ? '0.5' : '0.6', changefreq: 'monthly' });
    index.push({ ...d, ...meta, dates });
  }

  // The docs table of contents. Two sections so a reader looking for "how
  // does the emulator work" and one looking for "what did you find inside
  // Diablo" each land on the right list.
  const section = (heading, items) => `## ${heading}\n\n` + items.map(i =>
    `- [${i.title}](/${i.urlPath})${i.description ? `  \n  <small>${i.description}</small>` : ''}`).join('\n') + '\n\n';
  const design = index.filter(i => !i.rel.startsWith('docs/re-notes/'));
  const re = index.filter(i => i.rel.startsWith('docs/re-notes/') && i.rel !== 'docs/re-notes/README.md');
  const docsSections =
    section('Emulator design and performance', design) +
    section('Reverse-engineering notes, one per application', re);
  const docsIntro =
    `These pages are the working notes behind it — the memory map, ` +
    `the interpreter's dispatch and lazy-flag design, the software GDI rasterizer, the DirectX and Win16 layers, ` +
    `the performance ledger, and one file per game or application we have taken apart to make it run. ` +
    `They are rendered from the Markdown in [docs/](${REPO}/tree/main/docs) on GitHub.`;
  const today = new Date().toISOString().slice(0, 10);

  // design/index.html: the one "how it works" hub the Start menu and every
  // page nav point at. Articles first (the readable layer, each answering one
  // question), then the design docs and RE notes (the reference layer). The
  // older articles/ and docs/ indexes keep serving but declare this page
  // canonical, so nothing already indexed or linked breaks.
  const articlesBody = fs.existsSync(path.join(ROOT, articlesIndexRel))
    ? fs.readFileSync(path.join(ROOT, articlesIndexRel), 'utf-8').replace(/^[\s\S]*?(?=^## )/m, '').replace(/^## /gm, '### ')
    : '';
  const designMd = `# How Wine-Assembly works: articles, design docs and reverse-engineering notes\n\n` +
    `Wine-Assembly runs real Windows 98 programs in the browser: an x86 interpreter, a Win32 API layer, ` +
    `a software GDI, DirectX and a 16-bit loader, all written directly in WebAssembly Text. ` +
    `The articles below each answer one question about how that is built and are the place to start; ` +
    `the design docs and per-application reverse-engineering notes after them are the working record ` +
    `the articles are drawn from. [The story](/story.html) tells it in order.\n\n` +
    `## Start here\n\n` +
    `Five pages that cover the whole idea, in the order they build on each other:\n\n` +
    `1. [How to write an x86 interpreter in raw WebAssembly Text](/articles/x86-interpreter-in-webassembly-text.html), the machine everything else runs on.\n` +
    `2. [Implementing the Win32 API in WebAssembly](/articles/win32-api-in-webassembly.html), the operating system the program thinks it is talking to.\n` +
    `3. [A software GDI in WebAssembly](/articles/software-gdi-in-webassembly.html), how pixels get from the program to the canvas.\n` +
    `4. [Wine-Assembly vs v86](/articles/wine-assembly-vs-v86.html), what this approach gives up and gains against booting a real Windows 98.\n` +
    `5. [Building an emulator with AI coding agents](/articles/building-an-emulator-with-ai-coding-agents.html), how it was actually written.\n\n` +
    `## Articles\n\n` + articlesBody.trim() + `\n\n` +
    `## Design docs and reverse-engineering notes\n\n` + docsIntro + `\n\n` + docsSections.replace(/^## /gm, '### ');
  pages.push({
    name: 'design/index.html',
    content: pageHtml({
      md: designMd,
      title: 'How Wine-Assembly works: articles, design docs and reverse-engineering notes',
      description: 'How a Windows 98 emulator in WebAssembly Text works: articles on the x86 interpreter, lazy flags, DLLs, GDI, DirectX and Win16, plus design docs and RE notes.',
      urlPath: 'design/', sourceRel: 'articles/README.md',
      dates: { modified: today },
    }).replace('class="wrap"', 'class="wrap docs-index"'),
  });
  urls.push({ loc: `${SITE}/design/`, priority: '0.8', changefreq: 'weekly' });

  const indexMd = `# Wine-Assembly design docs and reverse-engineering notes\n\n` +
    `Wine-Assembly runs real Windows 98 executables in the browser: an x86 interpreter and a Win32 API layer ` +
    `written directly in WebAssembly Text. ` + docsIntro + `\n\n` + docsSections;
  pages.push({
    name: 'docs/index.html',
    content: pageHtml({
      md: indexMd,
      title: 'Wine-Assembly design docs and reverse-engineering notes',
      description: 'Design docs and reverse-engineering notes for a Windows 98 emulator in WebAssembly Text: memory map, x86 dispatch, lazy flags, software GDI, DirectX, Win16.',
      urlPath: 'docs/', sourceRel: 'docs',
      canonical: 'design/',
      dates: { modified: today },
    }).replace('class="wrap"', 'class="wrap docs-index"'),
  });

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}` +
      `<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n') +
    `\n</urlset>\n`;
  pages.push({ name: 'sitemap.xml', content: sitemap });
  history.save();
  progress(`rendered ${pages.length} pages in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  return pages;
}

function writePages(pages) {
  for (const p of pages) {
    const full = path.join(ROOT, p.name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, p.content);
  }
}

module.exports = { generatePages, writePages, extractMeta, SITE };

if (require.main === module) {
  const pages = generatePages();
  if (process.argv.includes('--list')) {
    for (const p of pages) console.log(`${p.name}  (${p.content.length} bytes)`);
  } else {
    writePages(pages);
    console.log(`wrote ${pages.length} pages (story.html, apps/*.html, articles/*.html, docs/**/*.html, sitemap.xml) and ${OG_DIR}/*.png`);
  }
}
