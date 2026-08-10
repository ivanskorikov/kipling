import { escapeHtml, linkFootnoteCrossRefs } from "./footnote-format.js";

const listEl = document.getElementById("fn-list");
const countEl = document.getElementById("fn-count");
const searchEl = document.getElementById("fn-search");

try {
  const data = await fetch("data/footnotes.json?v=5").then((r) => {
    if (!r.ok) throw new Error(`Could not load footnotes (${r.status})`);
    return r.json();
  });
  const footnotes = data.footnotes || [];
  listEl.innerHTML = footnotes
    .map(
      (fn) => `<li class="fn-list__item" id="fn-${fn.id}" data-num="${fn.id}">
    <div class="fn-list__num"><a href="#fn-${fn.id}">${fn.id}</a></div>
    <div class="fn-list__text">${linkFootnoteCrossRefs(escapeHtml(fn.text), {
      hrefForId: (id) => `#fn-${id}`,
    })}</div>
  </li>`
    )
    .join("");
  countEl.textContent = `${footnotes.length} notes from Complete Verse`;

  searchEl.addEventListener("input", () => {
    const q = searchEl.value.trim().toLowerCase();
    let visible = 0;
    for (const li of listEl.querySelectorAll(".fn-list__item")) {
      const body = li.querySelector(".fn-list__text")?.textContent.toLowerCase() || "";
      const match = !q || li.dataset.num.includes(q) || body.includes(q);
      li.classList.toggle("is-hidden", !match);
      if (match) visible += 1;
    }
    countEl.textContent = q
      ? `${visible} of ${footnotes.length} notes`
      : `${footnotes.length} notes from Complete Verse`;
  });

  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView({ block: "center" });
  }
} catch (err) {
  countEl.textContent = "";
  listEl.innerHTML = `<p class="fn-page__empty">${escapeHtml(err.message)}</p>`;
}
