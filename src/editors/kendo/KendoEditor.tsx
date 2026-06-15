import { useEffect, useRef, useState } from 'react'
import { Editor, EditorTools, EditorUtils } from '@progress/kendo-react-editor'
import { Button } from '@progress/kendo-react-buttons'
import type { EditorView } from '@progress/kendo-editor-common'
import { TEST_HTML } from '../../test-content'
import { formatHTML } from '../../format-html'
import { kendoHTMLToEmail } from './kendo-email'
// KendoReact components are unstyled without a theme stylesheet. The theme is a
// single global ~704 KB CSS file scoped almost entirely to `.k-*` classes (its
// custom properties are `--kendo-*`-namespaced, so it does not collide with the
// app's design tokens). Importing it here loads it globally for the whole app —
// there is no per-component theming. See research/kendo-notes.md (footprint).
import '@progress/kendo-theme-default/dist/all.css'
import './KendoEditor.css'

const {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  OrderedList,
  UnorderedList,
  Indent,
  Outdent,
} = EditorTools

// ---------------------------------------------------------------------------
// Custom block-format tools (H1 / H2 / H3 / Paragraph)
//
// Kendo ships block formatting as a single FormatBlock *dropdown*, not the
// discrete H1/H2/H3/P buttons the control set asks for. Rather than diverge to
// a dropdown, we build four custom tools — the documented Kendo extension path:
// a tool is any component placed in the `tools` array; the Editor re-renders it
// with a fresh `view` prop on every transaction, so active state stays live
// (this is the same mechanism the built-in tools use — no useEditorState
// equivalent needed). Each tool drives Kendo's own ProseMirror helpers:
//   - EditorUtils.formatBlockElements(view, tag) to apply the block type
//   - EditorUtils.getBlockFormats(state) to read the active block type
// ---------------------------------------------------------------------------

type BlockTag = 'p' | 'h1' | 'h2' | 'h3'

interface BlockToolProps {
  view?: EditorView
}

function createBlockTool(tag: BlockTag, label: string, title: string) {
  function BlockTool({ view }: BlockToolProps) {
    const state = view?.state
    const active = state ? EditorUtils.getBlockFormats(state).includes(tag) : false
    return (
      <Button
        type="button"
        togglable
        selected={active}
        disabled={!state}
        // Keep the editor selection on mousedown; run the command on click so
        // keyboard activation (Enter/Space) works too — same split the other
        // exhibits use for toolbar buttons over a contenteditable.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (!view) return
          // Toggle parity with the other exhibits (which use TipTap's
          // toggleHeading): clicking an already-active heading reverts it to a
          // paragraph, matching the pressed/aria-pressed affordance. Paragraph
          // itself is a plain set — there is nothing to toggle it back to.
          const target = active && tag !== 'p' ? 'p' : tag
          EditorUtils.formatBlockElements(view, target)
        }}
        title={title}
        aria-label={title}
        aria-pressed={active}
      >
        {label}
      </Button>
    )
  }
  // Kendo keys each toolbar tool by `displayName || name` (Editor.mjs). All four
  // tools are this same `BlockTool` function, so without a distinct displayName
  // they collide on the key "BlockTool" → React "two children with the same key"
  // warning and unreliable reconciliation. Give each a unique displayName.
  BlockTool.displayName = `BlockTool(${tag})`
  return BlockTool
}

const H1 = createBlockTool('h1', 'H1', 'Heading 1')
const H2 = createBlockTool('h2', 'H2', 'Heading 2')
const H3 = createBlockTool('h3', 'H3', 'Heading 3')
const Paragraph = createBlockTool('p', 'P', 'Paragraph')

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type OutputMode = 'raw' | 'pretty' | 'email-safe'

const INITIAL_CONTENT = '<p>Start typing here…</p>'

export function KendoEditor() {
  const editorRef = useRef<Editor>(null)
  const [rawHTML, setRawHTML] = useState(INITIAL_CONTENT)
  const [outputMode, setOutputMode] = useState<OutputMode>('raw')

  // Kendo fires onChange only on edits, not on mount, so the raw panel would
  // otherwise show the literal INITIAL_CONTENT string rather than what Kendo
  // actually serializes. Seed it from the editor's own output once the view is
  // ready — the equivalent of TipTap's onCreate / React Email's onReady init.
  useEffect(() => {
    const view = editorRef.current?.view
    if (view) setRawHTML(EditorUtils.getHtml(view.state))
  }, [])

  const loadTestContent = () => {
    const view = editorRef.current?.view
    if (!view) return
    EditorUtils.setHtml(view, TEST_HTML)
    setRawHTML(EditorUtils.getHtml(view.state))
  }

  const displayedOutput =
    outputMode === 'raw' ? rawHTML
    : outputMode === 'pretty' ? formatHTML(rawHTML)
    : kendoHTMLToEmail(rawHTML)

  return (
    <div className="kendo-editor-shell">
      <Editor
        ref={editorRef}
        // div edit mode keeps the editable in the page DOM (not an <iframe>),
        // which suits a form-embedded field and lets the page theme it.
        defaultEditMode="div"
        defaultContent={INITIAL_CONTENT}
        onChange={(e) => setRawHTML(e.html)}
        contentStyle={{ minHeight: 220 }}
        // Kendo renders these in its own fixed toolbar (a KendoReact Toolbar);
        // nested arrays become visually separated groups. This satisfies the
        // fixed-toolbar requirement with Kendo's native chrome.
        tools={[
          [Bold, Italic, Underline, Strikethrough],
          [H1, H2, H3, Paragraph],
          [UnorderedList, OrderedList],
          [Indent, Outdent],
        ]}
      />

      <div className="editor-actions">
        <button type="button" className="action-btn" onClick={loadTestContent}>
          Load test content
        </button>
      </div>

      <div className="html-output">
        <div className="html-output-label">
          <span>Generated HTML</span>
          <div className="output-mode-selector" role="group" aria-label="Output mode">
            {(['raw', 'pretty', 'email-safe'] as OutputMode[]).map((mode) => (
              <label key={mode} className="output-mode-option">
                <input
                  type="radio"
                  name="output-mode-kendo"
                  value={mode}
                  checked={outputMode === mode}
                  onChange={() => setOutputMode(mode)}
                />
                <span>{mode === 'email-safe' ? 'Email-safe' : mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
              </label>
            ))}
          </div>
        </div>
        <pre className="html-output-code">{displayedOutput}</pre>
      </div>
    </div>
  )
}
