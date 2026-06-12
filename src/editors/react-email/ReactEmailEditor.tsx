import { useRef, useState, useCallback } from 'react'
import { useCurrentEditor } from '@tiptap/react'
import { EmailEditor, type EmailEditorRef } from '@react-email/editor'
import { TEST_HTML } from '../../test-content'
import { styleHTMLForEmail } from '../../email-serializer'
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
      onMouseDown={(e) => {
        // Prevent the editor from losing focus (and selection) on mousedown.
        // Without this, the selection is cleared before onClick fires.
        e.preventDefault()
        if (!disabled) onClick()
      }}
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

function ReEmailToolbar() {
  const { editor } = useCurrentEditor()

  if (!editor) return null

  const toggleHeading = (level: HeadingLevel) =>
    editor.chain().focus().toggleHeading({ level }).run()

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

      <div className="toolbar-group" role="group" aria-label="List indentation">
        <ToolbarButton
          onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
          disabled={!editor.can().sinkListItem('listItem')}
          aria-label="Increase indent"
        >
          →
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().liftListItem('listItem').run()}
          disabled={!editor.can().liftListItem('listItem')}
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
// Pretty-print helpers
// ---------------------------------------------------------------------------

const BLOCK_TAGS = new Set(['h1','h2','h3','p','ul','ol','li','blockquote'])
const VOID_TAGS = new Set(['br','hr','img','input','link','meta'])

function serializeNode(node: Node, depth: number): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const el = node as Element
  const tag = el.tagName.toLowerCase()
  const attrStr = Array.from(el.attributes).map(a => `${a.name}="${a.value}"`).join(' ')
  if (VOID_TAGS.has(tag)) return attrStr ? `<${tag} ${attrStr}>` : `<${tag}>`
  const isBlock = BLOCK_TAGS.has(tag)
  const pad = '  '.repeat(depth)
  const openTag = attrStr ? `<${tag} ${attrStr}>` : `<${tag}>`
  const children = Array.from(el.childNodes).map(child => serializeNode(child, isBlock ? depth + 1 : depth)).join('')
  if (isBlock) return `\n${pad}${openTag}${children}\n${pad}</${tag}>`
  return `${openTag}${children}</${tag}>`
}

function formatHTML(html: string): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return Array.from(doc.body.childNodes).map(node => serializeNode(node, 0)).join('').trim()
}

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
