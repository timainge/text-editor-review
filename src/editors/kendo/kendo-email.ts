// Email-safe path for the KendoReact Editor exhibit.
//
// Kendo's content model is a plain HTML string (read via EditorUtils.getHtml),
// so the email-safe target is reached by reusing the shared, DOM-walking
// `styleHTMLForEmail` from src/email-serializer.ts — the same path the React
// Email exhibit uses. The only Kendo-specific work is normalising the handful
// of tags Kendo emits that differ from the canonical set `styleHTMLForEmail`
// keys off:
//
//   - Strikethrough: Kendo's default schema serialises the strike mark as
//     `<del>` (confirmed in-browser against TEST_HTML). `styleHTMLForEmail`
//     only special-cases `<s>` for the GMX/Web.de double-wrap, so we rename
//     `<del>` → `<s>` first.
//   - Block indent: Kendo's Indent tool writes inline `style="margin-left:…"`
//     on `<p>`/`<h*>` (margin-left, already email-safe — never text-indent).
//     `styleHTMLForEmail` preserves that margin-left when it overwrites the
//     style attribute, so no work is needed here.
//
// This normalisation is editor-specific, so it lives in the editor's own
// folder rather than being pushed into the shared serializer (which the other
// two exhibits depend on). See research/kendo-notes.md.

import { styleHTMLForEmail } from '../../email-serializer'

// Tags Kendo may emit that map onto a canonical tag styleHTMLForEmail handles.
const TAG_ALIASES: Record<string, string> = {
  del: 's',
  strike: 's',
  b: 'strong',
  i: 'em',
}

function renameTag(el: Element, newTag: string): Element {
  const replacement = el.ownerDocument.createElement(newTag)
  while (el.firstChild) replacement.appendChild(el.firstChild)
  for (const attr of Array.from(el.attributes)) {
    replacement.setAttribute(attr.name, attr.value)
  }
  el.replaceWith(replacement)
  return replacement
}

function normalizeKendoTags(root: ParentNode): void {
  // Snapshot first — we mutate the tree as we go.
  for (const el of Array.from(root.querySelectorAll(Object.keys(TAG_ALIASES).join(',')))) {
    renameTag(el, TAG_ALIASES[el.tagName.toLowerCase()])
  }
}

export function kendoHTMLToEmail(html: string): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  normalizeKendoTags(doc.body)
  return styleHTMLForEmail(doc.body.innerHTML)
}
