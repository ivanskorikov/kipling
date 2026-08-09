/** Browse order for poem → next-poem navigation (sessionStorage). */

const STORAGE_KEY = "kipling.poemBrowse";

/** Strip leading quotes so “The…” / ‘Bobs’ sort under T / B. */
export function sortTitle(title) {
  return String(title || "")
    .replace(/^[\s«»""„‟‹›『』「」''‚‛‘’“”"']+/u, "")
    .trim();
}

export function compareTitles(a, b) {
  return sortTitle(a).localeCompare(sortTitle(b), "en", { sensitivity: "base" });
}

export const SORTS = {
  "title-asc": (a, b) => compareTitles(a.title, b.title),
  "title-desc": (a, b) => compareTitles(b.title, a.title),
  "year-asc": (a, b) => (a.year || 9999) - (b.year || 9999) || compareTitles(a.title, b.title),
  "year-desc": (a, b) => (b.year || 0) - (a.year || 0) || compareTitles(a.title, b.title),
};

/** Lowercase + strip quotes/punctuation so «Пыль» matches пыль. */
export function normalizeSearch(text) {
  return String(text || "")
    .toLocaleLowerCase("ru-RU")
    .normalize("NFKC")
    .replace(/[«»""„‟‹›''‚‛']/g, "")
    .replace(/[.,:;!?()[\]{}…—–\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function poemHasTranslator(poem, translator) {
  if (!translator) return true;
  return (poem.translations || []).some((tr) => tr.translator === translator);
}

export function poemMatchesQuery(poem, qNorm) {
  if (!qNorm) return true;
  if (normalizeSearch(poem.title).includes(qNorm)) return true;
  return (poem.translations || []).some(
    (tr) =>
      normalizeSearch(tr.title).includes(qNorm) ||
      normalizeSearch(tr.translator).includes(qNorm)
  );
}

/**
 * @param {object[]} poems
 * @param {{ sort?: string, query?: string, withTranslation?: boolean, translator?: string, mode?: string }} ctx
 */
export function filterAndSortPoems(poems, ctx = {}) {
  if (ctx.mode === "random") {
    return [...poems].sort(SORTS["title-asc"]);
  }
  const sortKey = SORTS[ctx.sort] ? ctx.sort : "title-asc";
  const qNorm = normalizeSearch(ctx.query);
  let items = poems;
  if (ctx.withTranslation || ctx.translator) {
    items = items.filter((p) => p.translationCount > 0);
  }
  if (ctx.translator) {
    items = items.filter((p) => poemHasTranslator(p, ctx.translator));
  }
  if (qNorm) {
    items = items.filter((p) => poemMatchesQuery(p, qNorm));
  }
  return [...items].sort(SORTS[sortKey]);
}

export function saveListBrowseContext(state) {
  const ctx = {
    mode: "list",
    sort: state.sort || "title-asc",
    query: state.query || "",
    withTranslation: Boolean(state.withTranslation),
    translator: state.translator || "",
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
}

export function saveRandomBrowseContext() {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: "random" }));
}

export function loadBrowseContext() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const ctx = JSON.parse(raw);
    if (!ctx || typeof ctx !== "object") return null;
    return ctx;
  } catch {
    return null;
  }
}

/** Default when nothing was saved: alphabetical, unfiltered. */
export function effectiveBrowseContext(ctx) {
  if (!ctx || ctx.mode === "random") {
    return {
      mode: "list",
      sort: "title-asc",
      query: "",
      withTranslation: false,
      translator: "",
    };
  }
  return {
    mode: "list",
    sort: SORTS[ctx.sort] ? ctx.sort : "title-asc",
    query: ctx.query || "",
    withTranslation: Boolean(ctx.withTranslation),
    translator: ctx.translator || "",
  };
}

/**
 * @returns {string | null} next poem id, or null if current is last / unknown
 */
export function nextPoemId(poems, currentId, ctx) {
  if (!currentId || !poems.length) return null;
  let ordered = filterAndSortPoems(poems, effectiveBrowseContext(ctx));
  let idx = ordered.findIndex((p) => p.id === currentId);
  if (idx === -1) {
    ordered = filterAndSortPoems(poems, effectiveBrowseContext(null));
    idx = ordered.findIndex((p) => p.id === currentId);
  }
  if (idx === -1 || idx >= ordered.length - 1) return null;
  return ordered[idx + 1].id;
}

/** Index URL that restores list browse state (search / filter / sort). */
export function poemsIndexHref(ctx) {
  if (!ctx || ctx.mode === "random") {
    return "index.html#poems";
  }
  const effective = effectiveBrowseContext(ctx);
  const params = new URLSearchParams();
  if (effective.query) params.set("q", effective.query);
  if (effective.withTranslation) params.set("withTranslation", "1");
  if (effective.translator) params.set("translator", effective.translator);
  if (effective.sort && effective.sort !== "title-asc") params.set("sort", effective.sort);
  const qs = params.toString();
  return qs ? `index.html?${qs}#poems` : "index.html#poems";
}
