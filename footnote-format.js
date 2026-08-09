/** Shared footnote HTML helpers. */

export function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * After escapeHtml: turn «примеч.1271» / «примеч. 7» into links.
 *
 * @param {string} escapedHtml
 * @param {{ hrefForId?: (id: string) => string, newWindow?: boolean }} [options]
 */
export function linkFootnoteCrossRefs(
  escapedHtml,
  { hrefForId = (id) => `footnotes.html#fn-${id}`, newWindow = false } = {}
) {
  const target = newWindow ? ` target="_blank" rel="noopener noreferrer"` : "";
  return escapedHtml.replace(/(примеч\.?\s*)(\d{1,4})/gi, (_, prefix, id) => {
    return `${prefix}<a class="fn-xref" href="${hrefForId(id)}"${target}>${id}</a>`;
  });
}
