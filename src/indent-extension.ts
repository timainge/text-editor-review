import { Extension } from '@tiptap/core'
import type { Command } from '@tiptap/core'

// Text indentation for non-list blocks. Each indent level renders as
// margin-left:{level * 2}em — margin-left (not text-indent) because it is
// safe across email clients, including Outlook.
//
// Shared between the TipTap editor (src/editors/tiptap/TipTapEditor.tsx) and
// the email serializer (src/email-serializer.ts): the serializer builds its
// own schema from extensions, so the `indent` attribute must be registered
// there too or Node.fromJSON would drop it.

export const MAX_INDENT = 4

const INDENT_TYPES = ['paragraph', 'heading']

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      /**
       * Increase the text indent of the selected paragraph/heading blocks
       */
      indent: () => ReturnType
      /**
       * Decrease the text indent of the selected paragraph/heading blocks
       */
      outdent: () => ReturnType
    }
  }
}

const clamp = (value: number) => Math.min(MAX_INDENT, Math.max(0, value))

const changeIndent =
  (delta: number): Command =>
  ({ tr, state, dispatch }) => {
    const { from, to } = state.selection
    let changed = false
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (!INDENT_TYPES.includes(node.type.name)) return
      // Blocks inside list items are indented via sinkListItem/liftListItem,
      // not text indent.
      if (state.doc.resolve(pos).parent.type.name === 'listItem') return
      const current = (node.attrs.indent as number) ?? 0
      const next = clamp(current + delta)
      if (next === current) return
      changed = true
      if (dispatch) tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next })
    })
    return changed
  }

export const Indent = Extension.create({
  name: 'indent',

  addGlobalAttributes() {
    return [
      {
        types: INDENT_TYPES,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const margin = parseFloat(element.style.marginLeft)
              return Number.isNaN(margin) ? 0 : clamp(Math.round(margin / 2))
            },
            renderHTML: (attributes) => {
              const indent = (attributes.indent as number) ?? 0
              if (indent <= 0) return {}
              return { style: `margin-left:${indent * 2}em` }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      indent: () => changeIndent(1),
      outdent: () => changeIndent(-1),
    }
  },
})
