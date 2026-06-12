import { useRef, useState, useCallback } from 'react'
import { EmailEditor, type EmailEditorRef } from '@react-email/editor'
import './ReactEmailEditor.css'

export function ReactEmailEditorWrapper() {
  const ref = useRef<EmailEditorRef>(null)
  const [htmlOutput, setHtmlOutput] = useState('')

  const handleUpdate = useCallback(async (editorRef: EmailEditorRef) => {
    const html = await editorRef.getEmailHTML()
    setHtmlOutput(html)
  }, [])

  const handleReady = useCallback(async (editorRef: EmailEditorRef) => {
    const html = await editorRef.getEmailHTML()
    setHtmlOutput(html)
  }, [])

  return (
    <div className="re-editor-shell">
      <div className="re-editor-content">
        <EmailEditor
          ref={ref}
          onUpdate={handleUpdate}
          onReady={handleReady}
          placeholder="Start typing here…"
        />
      </div>

      <div className="html-output">
        <div className="html-output-label">Generated HTML</div>
        <pre className="html-output-code">{htmlOutput}</pre>
      </div>
    </div>
  )
}
