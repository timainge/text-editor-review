import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { useState, useCallback } from 'react'
import { TEST_HTML } from '../../test-content'
import { serializeToEmailHTML } from '../../email-serializer'
import './TipTapEditor.css'

type HeadingLevel = 1 | 2 | 3

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

function formatHTML(html: string): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return Array.from(doc.body.childNodes)
    .map(node => serializeNode(node, 0))
    .join('')
    .trim()
}

interface ToolbarButtonProps {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  'aria-label': string
  children: React.ReactNode
}

function ToolbarButton({ onClick, isActive, disabled, children, ...aria }: ToolbarButtonProps) {
  return (
    <button
      type="button"
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

type OutputMode = 'raw' | 'pretty' | 'email-safe'

export function TipTapEditor() {
  const [rawHTML, setRawHTML] = useState('')
  const [outputMode, setOutputMode] = useState<OutputMode>('raw')

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
    ],
    content: '<p>Start typing here…</p>',
    onUpdate({ editor }) {
      setRawHTML(editor.getHTML())
    },
    onCreate({ editor }) {
      setRawHTML(editor.getHTML())
    },
  })

  const toggleHeading = useCallback(
    (level: HeadingLevel) => editor?.chain().focus().toggleHeading({ level }).run(),
    [editor],
  )

  if (!editor) return null

  const displayedOutput =
    outputMode === 'raw' ? rawHTML
    : outputMode === 'pretty' ? formatHTML(rawHTML)
    : serializeToEmailHTML(editor.getJSON())

  return (
    <div className="tt-editor-shell">
        <div className="toolbar" role="toolbar" aria-label="Text formatting">
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

        <EditorContent editor={editor} className="tt-editor-content" />

        <div className="editor-actions">
          <button
            type="button"
            className="action-btn"
            onClick={() => editor.commands.setContent(TEST_HTML)}
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
                    name="output-mode-tiptap"
                    value={mode}
                    checked={outputMode === mode}
                    onChange={() => setOutputMode(mode)}
                  />
                  <span>{mode === 'email-safe' ? 'Email-safe' : mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
                </label>
              ))}
            </div>
          </div>
          <pre className="html-output-code">
            {displayedOutput}
          </pre>
        </div>
    </div>
  )
}
