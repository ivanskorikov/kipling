function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeSearch(text) {
  return String(text || "")
    .toLocaleLowerCase("ru-RU")
    .normalize("NFKC")
    .replace(/[«»""„‟‹›''‚‛]/g, "")
    .replace(/[.,:;!?()[\]{}…—–\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function poemLabel(count) {
  if (count === 1) return "1 poem";
  return `${count} poems`;
}

function buildTranslatorStats(poems) {
  const map = new Map();
  for (const poem of poems) {
    const seen = new Set();
    for (const tr of poem.translations || []) {
      const name = (tr.translator || "").trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const entry = map.get(name) || { name, poemCount: 0, translationCount: 0 };
      entry.poemCount += 1;
      map.set(name, entry);
    }
    for (const tr of poem.translations || []) {
      const name = (tr.translator || "").trim();
      if (!name) continue;
      const entry = map.get(name);
      if (entry) entry.translationCount += 1;
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      b.poemCount - a.poemCount ||
      a.name.localeCompare(b.name, "ru", { sensitivity: "base" })
  );
}

const listEl = document.getElementById("tr-list");
const countEl = document.getElementById("tr-count");
const searchEl = document.getElementById("tr-search");

let translators = [];

function render() {
  const q = normalizeSearch(searchEl.value);
  const items = q
    ? translators.filter((t) => normalizeSearch(t.name).includes(q))
    : translators;

  countEl.textContent = q
    ? `${items.length} shown · ${translators.length} translators`
    : `${translators.length} translators · ${translators.reduce((n, t) => n + t.poemCount, 0)} poems`;

  if (!items.length) {
    listEl.innerHTML = `<li class="tr-list__empty">No translators match.</li>`;
    return;
  }

  listEl.innerHTML = items
    .map((t, i) => {
      const href = `index.html?translator=${encodeURIComponent(t.name)}#poems`;
      const delay = Math.min(i, 24) * 14;
      return `
        <li class="tr-list__item" style="animation-delay:${delay}ms">
          <a class="tr-list__link" href="${href}">
            <span class="tr-list__name">${escapeHtml(t.name)}</span>
            <span class="tr-list__count">${poemLabel(t.poemCount)}</span>
          </a>
        </li>`;
    })
    .join("");
}

searchEl.addEventListener("input", render);

const data = await fetch("data/poems.json?v=20").then((r) => {
  if (!r.ok) throw new Error("Failed to load poems index");
  return r.json();
});
translators = buildTranslatorStats(data.poems || []);
render();
