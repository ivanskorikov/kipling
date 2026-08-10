/**
 * Reader typography controls.
 *
 * Fonts in fonts/ and Cyrillic support (fontTools cmap check):
 *   INCLUDE — EB Garamond, Old Standard TT
 *   EXCLUDE (no Cyrillic) — Libre Baskerville, Libre Caslon Text, Sorts Mill Goudy
 *
 * Default is EB Garamond (Libre Baskerville was requested but has no Cyrillic).
 */

const STORAGE_KEY = "kipling-typo-v2";

/** Only families with Cyrillic glyphs + system default. */
export const READER_FONTS = [
  { id: "eb-garamond", label: "EB Garamond", stack: '"EB Garamond", serif' },
  { id: "old-standard", label: "Old Standard TT", stack: '"Old Standard TT", serif' },
  { id: "system", label: "System default", stack: "system-ui, -apple-system, Segoe UI, sans-serif" },
];

/** Documented local fonts that must not appear in the selector. */
export const FONTS_WITHOUT_CYRILLIC = [
  "Libre Baskerville",
  "Libre Caslon Text",
  "Sorts Mill Goudy",
];

const DEFAULTS = {
  fontId: "eb-garamond",
  sizePx: 24,
  bold: false,
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    const fontOk = READER_FONTS.some((f) => f.id === parsed.fontId);
    return {
      fontId: fontOk ? parsed.fontId : DEFAULTS.fontId,
      sizePx: clampSize(Number(parsed.sizePx) || DEFAULTS.sizePx),
      bold: Boolean(parsed.bold),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clampSize(n) {
  return Math.min(32, Math.max(12, Math.round(n)));
}

function fontStack(fontId) {
  return (READER_FONTS.find((f) => f.id === fontId) || READER_FONTS[0]).stack;
}

export function applyTypography(state) {
  const root = document.documentElement;
  root.style.setProperty("--poem-font", fontStack(state.fontId));
  root.style.setProperty("--poem-font-size", `${state.sizePx}px`);
  root.style.setProperty("--poem-font-weight", state.bold ? "700" : "400");
}

export function mountTypographyWidget(target = document.body) {
  const state = loadState();
  applyTypography(state);

  const root = document.createElement("div");
  root.className = "typo-widget";
  root.innerHTML = `
    <button type="button" class="typo-widget__toggle" aria-expanded="false" aria-controls="typo-panel" title="Typography">
      <span class="typo-widget__toggle-icon" aria-hidden="true">Aa</span>
      <span class="visually-hidden">Typography settings</span>
    </button>
    <div class="typo-widget__panel" id="typo-panel" hidden role="dialog" aria-label="Typography settings">
      <label class="typo-widget__row">
        <span class="typo-widget__label">Font</span>
        <select class="typo-widget__select" id="typo-font">
          ${READER_FONTS.map(
            (f) =>
              `<option value="${f.id}" ${f.id === state.fontId ? "selected" : ""}>${f.label}</option>`
          ).join("")}
        </select>
      </label>
      <div class="typo-widget__row typo-widget__row--size">
        <span class="typo-widget__label">Size</span>
        <div class="typo-widget__size">
          <button type="button" class="typo-widget__btn" id="typo-smaller" aria-label="Smaller">−</button>
          <span class="typo-widget__size-value" id="typo-size">${state.sizePx}</span>
          <button type="button" class="typo-widget__btn" id="typo-larger" aria-label="Larger">+</button>
        </div>
      </div>
      <label class="typo-widget__row typo-widget__row--bold">
        <span class="typo-widget__label">Weight</span>
        <button type="button" class="typo-widget__bold ${state.bold ? "is-on" : ""}" id="typo-bold" aria-pressed="${state.bold}">
          Bold
        </button>
      </label>
    </div>
  `;
  target.appendChild(root);

  const toggle = root.querySelector(".typo-widget__toggle");
  const panel = root.querySelector(".typo-widget__panel");
  const fontSelect = root.querySelector("#typo-font");
  const sizeEl = root.querySelector("#typo-size");
  const boldBtn = root.querySelector("#typo-bold");

  function sync() {
    applyTypography(state);
    saveState(state);
    sizeEl.textContent = String(state.sizePx);
    boldBtn.classList.toggle("is-on", state.bold);
    boldBtn.setAttribute("aria-pressed", String(state.bold));
    fontSelect.value = state.fontId;
  }

  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    root.classList.toggle("is-open", open);
  }

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(panel.hidden);
  });

  panel.addEventListener("click", (e) => e.stopPropagation());

  document.addEventListener("click", () => {
    if (!panel.hidden) setOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) setOpen(false);
  });

  fontSelect.addEventListener("change", () => {
    state.fontId = fontSelect.value;
    sync();
  });

  root.querySelector("#typo-smaller").addEventListener("click", () => {
    state.sizePx = clampSize(state.sizePx - 1);
    sync();
  });

  root.querySelector("#typo-larger").addEventListener("click", () => {
    state.sizePx = clampSize(state.sizePx + 1);
    sync();
  });

  boldBtn.addEventListener("click", () => {
    state.bold = !state.bold;
    sync();
  });

  return root;
}
