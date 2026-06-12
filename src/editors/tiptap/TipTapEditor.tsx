import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { useState, useCallback } from 'react'
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

export function TipTapEditor() {
  const [htmlOutput, setHtmlOutput] = useState('')

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
    ],
    content: '<p>Start typing here…</p>',
    onUpdate({ editor }) {
      setHtmlOutput(editor.getHTML())
    },
    onCreate({ editor }) {
      setHtmlOutput(editor.getHTML())
    },
  })

  const toggleHeading = useCallback(
    (level: HeadingLevel) => editor?.chain().focus().toggleHeading({ level }).run(),
    [editor],
  )

  if (!editor) return null

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
      </div>

      <EditorContent editor={editor} className="tt-editor-content" />

      <div className="html-output">
        <div className="html-output-label">Generated HTML</div>
        <pre className="html-output-code">{htmlOutput}</pre>
      </div>
    </div>
  )
}
