import { useState } from 'react'
import { TipTapEditor } from './editors/tiptap/TipTapEditor'
import { ReactEmailEditorWrapper } from './editors/react-email/ReactEmailEditor'
import { KendoEditor } from './editors/kendo/KendoEditor'
import './App.css'

type Tab = 'tiptap' | 'react-email' | 'kendo'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('tiptap')

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Rich Text Editor Comparison</h1>
        <p className="app-subtitle">TipTap Headless vs React Email Editor vs KendoReact (Telerik)</p>
      </header>

      <nav className="tab-nav" role="tablist" aria-label="Editor implementations">
        <button
          role="tab"
          aria-selected={activeTab === 'tiptap'}
          aria-controls="panel-tiptap"
          id="tab-tiptap"
          className="tab-btn"
          onClick={() => setActiveTab('tiptap')}
        >
          TipTap (Headless)
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'react-email'}
          aria-controls="panel-react-email"
          id="tab-react-email"
          className="tab-btn"
          onClick={() => setActiveTab('react-email')}
        >
          React Email Editor
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'kendo'}
          aria-controls="panel-kendo"
          id="tab-kendo"
          className="tab-btn"
          onClick={() => setActiveTab('kendo')}
        >
          KendoReact (Telerik)
        </button>
      </nav>

      <main className="tab-panels">
        <div
          role="tabpanel"
          id="panel-tiptap"
          aria-labelledby="tab-tiptap"
          hidden={activeTab !== 'tiptap'}
          className="tab-panel"
        >
          <TipTapEditor />
        </div>
        <div
          role="tabpanel"
          id="panel-react-email"
          aria-labelledby="tab-react-email"
          hidden={activeTab !== 'react-email'}
          className="tab-panel"
        >
          <ReactEmailEditorWrapper />
        </div>
        <div
          role="tabpanel"
          id="panel-kendo"
          aria-labelledby="tab-kendo"
          hidden={activeTab !== 'kendo'}
          className="tab-panel"
        >
          <KendoEditor />
        </div>
      </main>
    </div>
  )
}
