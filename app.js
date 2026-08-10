import {
  SORTS,
  filterAndSortPoems,
  normalizeSearch,
  saveListBrowseContext,
  saveRandomBrowseContext,
} from "./browse-context.js";

const state = {
  poems: [],
  sort: "title-asc",
  query: "",
  withTranslation: false,
  translator: "",
};

const listEl = document.getElementById("poem-list");
const countEl = document.getElementById("poem-count");
const searchEl = document.getElementById("search");
const filterEl = document.getElementById("with-translation");
const translatorEl = document.getElementById("translator-filter");
const randomEl = document.getElementById("random-poem");

function yearLabel(year) {
  return year && year > 0 ? String(year) : "—";
}

function translationLabel(count) {
  if (!count) return "";
  if (count === 1) return "1 translation";
  return `${count} translations`;
}

function matchingRussianTitles(poem, qNorm) {
  if (!qNorm) return [];
  const seen = new Set();
  const matches = [];
  for (const tr of poem.translations || []) {
    const title = tr.title || "";
    if (!normalizeSearch(title).includes(qNorm)) continue;
    const key = title.toLocaleLowerCase("ru-RU");
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push(title);
  }
  return matches;
}

function matchingTranslators(poem, qNorm) {
  if (!qNorm) return [];
  const seen = new Set();
  const matches = [];
  for (const tr of poem.translations || []) {
    const name = tr.translator || "";
    if (!normalizeSearch(name).includes(qNorm)) continue;
    const key = name.toLocaleLowerCase("ru-RU");
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push(name);
  }
  return matches;
}

function titlesForTranslator(poem, translator) {
  if (!translator) return [];
  const seen = new Set();
  const titles = [];
  for (const tr of poem.translations || []) {
    if (tr.translator !== translator) continue;
    const title = tr.title || "";
    const key = title.toLocaleLowerCase("ru-RU");
    if (!title || seen.has(key)) continue;
    seen.add(key);
    titles.push(title);
  }
  return titles;
}

function uniqueTranslators(poems) {
  const names = new Set();
  for (const poem of poems) {
    for (const tr of poem.translations || []) {
      if (tr.translator) names.add(tr.translator);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b, "ru", { sensitivity: "base" }));
}

function visiblePoems() {
  return filterAndSortPoems(state.poems, state);
}

function syncBrowseUrl() {
  const url = new URL(window.location.href);
  if (state.query) url.searchParams.set("q", state.query);
  else url.searchParams.delete("q");
  if (state.withTranslation) url.searchParams.set("withTranslation", "1");
  else url.searchParams.delete("withTranslation");
  if (state.translator) url.searchParams.set("translator", state.translator);
  else url.searchParams.delete("translator");
  if (state.sort && state.sort !== "title-asc") url.searchParams.set("sort", state.sort);
  else url.searchParams.delete("sort");
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) {
    history.replaceState(null, "", next);
  }
}

function populateTranslatorFilter(selected) {
  const names = uniqueTranslators(state.poems);
  const options = [
    `<option value="">All translators</option>`,
    ...names.map(
      (name) =>
        `<option value="${escapeHtml(name)}"${name === selected ? " selected" : ""}>${escapeHtml(
          name
        )}</option>`
    ),
  ];
  translatorEl.innerHTML = options.join("");
  if (selected && names.includes(selected)) {
    translatorEl.value = selected;
    state.translator = selected;
  } else {
    translatorEl.value = "";
    state.translator = "";
  }
}

function render() {
  const qNorm = normalizeSearch(state.query);
  const items = visiblePoems();
  const total = state.poems.length;
  const withTr = state.poems.filter((p) => p.translationCount > 0).length;
  const filtered = Boolean(state.withTranslation || state.query || state.translator);
  countEl.textContent = filtered
    ? `${items.length} shown · ${total} total`
    : `${total} poems · ${withTr} with translation`;

  if (!items.length) {
    listEl.innerHTML = `<li class="poem-list__empty">No poems match.</li>`;
    return;
  }

  const html = items
    .map((poem, i) => {
      const badge = translationLabel(poem.translationCount);
      const ruMatches = state.translator
        ? titlesForTranslator(poem, state.translator)
        : matchingRussianTitles(poem, qNorm);
      const trMatches = state.translator
        ? [state.translator]
        : matchingTranslators(poem, qNorm);
      const ruLine = ruMatches.length
        ? `<span class="poem-list__ru">${escapeHtml(ruMatches.join(" · "))}</span>`
        : "";
      const trLine = trMatches.length
        ? `<span class="poem-list__translator">${escapeHtml(trMatches.join(" · "))}</span>`
        : "";
      const delay = Math.min(i, 24) * 18;
      return `
        <li class="poem-list__item" style="animation-delay:${delay}ms">
          <a class="poem-list__link" href="poem.html?id=${encodeURIComponent(poem.id)}">
            <span class="poem-list__title">${escapeHtml(poem.title)}</span>
            <span class="poem-list__meta">${yearLabel(poem.year)}</span>
            ${ruLine}
            ${trLine}
            ${badge ? `<span class="poem-list__badge">${badge}</span>` : ""}
          </a>
        </li>`;
    })
    .join("");
  listEl.innerHTML = html;
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function parseSortKey(sortKey) {
  const key = SORTS[sortKey] ? sortKey : "title-asc";
  const [field, dir] = key.split("-");
  return { field: field === "year" ? "year" : "title", dir: dir === "desc" ? "desc" : "asc" };
}

function setSort(sortKey, { renderList = true } = {}) {
  state.sort = SORTS[sortKey] ? sortKey : "title-asc";
  const { field, dir } = parseSortKey(state.sort);
  const arrow = dir === "desc" ? "↓" : "↑";
  document.querySelectorAll(".sort").forEach((btn) => {
    const btnField = btn.dataset.sortKey;
    const active = btnField === field;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
    const dirEl = btn.querySelector(".sort__dir");
    if (dirEl) {
      dirEl.textContent = active ? arrow : "↑";
      dirEl.hidden = !active;
    }
    if (btnField === "title") {
      btn.setAttribute(
        "aria-label",
        active
          ? dir === "desc"
            ? "Sort by title, Z to A"
            : "Sort by title, A to Z"
          : "Sort by title"
      );
    } else if (btnField === "year") {
      btn.setAttribute(
        "aria-label",
        active
          ? dir === "desc"
            ? "Sort by year, newest first"
            : "Sort by year, oldest first"
          : "Sort by year"
      );
    }
  });
  if (renderList) render();
}

document.querySelectorAll(".sort").forEach((btn) => {
  btn.addEventListener("click", () => {
    const field = btn.dataset.sortKey === "year" ? "year" : "title";
    const current = parseSortKey(state.sort);
    let next;
    if (current.field === field) {
      next = `${field}-${current.dir === "asc" ? "desc" : "asc"}`;
    } else {
      next = `${field}-asc`;
    }
    setSort(next);
    syncBrowseUrl();
  });
});

searchEl.addEventListener("input", () => {
  state.query = searchEl.value;
  syncBrowseUrl();
  render();
});

filterEl.addEventListener("change", () => {
  state.withTranslation = filterEl.checked;
  syncBrowseUrl();
  render();
});

translatorEl.addEventListener("change", () => {
  state.translator = translatorEl.value;
  syncBrowseUrl();
  render();
});

listEl.addEventListener("click", (event) => {
  const link = event.target.closest("a.poem-list__link");
  if (!link) return;
  saveListBrowseContext(state);
});

function goToRandomPoem() {
  const pool = state.poems;
  if (!pool.length) return;
  saveRandomBrowseContext();
  const poem = pool[Math.floor(Math.random() * pool.length)];
  window.location.href = `poem.html?id=${encodeURIComponent(poem.id)}`;
}

if (randomEl) {
  randomEl.addEventListener("click", (event) => {
    event.preventDefault();
    goToRandomPoem();
  });
}

const params = new URLSearchParams(window.location.search);
const initialTranslator = params.get("translator") || "";
const initialQuery = params.get("q") || "";
const initialWithTranslation = params.get("withTranslation") === "1";
const initialSort = params.get("sort") || "title-asc";

const data = await fetch("data/poems.json?v=22").then((r) => {
  if (!r.ok) throw new Error("Failed to load poems index");
  return r.json();
});
state.poems = data.poems;
state.query = initialQuery;
state.withTranslation = initialWithTranslation;
searchEl.value = initialQuery;
filterEl.checked = initialWithTranslation;
setSort(initialSort, { renderList: false });
populateTranslatorFilter(initialTranslator);
syncBrowseUrl();
render();
