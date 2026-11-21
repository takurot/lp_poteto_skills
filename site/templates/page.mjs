import { DEFAULT_LOCALE, GITHUB_URL, PAGES, pageFor } from "../pages.mjs";
import { esc } from "./escape.mjs";
import { documentHtml } from "./layout.mjs";

const list = (items) => ["<ul>", ...items.map((item) => `<li>${esc(item)}</li>`), "</ul>"];

// tabindex lets keyboard users scroll a long command in browsers whose scroll boxes take no focus.
// copy.js reveals the hidden button and copies the code element its aria-describedby names (F4).
function commandBlock(command, id, copy) {
  return [
    '<div class="cmd">',
    `<pre tabindex="0"><code id="${esc(id)}">${esc(command)}</code></pre>`,
    `<button type="button" class="btn btn-secondary btn-sm copy" aria-describedby="${esc(id)}" aria-live="polite" data-copied="${esc(copy.copiedLabel)}" hidden>${esc(copy.buttonLabel)}</button>`,
    "</div>",
  ];
}

const commandBlocks = (commands, idPrefix, copy) => [
  '<div class="commands">',
  ...commands.flatMap((command, index) => commandBlock(command, `${idPrefix}-${index + 1}`, copy)),
  "</div>",
];

function headLines(content, page, siteUrl) {
  const url = `${siteUrl}${page.path}`;
  const alternates = [
    ...PAGES.map((other) => ({ hreflang: other.locale, path: other.path })),
    { hreflang: "x-default", path: pageFor(DEFAULT_LOCALE).path },
  ];
  return [
    `<link rel="canonical" href="${esc(url)}">`,
    ...alternates.map(({ hreflang, path }) => `<link rel="alternate" hreflang="${esc(hreflang)}" href="${esc(`${siteUrl}${path}`)}">`),
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${esc(content.meta.og.title)}">`,
    `<meta property="og:description" content="${esc(content.meta.og.description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(`${siteUrl}/og.png`)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    '<script src="/copy.js" defer></script>',
  ];
}

function header(content, page) {
  const switchTargets = PAGES.filter((other) => other.locale !== page.locale);
  return [
    '<header class="site-header">',
    '<div class="wrap bar">',
    `<a class="wordmark" href="${esc(page.path)}">${esc(content.header.wordmark)}</a>`,
    `<nav class="nav" aria-label="${esc(content.header.navLabel)}">`,
    ...switchTargets.map(
      (other) =>
        `<a class="btn btn-ghost" href="${esc(other.path)}" hreflang="${esc(other.locale)}" lang="${esc(other.locale)}">${esc(content.header.languageSwitchLabel)}</a>`,
    ),
    `<a class="btn btn-ghost" href="${esc(GITHUB_URL)}">${esc(content.header.githubLabel)}</a>`,
    "</nav>",
    "</div>",
    "</header>",
  ];
}

function hero({ hero }) {
  return [
    '<section id="hero" class="hero" aria-labelledby="hero-title">',
    '<div class="wrap">',
    `<p class="overline">${esc(hero.overline)}</p>`,
    `<h1 id="hero-title" class="hero-title">${esc(hero.heading)}</h1>`,
    `<p class="lead">${esc(hero.lead)}</p>`,
    `<a class="btn btn-primary" href="${esc(GITHUB_URL)}">${esc(hero.ctaLabel)}</a>`,
    "</div>",
    "</section>",
  ];
}

function numbers({ numbers }) {
  return [
    '<section id="numbers" aria-labelledby="numbers-title">',
    '<div class="wrap">',
    `<h2 id="numbers-title" class="visually-hidden">${esc(numbers.heading)}</h2>`,
    '<ul class="stats">',
    ...numbers.items.map(
      ({ value, label }) => `<li><strong class="stat-value">${esc(value)}</strong> <span class="stat-label">${esc(label)}</span></li>`,
    ),
    "</ul>",
    "</div>",
    "</section>",
  ];
}

function install({ install, copy }) {
  return [
    '<section id="install" class="section" aria-labelledby="install-title">',
    '<div class="wrap">',
    `<h2 id="install-title">${esc(install.heading)}</h2>`,
    `<p>${esc(install.intro)}</p>`,
    ...commandBlocks(install.commands, "install-cmd", copy),
    ...install.examples.flatMap(({ label, command }, index) => [
      '<div class="example">',
      `<p class="note">${esc(label)}</p>`,
      ...commandBlock(command, `install-example-${index + 1}`, copy),
      "</div>",
    ]),
    `<p>${esc(install.defaultSetNote)}</p>`,
    "</div>",
    "</section>",
  ];
}

function codex({ codex, copy }) {
  return [
    '<section id="codex" class="section" aria-labelledby="codex-title">',
    '<div class="wrap">',
    `<h2 id="codex-title">${esc(codex.heading)}</h2>`,
    `<p>${esc(codex.intro)}</p>`,
    ...commandBlocks(codex.commands, "codex-cmd", copy),
    `<p id="codex-plugins-label" class="overline">${esc(codex.pluginsLabel)}</p>`,
    '<ul class="chips" aria-labelledby="codex-plugins-label">',
    ...codex.plugins.map((plugin) => `<li>${esc(plugin)}</li>`),
    "</ul>",
    `<p class="aside">${esc(codex.codexHooksNote)}</p>`,
    "</div>",
    "</section>",
  ];
}

function sections(content) {
  const { converts, boundaries, footer } = content;
  return [
    "<main>",
    ...hero(content),
    ...numbers(content),
    ...install(content),
    ...codex(content),
    '<section id="converts">',
    `<h2>${esc(converts.heading)}</h2>`,
    "<table>",
    "<tbody>",
    ...converts.rows.map(({ from, to }) => `<tr><th scope="row">${esc(from)}</th><td>${esc(to)}</td></tr>`),
    "</tbody>",
    "</table>",
    "</section>",
    '<section id="boundaries">',
    `<h2>${esc(boundaries.heading)}</h2>`,
    ...list(boundaries.items),
    "</section>",
    `<blockquote><p>${esc(content.pullQuote)}</p></blockquote>`,
    "</main>",
    "<footer>",
    `<p>${esc(footer.license)}</p>`,
    `<p>${esc(footer.credits)}</p>`,
    `<p>${esc(footer.copyrightHolders)}</p>`,
    `<a href="${esc(GITHUB_URL)}">${esc(footer.githubLabel)}</a>`,
    "</footer>",
  ];
}

// Pure: the same (content, locale, ctx) always yields the same string.
export function renderPage(content, locale, { siteUrl }) {
  const page = pageFor(locale);
  return documentHtml({
    lang: locale,
    title: content.meta.title,
    description: content.meta.description,
    headLines: headLines(content, page, siteUrl),
    bodyLines: [...header(content, page), ...sections(content)],
  });
}
