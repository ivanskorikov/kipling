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
let profiles = {};

const HIDE_MS = 180;
let hideTimer = 0;
let popupEl = null;
let popupAnchor = null;

function ensurePopup() {
  if (popupEl) return popupEl;
  popupEl = document.createElement("div");
  popupEl.className = "tr-profile";
  popupEl.setAttribute("role", "tooltip");
  popupEl.lang = "ru";
  popupEl.hidden = true;
  popupEl.addEventListener("mouseenter", cancelHide);
  popupEl.addEventListener("mouseleave", scheduleHide);
  document.body.appendChild(popupEl);
  return popupEl;
}

function cancelHide() {
  window.clearTimeout(hideTimer);
}

function scheduleHide() {
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(hideProfile, HIDE_MS);
}

function hideProfile() {
  window.clearTimeout(hideTimer);
  popupAnchor = null;
  if (popupEl) popupEl.hidden = true;
}

function placePopup(anchor) {
  const pop = ensurePopup();
  const gap = 8;
  const margin = 12;
  const r = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth;
  const ph = pop.offsetHeight;
  let left = r.left;
  let top = r.bottom + gap;
  if (left + pw > window.innerWidth - margin) {
    left = window.innerWidth - pw - margin;
  }
  if (left < margin) left = margin;
  if (top + ph > window.innerHeight - margin) {
    top = r.top - ph - gap;
  }
  if (top < margin) top = margin;
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;
}

function showProfile(anchor) {
  const name = anchor.dataset.translator;
  const profile = profiles[name];
  if (!profile) return;
  cancelHide();
  popupAnchor = anchor;
  const pop = ensurePopup();
  const sourceLabel = profile.source || "Википедия";
  const wiki = profile.url
    ? `<a class="tr-profile__source" href="${escapeHtml(profile.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceLabel)}</a>`
    : "";
  pop.innerHTML = `
    <p class="tr-profile__name">${escapeHtml(profile.fullName || name)}</p>
    ${profile.life ? `<p class="tr-profile__life">${escapeHtml(profile.life)}</p>` : ""}
    <p class="tr-profile__text">${escapeHtml(profile.text)}</p>
    ${wiki}`;
  pop.hidden = false;
  placePopup(anchor);
}

function nameMarkup(t) {
  const hasProfile = Boolean(profiles[t.name]);
  const cls = hasProfile ? "tr-list__name tr-list__name--has-profile" : "tr-list__name";
  const extra = hasProfile
    ? ` data-translator="${escapeHtml(t.name)}" aria-haspopup="true"`
    : "";
  return `<span class="${cls}"${extra}>${escapeHtml(t.name)}</span>`;
}

function render() {
  hideProfile();
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
            ${nameMarkup(t)}
            <span class="tr-list__count">${poemLabel(t.poemCount)}</span>
          </a>
        </li>`;
    })
    .join("");
}

listEl.addEventListener("mouseover", (event) => {
  const nameEl = event.target.closest("[data-translator]");
  if (!nameEl || !listEl.contains(nameEl)) return;
  showProfile(nameEl);
});
listEl.addEventListener("mouseout", (event) => {
  const nameEl = event.target.closest("[data-translator]");
  if (!nameEl) return;
  const next = event.relatedTarget;
  if (next && (nameEl.contains(next) || popupEl?.contains(next))) return;
  scheduleHide();
});
listEl.addEventListener("focusin", (event) => {
  const nameEl =
    event.target.closest("[data-translator]") ||
    event.target.querySelector?.("[data-translator]");
  if (nameEl) showProfile(nameEl);
});
listEl.addEventListener("focusout", (event) => {
  const next = event.relatedTarget;
  if (next && popupEl?.contains(next)) return;
  scheduleHide();
});
window.addEventListener("scroll", hideProfile, { passive: true });
window.addEventListener("resize", hideProfile);

searchEl.addEventListener("input", render);

const [data, profileData] = await Promise.all([
  fetch("data/poems.json?v=22").then((r) => {
    if (!r.ok) throw new Error("Failed to load poems index");
    return r.json();
  }),
  fetch("data/translators.json?v=2")
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({})),
]);
translators = buildTranslatorStats(data.poems || []);
profiles = profileData || {};
render();
