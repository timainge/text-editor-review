// Shared pretty-printer for the "Pretty" output mode in both editor panels.
// Block-level tags get newline + indentation; inline tags stay on one line.

const BLOCK_TAGS = new Set(['h1', 'h2', 'h3', 'p', 'ul', 'ol', 'li', 'blockquote'])
const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'link', 'meta'])

function serializeNode(node: Node, depth: number): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  if (node.nodeType !== Node.ELEMENT_NODE) return ''

  const el = node as Element
  const tag = el.tagName.toLowerCase()
  const attrStr = Array.from(el.attributes).map(a => `${a.name}="${a.value}"`).join(' ')

  if (VOID_TAGS.has(tag)) {
    return attrStr ? `<${tag} ${attrStr}>` : `<${tag}>`
  }

  const isBlock = BLOCK_TAGS.has(tag)
  const pad = '  '.repeat(depth)
  const openTag = attrStr ? `<${tag} ${attrStr}>` : `<${tag}>`
  const children = Array.from(el.childNodes)
    .map(child => serializeNode(child, isBlock ? depth + 1 : depth))
    .join('')

  if (isBlock) {
    return `\n${pad}${openTag}${children}\n${pad}</${tag}>`
  }
  return `${openTag}${children}</${tag}>`
}

export function formatHTML(html: string): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return Array.from(doc.body.childNodes)
    .map(node => serializeNode(node, 0))
    .join('')
    .trim()
}
