import type { JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import {
  renderToHTMLString,
  serializeChildrenToHTMLString,
} from '@tiptap/static-renderer/pm/html-string'
import type { Node as PmNode, Mark as PmMark } from '@tiptap/pm/model'
import type { NodeProps, MarkProps } from '@tiptap/static-renderer'

type NodeRenderer = (ctx: NodeProps<PmNode, string | string[]>) => string
type MarkRenderer = (ctx: MarkProps<PmMark, string | string[], PmNode>) => string

const nodeMapping: Record<string, NodeRenderer> = {
  doc({ children }) {
    return serializeChildrenToHTMLString(children)
  },

  paragraph({ children }) {
    return `<p style="margin:0;padding:0;font-size:1em;line-height:1.6;padding-top:0.5em;padding-bottom:0.5em">${serializeChildrenToHTMLString(children)}</p>`
  },

  heading({ node, children }) {
    const level = (node.attrs?.level as number) ?? 1
    const styles: Record<number, string> = {
      1: 'font-size:2em;font-weight:bold;line-height:1.3;margin-top:0;margin-bottom:0.5em;mso-line-height-rule:exactly',
      2: 'font-size:1.5em;font-weight:bold;line-height:1.3;margin-top:0;margin-bottom:0.4em;mso-line-height-rule:exactly',
      3: 'font-size:1.17em;font-weight:bold;line-height:1.3;margin-top:0;margin-bottom:0.3em;mso-line-height-rule:exactly',
    }
    const style = styles[level] ?? styles[3]
    return `<h${level} style="${style}">${serializeChildrenToHTMLString(children)}</h${level}>`
  },

  bulletList({ children }) {
    return `<ul style="margin:0;padding:0 0 0 1.5em">${serializeChildrenToHTMLString(children)}</ul>`
  },

  orderedList({ children }) {
    return `<ol style="margin:0;padding:0 0 0 1.5em">${serializeChildrenToHTMLString(children)}</ol>`
  },

  listItem({ children }) {
    return `<li style="margin-bottom:0.25em;mso-special-format:bullet">${serializeChildrenToHTMLString(children)}</li>`
  },

  hardBreak() {
    return '<br>'
  },

  text({ node }) {
    return node.text ?? ''
  },
}

const markMapping: Record<string, MarkRenderer> = {
  bold({ children }) {
    return `<strong style="font-weight:bold">${serializeChildrenToHTMLString(children)}</strong>`
  },

  italic({ children }) {
    return `<em style="font-style:italic">${serializeChildrenToHTMLString(children)}</em>`
  },

  underline({ children }) {
    return `<u style="text-decoration:underline">${serializeChildrenToHTMLString(children)}</u>`
  },

  strike({ children }) {
    // Double-wrap: outer <s> for clients that support it semantically;
    // inner <span> is the fallback for GMX/Web.de which strip <s> entirely.
    return `<s><span style="text-decoration:line-through">${serializeChildrenToHTMLString(children)}</span></s>`
  },
}

// Any node type not in nodeMapping (e.g. react-email's custom "container",
// "section", "button" nodes) is passed through by rendering its children.
const nodeMappingWithFallback = new Proxy(nodeMapping, {
  get(target, key: string) {
    return (
      target[key] ??
      (({ children }: NodeProps<PmNode, string | string[]>) =>
        serializeChildrenToHTMLString(children))
    )
  },
})

const extensions = [StarterKit, Underline]

const EMAIL_STYLES: Record<string, string> = {
  p: 'margin:0;padding:0;font-size:1em;line-height:1.6;padding-top:0.5em;padding-bottom:0.5em',
  h1: 'font-size:2em;font-weight:bold;line-height:1.3;margin-top:0;margin-bottom:0.5em;mso-line-height-rule:exactly',
  h2: 'font-size:1.5em;font-weight:bold;line-height:1.3;margin-top:0;margin-bottom:0.4em;mso-line-height-rule:exactly',
  h3: 'font-size:1.17em;font-weight:bold;line-height:1.3;margin-top:0;margin-bottom:0.3em;mso-line-height-rule:exactly',
  ul: 'margin:0;padding:0 0 0 1.5em',
  ol: 'margin:0;padding:0 0 0 1.5em',
  li: 'margin-bottom:0.25em;mso-special-format:bullet',
  strong: 'font-weight:bold',
  em: 'font-style:italic',
  u: 'text-decoration:underline',
}

function applyEmailStyles(el: Element): void {
  const tag = el.tagName.toLowerCase()
  if (EMAIL_STYLES[tag]) el.setAttribute('style', EMAIL_STYLES[tag])
  if (tag === 's') {
    el.innerHTML = `<span style="text-decoration:line-through">${el.innerHTML}</span>`
  } else {
    Array.from(el.children).forEach(applyEmailStyles)
  }
}

export function styleHTMLForEmail(html: string): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  Array.from(doc.body.children).forEach(applyEmailStyles)
  return doc.body.innerHTML
}

export function serializeToEmailHTML(json: JSONContent): string {
  return renderToHTMLString({
    content: json,
    extensions,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: { nodeMapping: nodeMappingWithFallback, markMapping } as any,
  })
}
