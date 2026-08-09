import { escapeHtml, linkFootnoteCrossRefs } from "./footnote-format.js";
import { mountTypographyWidget } from "./typography.js?v=2";
import {
  loadBrowseContext,
  nextPoemId,
  poemsIndexHref,
  saveRandomBrowseContext,
} from "./browse-context.js";

mountTypographyWidget();

const params = new URLSearchParams(location.search);
const poemId = params.get("id");
const page = document.getElementById("poem-page");
const nextEl = document.getElementById("next-poem");

async function loadText(folder, file) {
  const url = `poems/${encodeURIComponent(folder)}/${encodeURIComponent(file)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Missing ${file} (${res.status})`);
  return (await res.text()).replace(/\r\n/g, "\n").trimEnd();
}

/** Pull a lone leading year line (e.g. "1914") out of poem body into metadata. */
function extractLeadingYear(text) {
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i += 1;
  const yearMatch = lines[i] && lines[i].trim().match(/^(18\d{2}|19\d{2}|20\d{2})$/);
  if (!yearMatch) {
    return { text: text.trimEnd(), year: 0 };
  }
  i += 1;
  while (i < lines.length && !lines[i].trim()) i += 1;
  return {
    text: lines.slice(i).join("\n").trimEnd(),
    year: Number(yearMatch[1]),
  };
}

/**
 * Split Complete Verse footnote appendix (`---`) from the poem body.
 * Appendix lines look like: `1274 Майванд – место битвы…`
 */
function splitFootnotes(text) {
  const idx = text.search(/\n---\n/);
  if (idx === -1) return { body: text.trimEnd(), footnotes: [] };

  const body = text.slice(0, idx).trimEnd();
  const footnotes = [];
  for (const line of text.slice(idx + 5).split("\n")) {
    const m = line.match(/^(\d{2,4})\s+(.+)$/);
    if (m) footnotes.push({ id: m[1], text: m[2].trim() });
  }
  return { body, footnotes };
}

const SUPER_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const SUPER_TO_ASCII = Object.fromEntries(
  [...SUPER_DIGITS].map((ch, i) => [ch, String(i)])
);

function superRunToId(run) {
  let id = "";
  for (const ch of run) {
    const d = SUPER_TO_ASCII[ch];
    if (d === undefined) return null;
    id += d;
  }
  return id;
}

/**
 * Turn footnote markers into linked superscripts and render the note list.
 * Supports Unicode superscripts (⁸¹⁹) and glued OCR digits (Майванд1274).
 */
function formatTranslationHtml(text, footnotes) {
  const byId = new Map(footnotes.map((f) => [f.id, f.text]));

  function isAsciiFootnoteMarker(text, start, end, id) {
    const n = Number(id);
    if (!(1 <= n && n <= 2500)) return false;
    // Known appendix ids are footnotes even when they look like years (1800–2099).
    if (!byId.has(id) && n >= 1800 && n <= 2099) return false;
    // Biblical chapter:verse — digit:digit (27:8), not footnote then colon (народ1276:)
    if (start > 0 && text[start - 1] === ":" && start >= 2 && /\d/.test(text[start - 2])) {
      return false;
    }
    if (end < text.length && text[end] === ":" && /\d/.test(text[end + 1] || "")) {
      return false;
    }
    // №652
    if (text.slice(Math.max(0, start - 2), start).includes("№")) return false;
    // 1487г
    if (/^\s?г\.?/.test(text.slice(end, end + 3))) return false;
    // 7-10-85
    if (start > 0 && text[start - 1] === "-") return false;
    if (end < text.length && text[end] === "-") return false;
    // (1603 — 1625)
    const before = text.slice(Math.max(0, start - 2), start);
    const after = text.slice(end, end + 3);
    if (before.endsWith("(") && /^\s*[—–-]/.test(after)) return false;
    if (/[—–-]\s*$/.test(before) && (!after || ")\n".includes(after[0]))) return false;
    return true;
  }

  const used = new Set();
  // Placeholder must not contain digit runs after a non-digit (e.g. "FN:819"),
  // or a later ASCII pass / browser null-stripping can leak "FN:" into the text.
  const mark = (id) => `\u0000${id}\u0000`;

  // Glued ASCII OCR markers first (usually 3–4 digits; 1–2 only if listed in appendix).
  let marked = text.replace(/([^\s\d])(\d{1,4})(?!\d)/g, (full, before, id, offset) => {
    if (id.length < 3 && !byId.has(id)) return full;
    const start = offset + before.length;
    const end = start + id.length;
    if (!isAsciiFootnoteMarker(text, start, end, id)) return full;
    used.add(id);
    return `${before}${mark(id)}`;
  });
  // Unicode superscripts (Complete Verse OCR often keeps these).
  marked = marked.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (run) => {
    const id = superRunToId(run);
    if (!id || !/^\d{1,4}$/.test(id)) return run;
    const n = Number(id);
    if (!(1 <= n && n <= 2500)) return run;
    used.add(id);
    return mark(id);
  });

  let html = escapeHtml(marked);
  html = html.replace(/\u0000(\d{1,4})\u0000/g, (_, id) => {
    const tip = byId.has(id) ? ` title="${escapeHtml(byId.get(id))}"` : "";
    return `<sup class="fn-ref"${tip}><a href="#fn-${id}">${id}</a></sup>`;
  });

  // Show every appendix note (title-level notes may have no body marker),
  // plus any body markers still missing from the appendix.
  const notes = footnotes.map((f) => ({ ...f }));
  for (const id of used) {
    if (!notes.some((n) => n.id === id)) notes.push({ id, text: "" });
  }
  notes.sort((a, b) => Number(a.id) - Number(b.id));

  let aside = "";
  if (notes.length) {
    aside = `<aside class="poem-footnotes" aria-label="Footnotes"><ol>${notes
      .map((f) => {
        const body = f.text
          ? linkFootnoteCrossRefs(escapeHtml(f.text), {
              hrefForId: (id) => `footnotes.html#fn-${id}`,
              newWindow: true,
            })
          : "<i>Note missing from source.</i>";
        return `<li id="fn-${f.id}"><span class="poem-footnotes__num">${f.id}</span> ${body}</li>`;
      })
      .join(
        ""
      )}</ol><p class="poem-footnotes__all"><a href="footnotes.html" target="_blank" rel="noopener noreferrer">All footnotes</a></p></aside>`;
  }

  return { html, aside };
}

/**
 * Reshape a translation to follow the English blank-line (stanza) pattern
 * when possible. Leading indentation is not copied — translations stay
 * flush-left so switching translators doesn't shift the left edge.
 *
 * - Exact content-line match → map onto the English blank-line grid.
 * - Translation is a solid block (no stanza breaks) → carve it using
 *   English stanza sizes so bilingual reading stays roughly in sync.
 */
function alignTranslationToOriginal(enText, ruText) {
  const enLines = enText.replace(/\r\n/g, "\n").split("\n");
  const ruRawLines = ruText.replace(/\r\n/g, "\n").trim().split("\n");
  const ruContent = ruRawLines
    .filter((l) => l.trim().length > 0)
    .map((l) => l.replace(/^\s+/, "").trimEnd());
  const enContentCount = enLines.filter((l) => l.trim().length > 0).length;
  // Ignore leading/trailing blanks — only internal gaps count as stanza breaks.
  const ruBlankCount = ruRawLines.filter((l) => !l.trim()).length;

  if (!enContentCount || !ruContent.length) return ruText;

  // 1) Perfect match: copy English blank lines only (no leading indent).
  if (enContentCount === ruContent.length) {
    let i = 0;
    const out = [];
    for (const enLine of enLines) {
      if (!enLine.trim()) {
        out.push("");
        continue;
      }
      out.push(ruContent[i]);
      i += 1;
    }
    return out.join("\n").trimEnd();
  }

  // 2) Solid RU block vs stanza'd English: apply English stanza sizes.
  const enHasStanzas = enLines.some((l) => !l.trim());
  if (enHasStanzas && ruBlankCount === 0) {
    const stanzaSizes = [];
    let size = 0;
    for (const line of enLines) {
      if (line.trim()) size += 1;
      else if (size) {
        stanzaSizes.push(size);
        size = 0;
      }
    }
    if (size) stanzaSizes.push(size);

    let i = 0;
    const out = [];
    for (let s = 0; s < stanzaSizes.length && i < ruContent.length; s += 1) {
      if (s > 0) out.push("");
      const take = Math.min(stanzaSizes[s], ruContent.length - i);
      for (let k = 0; k < take; k += 1) {
        out.push(ruContent[i]);
        i += 1;
      }
    }
    while (i < ruContent.length) {
      out.push(ruContent[i]);
      i += 1;
    }
    return out.join("\n").trimEnd();
  }

  return ruText;
}

function optionLabel(tr) {
  return `${tr.title} — ${tr.translator}`;
}

function translationPaneHtml(tr) {
  const { html, aside } = formatTranslationHtml(tr.text, tr.footnotes || []);
  return `<pre class="poem-col__text">${html}</pre>${aside}`;
}

function buildMobilePanes(enText, translations) {
  const panes = [
    {
      key: "en",
      label: "English",
      sub: "Original",
      body: `<pre class="poem-col__text">${escapeHtml(enText)}</pre>`,
      empty: false,
    },
  ];
  if (!translations.length) {
    panes.push({
      key: "empty",
      label: "Russian",
      sub: "No translation yet",
      body: `<pre class="poem-col__text">No translation in the archive yet.</pre>`,
      empty: true,
    });
    return panes;
  }
  for (const tr of translations) {
    panes.push({
      key: tr.file,
      label: tr.title,
      sub: tr.translator,
      body: translationPaneHtml(tr),
      empty: false,
    });
  }
  return panes;
}

function setupMobileDeck() {
  const track = page.querySelector(".poem-deck__track");
  const dots = [...page.querySelectorAll(".poem-deck__dot")];
  if (!track || !dots.length) return;

  const panes = [...track.querySelectorAll(".poem-pane")];

  function activeIndex() {
    const x = track.scrollLeft;
    const w = track.clientWidth || 1;
    return Math.max(0, Math.min(panes.length - 1, Math.round(x / w)));
  }

  function setActiveDot(i) {
    dots.forEach((dot, di) => {
      const on = di === i;
      dot.classList.toggle("is-active", on);
      dot.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  track.addEventListener(
    "scroll",
    () => {
      setActiveDot(activeIndex());
    },
    { passive: true }
  );

  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      panes[i]?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    });
  });

  setActiveDot(0);
}

function render(poem, enText, translations, activeIndex) {
  const t = translations[activeIndex];
  const options = translations
    .map(
      (tr, i) =>
        `<option value="${i}" ${i === activeIndex ? "selected" : ""}>${escapeHtml(
          optionLabel(tr)
        )}</option>`
    )
    .join("");

  const year = poem.year && poem.year > 0 ? poem.year : "year unknown";
  document.title = `${poem.title} — Rudyard Kipling`;

  const mobilePanes = buildMobilePanes(enText, translations);
  const deckPanes = mobilePanes
    .map(
      (pane, i) => `
        <section class="poem-pane${pane.empty ? " poem-pane--empty" : ""}" data-pane="${i}" aria-label="${escapeHtml(
          pane.sub ? `${pane.label} — ${pane.sub}` : pane.label
        )}">
          <h2 class="poem-col__label">${escapeHtml(pane.label)}</h2>
          ${pane.sub ? `<p class="poem-pane__sub">${escapeHtml(pane.sub)}</p>` : ""}
          ${pane.body}
        </section>`
    )
    .join("");
  const deckDots = mobilePanes
    .map(
      (_, i) =>
        `<button type="button" class="poem-deck__dot${
          i === 0 ? " is-active" : ""
        }" aria-label="Show panel ${i + 1} of ${mobilePanes.length}" aria-selected="${
          i === 0 ? "true" : "false"
        }"></button>`
    )
    .join("");

  page.innerHTML = `
    <header class="poem-page__header">
      <div class="poem-page__header-inner">
        <h1 class="poem-page__title">${escapeHtml(poem.title)}</h1>
        <p class="poem-page__meta">${escapeHtml(poem.author)} · ${year}</p>
      </div>
    </header>

    <div class="poem-deck" aria-roledescription="carousel" aria-label="Original and translations">
      ${
        mobilePanes.length > 1
          ? `<p class="poem-deck__hint">Swipe for translations</p>`
          : ""
      }
      <div class="poem-deck__track" tabindex="0">
        ${deckPanes}
      </div>
      ${
        mobilePanes.length > 1
          ? `<div class="poem-deck__dots" role="tablist" aria-label="Panels">${deckDots}</div>`
          : ""
      }
    </div>

    <div class="poem-columns">
      <section class="poem-col">
        ${
          translations.length
            ? `<div class="poem-page__controls poem-page__controls--spacer" aria-hidden="true"></div>`
            : ""
        }
        <h2 class="poem-col__label">English</h2>
        <pre class="poem-col__text">${escapeHtml(enText)}</pre>
      </section>
      <section class="poem-col ${t ? "" : "poem-col--empty"}">
        ${
          translations.length
            ? `<div class="poem-page__controls">
                <label>
                  <span>Translation</span>
                  <select id="translation-select" title="${escapeHtml(
                    optionLabel(t)
                  )}">${options}</select>
                </label>
              </div>`
            : ""
        }
        <h2 class="poem-col__label">Russian</h2>
        ${
          t
            ? translationPaneHtml(t)
            : `<pre class="poem-col__text">No translation in the archive yet.</pre>`
        }
      </section>
    </div>
  `;

  const select = document.getElementById("translation-select");
  if (select) {
    select.addEventListener("change", () => {
      const i = Number(select.value);
      render(poem, enText, translations, i);
    });
  }
  setupMobileDeck();
}

function goToRandomPoem(poems, exceptId = null) {
  let pool = poems;
  if (exceptId) {
    pool = poems.filter((p) => p.id !== exceptId);
  }
  if (!pool.length) pool = poems;
  if (!pool.length) return;
  saveRandomBrowseContext();
  const poem = pool[Math.floor(Math.random() * pool.length)];
  window.location.href = `poem.html?id=${encodeURIComponent(poem.id)}`;
}

function setupBrowseNav(poems, currentId) {
  const ctx = loadBrowseContext();
  const backEl = document.querySelector('.poem-nav a[href^="index.html"]');
  if (backEl) {
    backEl.href = poemsIndexHref(ctx);
  }
  if (!nextEl || !currentId) return;
  const nextId = nextPoemId(poems, currentId, ctx);
  if (!nextId) {
    nextEl.hidden = true;
    nextEl.removeAttribute("href");
    return;
  }
  nextEl.href = `poem.html?id=${encodeURIComponent(nextId)}`;
  nextEl.hidden = false;
}

const randomEl = document.getElementById("random-poem");

try {
  const index = await fetch("data/poems.json?v=16").then((r) => {
    if (!r.ok) throw new Error(`Could not load poem index (${r.status})`);
    return r.json();
  });
  const poems = index.poems || [];

  if (randomEl) {
    randomEl.addEventListener("click", (event) => {
      event.preventDefault();
      goToRandomPoem(poems, poemId);
    });
  }

  setupBrowseNav(poems, poemId);

  if (!poemId) {
    page.innerHTML = `<p class="poem-page__error">No poem selected. <a href="index.html#poems">Back to the index</a>.</p>`;
  } else {
    const poem = poems.find((p) => p.id === poemId);
    if (!poem) throw new Error("Poem not found");

    const enText = await loadText(poem.id, poem.enFile);
    const translations = [];
    const loadErrors = [];
    for (const tr of poem.translations) {
      try {
        const raw = await loadText(poem.id, tr.file);
        const { text: afterYear, year: bodyYear } = extractLeadingYear(raw);
        const { body, footnotes } = splitFootnotes(afterYear);
        translations.push({
          ...tr,
          year: tr.year && tr.year > 0 ? tr.year : bodyYear,
          text: alignTranslationToOriginal(enText, body),
          footnotes,
        });
      } catch (err) {
        loadErrors.push(`${tr.translator}: ${err.message}`);
        console.warn(`Skipping translation ${tr.file}:`, err);
      }
    }

    // Poem header year is the original only (from en,* filename) — never a translation date.
    render(poem, enText, translations, 0);
    if (loadErrors.length) {
      const note = document.createElement("p");
      note.className = "poem-page__error";
      note.textContent = `Could not load ${loadErrors.length} translation(s): ${loadErrors.join("; ")}`;
      page.prepend(note);
    }
  }
} catch (err) {
  page.innerHTML = `<p class="poem-page__error">${escapeHtml(
    err.message
  )}. <a href="index.html">Back to the index</a>.</p>`;
}
