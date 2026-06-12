import { useEditor, useEditorState, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useState, useCallback } from 'react'
import { TEST_HTML } from '../../test-content'
import { serializeToEmailHTML } from '../../email-serializer'
import { formatHTML } from '../../format-html'
import { Indent } from '../../indent-extension'
import './TipTapEditor.css'

type HeadingLevel = 1 | 2 | 3

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
      // StarterKit (TipTap v3) already bundles Underline — adding the
      // standalone extension again triggers a duplicate-extension warning.
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Indent,
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

  // useEditorState subscribes to editor transactions, so all toolbar state
  // stays fresh on selection-only changes (which don't bump rawHTML and so
  // don't re-render this component otherwise). Every isActive/can value the
  // toolbar renders must flow through this selector — reading editor.isActive
  // directly in JSX goes stale as soon as the cursor moves.
  const toolbarState = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive('bold'),
            italic: e.isActive('italic'),
            underline: e.isActive('underline'),
            strike: e.isActive('strike'),
            heading1: e.isActive('heading', { level: 1 }),
            heading2: e.isActive('heading', { level: 2 }),
            heading3: e.isActive('heading', { level: 3 }),
            paragraph: e.isActive('paragraph'),
            bulletList: e.isActive('bulletList'),
            orderedList: e.isActive('orderedList'),
            canSink: e.can().sinkListItem('listItem'),
            canLift: e.can().liftListItem('listItem'),
            canIndent: e.can().indent(),
            canOutdent: e.can().outdent(),
          }
        : null,
  })

  if (!editor || !toolbarState) return null

  const headingActive: Record<HeadingLevel, boolean> = {
    1: toolbarState.heading1,
    2: toolbarState.heading2,
    3: toolbarState.heading3,
  }

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
              isActive={toolbarState.bold}
              aria-label="Bold"
            >
              <strong>B</strong>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={toolbarState.italic}
              aria-label="Italic"
            >
              <em>I</em>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              isActive={toolbarState.underline}
              aria-label="Underline"
            >
              <u>U</u>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              isActive={toolbarState.strike}
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
                isActive={headingActive[level]}
                aria-label={`Heading ${level}`}
                aria-pressed={headingActive[level]}
              >
                H{level}
              </ToolbarButton>
            ))}
            <ToolbarButton
              onClick={() => editor.chain().focus().setParagraph().run()}
              isActive={toolbarState.paragraph}
              aria-label="Paragraph"
              aria-pressed={toolbarState.paragraph}
            >
              P
            </ToolbarButton>
          </div>

          <ToolbarSeparator />

          <div className="toolbar-group" role="group" aria-label="List type">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={toolbarState.bulletList}
              aria-label="Bullet list"
              aria-pressed={toolbarState.bulletList}
            >
              • List
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={toolbarState.orderedList}
              aria-label="Numbered list"
              aria-pressed={toolbarState.orderedList}
            >
              1. List
            </ToolbarButton>
          </div>

          <ToolbarSeparator />

          {/* Hybrid indent: inside a list, promote/demote the list item;
              otherwise adjust the text indent on the paragraph/heading. */}
          <div className="toolbar-group" role="group" aria-label="Indentation">
            <ToolbarButton
              onClick={() =>
                editor.can().sinkListItem('listItem')
                  ? editor.chain().focus().sinkListItem('listItem').run()
                  : editor.chain().focus().indent().run()
              }
              disabled={!toolbarState.canSink && !toolbarState.canIndent}
              aria-label="Increase indent"
            >
              →
            </ToolbarButton>
            <ToolbarButton
              onClick={() =>
                editor.can().liftListItem('listItem')
                  ? editor.chain().focus().liftListItem('listItem').run()
                  : editor.chain().focus().outdent().run()
              }
              disabled={!toolbarState.canLift && !toolbarState.canOutdent}
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
