import { useRef, useState, useCallback } from 'react'
import { useCurrentEditor, useEditorState } from '@tiptap/react'
import { EmailEditor, type EmailEditorRef } from '@react-email/editor'
import { TEST_HTML } from '../../test-content'
import { styleHTMLForEmail } from '../../email-serializer'
import { formatHTML } from '../../format-html'
import './ReactEmailEditor.css'

// ---------------------------------------------------------------------------
// Fixed toolbar — rendered as a child of EmailEditor so it lives inside the
// TipTap EditorProvider context and can use useCurrentEditor.
//
// Note: TipTap's EditorProvider renders children *after* the EditorContent
// div in the DOM. We use `order: -1` in CSS to reorder the toolbar visually
// above the content area without touching the DOM structure.
// ---------------------------------------------------------------------------

type HeadingLevel = 1 | 2 | 3

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  children,
  ...aria
}: {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  'aria-label': string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      // Prevent the editor from losing focus (and selection) on mousedown.
      // Without this, the selection is cleared before onClick fires.
      // The command itself runs in onClick so keyboard activation
      // (Enter/Space) works too — onMouseDown never fires for keyboards.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      data-active={isActive || undefined}
      className="toolbar-btn"
      {...aria}
    >
      {children}
    </button>
  )
}

function ToolbarSeparator() {
  return <div className="toolbar-sep" role="separator" aria-orientation="vertical" />
}

// ---------------------------------------------------------------------------
// Text indent helpers (hybrid indent buttons)
//
// Custom TipTap extensions: @react-email/editor v1.5.4 DOES expose an
// `extensions?: Extensions` prop on EmailEditor (dist/index.d.mts), but it
// REPLACES the built-in extension set rather than extending it — in
// dist/index.mjs the editor does `extensionsProp ?? [StarterKit, Placeholder,
// EmailTheming]`. Passing our own indent extension would mean rebuilding and
// maintaining their entire email schema, so we don't.
//
// Instead we lean on their built-in StyleAttribute extension (part of their
// StarterKit, exported from @react-email/editor/extensions), which already
// registers a generic `style` attribute on paragraph and heading nodes that
// the node views render. We read/write an email-safe `margin-left:{n*2}em`
// in that attribute via updateAttributes.
//
// Known quirk of their StyleAttribute: it resets the paragraph style on
// Enter, so text indent does not carry over to the next paragraph.
// ---------------------------------------------------------------------------

const MAX_INDENT = 4

function getIndentFromStyle(style: string): number {
  const match = /margin-left:\s*([\d.]+)em/.exec(style)
  if (!match) return 0
  return Math.min(MAX_INDENT, Math.max(0, Math.round(parseFloat(match[1]) / 2)))
}

function styleWithIndent(style: string, indent: number): string {
  const rest = style
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith('margin-left'))
  if (indent > 0) rest.push(`margin-left:${indent * 2}em`)
  return rest.join(';')
}

function ReEmailToolbar() {
  const { editor } = useCurrentEditor()

  // Hybrid indent state: inside a list, promote/demote the list item;
  // otherwise adjust margin-left on the paragraph/heading via the built-in
  // StyleAttribute extension (see comment above the helpers).
  //
  // useEditorState subscribes to editor transactions, so the disabled state
  // stays fresh on selection-only changes — useCurrentEditor alone does not
  // re-render this toolbar when the cursor moves.
  const indentState = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null
      const inList = e.isActive('listItem')
      const indentBlock =
        e.isActive('heading') ? 'heading'
        : e.isActive('paragraph') ? 'paragraph'
        : null
      const blockStyle = indentBlock ? ((e.getAttributes(indentBlock).style as string) || '') : ''
      return {
        canSink: e.can().sinkListItem('listItem'),
        canLift: e.can().liftListItem('listItem'),
        inList,
        indentBlock,
        blockIndent: getIndentFromStyle(blockStyle),
      }
    },
  })

  if (!editor || !indentState) return null

  const toggleHeading = (level: HeadingLevel) =>
    editor.chain().focus().toggleHeading({ level }).run()

  // Compute everything at click time — render-time values could be stale.
  const changeIndent = (delta: 1 | -1) => {
    if (delta === 1 && editor.can().sinkListItem('listItem')) {
      editor.chain().focus().sinkListItem('listItem').run()
      return
    }
    if (delta === -1 && editor.can().liftListItem('listItem')) {
      editor.chain().focus().liftListItem('listItem').run()
      return
    }
    if (editor.isActive('listItem')) return
    const indentBlock =
      editor.isActive('heading') ? 'heading'
      : editor.isActive('paragraph') ? 'paragraph'
      : null
    if (!indentBlock) return
    const blockStyle = (editor.getAttributes(indentBlock).style as string) || ''
    const blockIndent = getIndentFromStyle(blockStyle)
    const next = Math.min(MAX_INDENT, Math.max(0, blockIndent + delta))
    if (next === blockIndent) return
    editor
      .chain()
      .focus()
      .updateAttributes(indentBlock, { style: styleWithIndent(blockStyle, next) })
      .run()
  }

  return (
    <div className="toolbar re-toolbar" role="toolbar" aria-label="Text formatting">
      <div className="toolbar-group" role="group" aria-label="Text style">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          aria-label="Bold"
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          aria-label="Italic"
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          aria-label="Underline"
        >
          <u>U</u>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          aria-label="Strikethrough"
        >
          <s>S</s>
        </ToolbarButton>
      </div>

      <ToolbarSeparator />

      <div className="toolbar-group" role="group" aria-label="Heading level">
        {([1, 2, 3] as HeadingLevel[]).map((level) => (
          <ToolbarButton
            key={level}
            onClick={() => toggleHeading(level)}
            isActive={editor.isActive('heading', { level })}
            aria-label={`Heading ${level}`}
            aria-pressed={editor.isActive('heading', { level })}
          >
            H{level}
          </ToolbarButton>
        ))}
        <ToolbarButton
          onClick={() => editor.chain().focus().setParagraph().run()}
          isActive={editor.isActive('paragraph')}
          aria-label="Paragraph"
          aria-pressed={editor.isActive('paragraph')}
        >
          P
        </ToolbarButton>
      </div>

      <ToolbarSeparator />

      <div className="toolbar-group" role="group" aria-label="List type">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          aria-label="Bullet list"
          aria-pressed={editor.isActive('bulletList')}
        >
          • List
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          aria-label="Numbered list"
          aria-pressed={editor.isActive('orderedList')}
        >
          1. List
        </ToolbarButton>
      </div>

      <ToolbarSeparator />

      <div className="toolbar-group" role="group" aria-label="Indentation">
        <ToolbarButton
          onClick={() => changeIndent(1)}
          disabled={
            !indentState.canSink &&
            (indentState.inList || !indentState.indentBlock || indentState.blockIndent >= MAX_INDENT)
          }
          aria-label="Increase indent"
        >
          →
        </ToolbarButton>
        <ToolbarButton
          onClick={() => changeIndent(-1)}
          disabled={
            !indentState.canLift &&
            (indentState.inList || !indentState.indentBlock || indentState.blockIndent <= 0)
          }
          aria-label="Decrease indent"
        >
          ←
        </ToolbarButton>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bubble menu configuration
//
// We suppress the default text-selection bubble menu for node types that fall
// outside our required control set. The `bubbleMenu` prop controls which nodes
// and marks hide the *text-selection* bubble menu (the one with Bold, Italic,
// NodeSelector, etc.). Link, button, and image nodes have their own dedicated
// bubble menus that are not affected by this prop.
//
// Nodes to hide for:
//   "button"          — has its own ButtonDefault bubble menu
//   "horizontalRule"  — divider; no useful text formatting
//   "codeBlock"       — code block; not in our control set
//   "blockquote"      — blockquote; not in our control set
//   "image"           — has its own ImageDefault bubble menu
//   "section"         — layout block; no text selection applies
//   "twoColumns"      — layout block
//   "threeColumns"    — layout block
//   "fourColumns"     — layout block
//   "table"           — table; not in our control set
//
// Marks to hide for:
//   "link"            — has its own LinkDefault bubble menu (already the default)
// ---------------------------------------------------------------------------

const BUBBLE_MENU_HIDE_NODES = [
  'button',
  'horizontalRule',
  'codeBlock',
  'blockquote',
  'image',
  'section',
  'twoColumns',
  'threeColumns',
  'fourColumns',
  'table',
]

const BUBBLE_MENU_HIDE_MARKS = ['link']

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type OutputMode = 'raw' | 'pretty' | 'email-safe'

export function ReactEmailEditorWrapper() {
  const ref = useRef<EmailEditorRef>(null)
  const [outputMode, setOutputMode] = useState<OutputMode>('raw')
  const [rawHTML, setRawHTML] = useState('')

  const handleUpdate = useCallback((editorRef: EmailEditorRef) => {
    setRawHTML(editorRef.editor?.getHTML() ?? '')
  }, [])

  const handleReady = useCallback((editorRef: EmailEditorRef) => {
    setRawHTML(editorRef.editor?.getHTML() ?? '')
  }, [])

  const displayedOutput =
    outputMode === 'raw' ? rawHTML
    : outputMode === 'pretty' ? formatHTML(rawHTML)
    : styleHTMLForEmail(rawHTML)

  return (
    <div className="re-editor-shell">
      {/*
        className="re-editor-frame" is applied to the EmailEditor's own
        container div (via editorContainerProps). We wrap it in re-editor-wrap
        to provide the outer border/radius treatment that matches the TipTap
        panel: toolbar on top (border-radius 8 8 0 0) + content below (0 0 8 8).
        The toolbar is rendered as a child (inside EditorProvider context) so
        useCurrentEditor works, then visually reordered to the top with CSS.
      */}
      <div className="re-editor-wrap">
        <EmailEditor
          ref={ref}
          onUpdate={handleUpdate}
          onReady={handleReady}
          placeholder="Start typing here…"
          className="re-editor-frame"
          bubbleMenu={{
            hideWhenActiveNodes: BUBBLE_MENU_HIDE_NODES,
            hideWhenActiveMarks: BUBBLE_MENU_HIDE_MARKS,
          }}
        >
          <ReEmailToolbar />
        </EmailEditor>
      </div>

      <div className="editor-actions re-editor-actions">
        <button
          type="button"
          className="action-btn"
          onClick={() => ref.current?.editor?.commands.setContent(TEST_HTML)}
        >
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
                  name="output-mode-react-email"
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
