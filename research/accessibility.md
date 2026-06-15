# Keyboard Accessibility Review — TipTap & React Email Toolbars

**Date:** 2026-06-12
**Scope:** Both fixed formatting toolbars, tab navigation, output-mode selector, editor content areas. Static review against WAI-ARIA Authoring Practices (APG) toolbar/tabs/button patterns, plus empirical keyboard testing in a real browser (Playwright against the dev server).
**Code state reviewed:** `TipTapEditor.tsx` as of 15:05 (includes the new `Indent` extension), `ReactEmailEditor.tsx` as of 15:01. Note: the codebase was under active edit during this review; line numbers may drift.

Findings are ordered by severity.

---

## 1. CRITICAL — React Email toolbar buttons cannot be activated by keyboard at all

**Where:** `src/editors/react-email/ReactEmailEditor.tsx` lines 20–50 (`ToolbarButton`)
**Pattern:** WCAG 2.1.1 Keyboard (Level A); APG button pattern
**Ours or library:** Ours (wrapper code)

The command handler runs **only** in `onMouseDown`; there is no `onClick` on the button:

```tsx
onMouseDown={(e) => {
  e.preventDefault()
  if (!disabled) onClick()
}}
```

Keyboard activation of a native `<button>` (Enter or Space) fires a `click` event — it never fires `mousedown`. With no `onClick` handler bound, Enter and Space do nothing.

**Empirically confirmed:** with text typed and selected in the React Email editor, focused the Bold button and pressed real Enter, then real Space — editor HTML unchanged, `data-active` never set, focus stayed on the button. Control test on the TipTap toolbar (whose `ToolbarButton` uses `onClick`, line 25 of `TipTapEditor.tsx`): the same activation applied `<strong>` to the selection. Every one of the 12 React Email toolbar buttons is affected — the entire toolbar is mouse-only.

**Fix** — keep the selection-preserving `mousedown` trick but move the command to `onClick`. `preventDefault()` on mousedown stops the button from taking focus (so the editor keeps its selection), and `click` still fires after mouseup for mouse users *and* natively for keyboard users:

```tsx
<button
  type="button"
  onMouseDown={(e) => e.preventDefault()}  // preserve editor selection; don't run the command here
  onClick={onClick}                         // fires for mouse click AND Enter/Space
  disabled={disabled}
  data-active={isActive || undefined}
  className="toolbar-btn"
  {...aria}
>
```

Note for keyboard users the editor is *not* focused when the button is pressed, but TipTap keeps its internal selection across blur and every handler starts with `editor.chain().focus()`, which restores it (verified on the TipTap toolbar — bold applied to the prior selection).

---

## 2. HIGH — Active state is invisible to screen readers on Bold/Italic/Underline/Strike (both toolbars)

**Where:**
- `src/editors/tiptap/TipTapEditor.tsx` lines 79–106 (B/I/U/S buttons)
- `src/editors/react-email/ReactEmailEditor.tsx` lines 67–94 (B/I/U/S buttons)
**Pattern:** APG button (toggle) pattern — `aria-pressed`
**Ours or library:** Ours

The four mark buttons set `isActive` (which only drives the `data-active` styling hook, `App.css:124`) but **no `aria-pressed`**. The heading, paragraph, and list buttons *do* have `aria-pressed` (TipTap lines 118, 127, 140, 148; React Email lines 106, 115, 128, 136). So a screen reader user hears "Heading 1, toggle button, pressed" but for Bold hears only "Bold, button" — no state, and worse, the inconsistency implies Bold is a one-shot action rather than a toggle.

**Fix** — derive `aria-pressed` from `isActive` inside `ToolbarButton`, with an opt-out for the non-toggle indent/outdent commands:

```tsx
function ToolbarButton({ onClick, isActive, disabled, toggle = true, children, ...aria }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={toggle ? !!isActive : undefined}
      data-active={isActive || undefined}
      className="toolbar-btn"
      {...aria}
    >
      {children}
    </button>
  )
}
// usage: <ToolbarButton toggle={false} aria-label="Increase indent" ... >
```

Then remove the per-button `aria-pressed` props (single source of truth). Indent/outdent must **not** get `aria-pressed` — they are momentary commands, not toggles, and `aria-pressed="false"` on them would be wrong.

---

## 3. HIGH — React Email focus order contradicts visual order (toolbar is tabbed *after* the editor)

**Where:** `src/editors/react-email/ReactEmailEditor.css` lines 43–52 (`.re-toolbar { order: -1 }`); explained in `ReactEmailEditor.tsx` comment lines 13–15
**Pattern:** WCAG 2.4.3 Focus Order; WCAG technique failure F44/C27 (visual order vs DOM order)
**Ours or library:** Mixed — the library forces `children` to render after `EditorContent`, but the CSS-reorder workaround is ours and a portal fix is available

`EmailEditor` renders its children (our toolbar) after the contenteditable in the DOM; we lift it visually above the content with `order: -1`. Empirically confirmed tab order inside the React Email panel:

```
contenteditable → Bold → Italic → … → indent buttons → Load test content → radios
```

versus TipTap's panel, where the toolbar (visually above) correctly comes first:

```
Bold → Italic → … → contenteditable → Load test content → radios
```

A keyboard user tabbing into the React Email panel lands in the editor *before* the toolbar that appears above it, and Shift+Tab appears to "go down" the screen. Screen reader reading order is similarly inverted.

**Fix** — use the portal pattern already documented in `research/react-email-toolbar.md` §9 Approach B: render a `<div ref={toolbarSlot} />` *before* `<EmailEditor>` in `ReactEmailEditorWrapper`, and `createPortal` the toolbar into it from inside the `EmailEditor` children (so `useCurrentEditor()` still works). Then delete the `order: -1` rule. DOM order, visual order, and focus order all align.

---

## 4. MODERATE — `role="toolbar"` without roving tabindex: 12 tab stops, no arrow-key navigation (both toolbars)

**Where:**
- `src/editors/tiptap/TipTapEditor.tsx` line 77 (`role="toolbar"`), buttons throughout
- `src/editors/react-email/ReactEmailEditor.tsx` line 65
**Pattern:** APG toolbar pattern — one tab stop, Arrow keys move within, Home/End to ends
**Ours or library:** Ours

Both toolbars declare `role="toolbar"`, which tells assistive tech "this is a single composite widget; expect arrow-key navigation." In reality every enabled button is an individual tab stop (empirically confirmed: Shift+Tab from the TipTap editor landed on "Decrease indent", i.e. the 12th toolbar stop) and Arrow/Home/End do nothing. Consequences:

- Reaching content *past* the toolbar costs up to 12 Tab presses.
- Screen reader users are promised arrow navigation by the role and it silently fails.

Severity is moderate rather than high because everything remains *reachable* — it is inefficient and pattern-violating, not blocking.

**What implementing roving tabindex takes** — roughly 40 lines as a shared hook used by both toolbars (they already share button markup conventions):

```tsx
function useRovingToolbar() {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  const items = () =>
    [...(ref.current?.querySelectorAll<HTMLButtonElement>('.toolbar-btn:not(:disabled)') ?? [])]

  const onKeyDown = (e: React.KeyboardEvent) => {
    const list = items()
    const i = list.indexOf(document.activeElement as HTMLButtonElement)
    let next = -1
    if (e.key === 'ArrowRight') next = (i + 1) % list.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + list.length) % list.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = list.length - 1
    if (next >= 0) { e.preventDefault(); list[next].focus(); setActive(next) }
  }
  // each button renders tabIndex={isTheActiveItem ? 0 : -1}
  return { ref, onKeyDown, active }
}
```

The fiddly parts: keeping `tabIndex` assignments stable when indent/outdent flip between enabled/disabled (recompute the item list on each keydown, as above), and re-pointing the single `tabIndex=0` if the currently-roved button becomes disabled. Wiring it into both toolbars is mechanical since both already funnel through `ToolbarButton`.

---

## 5. MODERATE — Tab navigation (App.tsx) lacks arrow keys and roving tabindex

**Where:** `src/App.tsx` lines 18–39
**Pattern:** APG tabs pattern
**Ours or library:** Ours

What is **correct** (verified statically and in the accessibility tree): `role="tablist"` with `aria-label`, `role="tab"` with `aria-selected` and `aria-controls` pointing at real panel ids, panels with `role="tabpanel"`, `aria-labelledby` back-references, and `hidden` (backed by `[hidden] { display:none !important }` in `index.css:41`).

What is missing:

- **No arrow-key navigation** — Left/Right/Home/End do nothing on the tabs.
- **No roving tabindex** — both tabs have no `tabindex` attribute (confirmed in-browser), so both are tab stops. APG: only the selected tab is in the Tab sequence (`tabIndex={-1}` on inactive tabs); Tab from the active tab goes into the panel.
- Minor: the panels have no `tabindex`. Acceptable here because each panel's first content is focusable (toolbar button / contenteditable), so no fix required — just don't add one blindly if the layout changes.

**Fix sketch:**

```tsx
const tabs: Tab[] = ['tiptap', 'react-email']
const onTablistKeyDown = (e: React.KeyboardEvent) => {
  const i = tabs.indexOf(activeTab)
  const next =
    e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length]
    : e.key === 'ArrowLeft' ? tabs[(i - 1 + tabs.length) % tabs.length]
    : e.key === 'Home' ? tabs[0]
    : e.key === 'End' ? tabs[tabs.length - 1]
    : null
  if (next) {
    e.preventDefault()
    setActiveTab(next)                                  // automatic activation
    document.getElementById(`tab-${next}`)?.focus()
  }
}
// on each tab button:
//   tabIndex={activeTab === tab ? 0 : -1}
// on the nav:
//   onKeyDown={onTablistKeyDown}
```

---

## 6. MODERATE — Toolbar activation steals focus into the editor (both toolbars)

**Where:** every handler in both toolbars: `editor.chain().focus().…run()` (e.g. `TipTapEditor.tsx:80`, `ReactEmailEditor.tsx:68`)
**Pattern:** APG toolbar pattern (focus stays on the control); WCAG 3.2.1 On Focus (adjacent concern)
**Ours or library:** Ours (TipTap's `.focus()` is opt-in per call)

Empirically confirmed on TipTap: pressing Enter on the focused Bold button applied bold **and moved focus into the contenteditable**. For a keyboard user who wants to toggle several formats (bold + italic, or try heading levels), each activation ejects them from the toolbar; getting back costs a Shift+Tab (and with finding 4 fixed, re-entry restarts at the roved position). Mouse users never notice because `mousedown`+`preventDefault` (React Email) or the immediate refocus (TipTap) is exactly what they want.

**Fix** — only chain `.focus()` when the activation came from a pointer, e.g. detect modality in `ToolbarButton`:

```tsx
onClick={(e) => {
  // e.detail === 0 → keyboard-originated click; keep focus on the button
  onClick(e.detail === 0 ? { refocus: false } : { refocus: true })
}}
```

with handlers doing `editor.chain()` vs `editor.chain().focus()` accordingly. TipTap applies marks to its stored selection without focus, so commands still work; the user presses Tab/Escape-style navigation back to the editor when ready. (Verify list commands too — some commands behave differently unfocused.)

---

## 7. LOW–MODERATE — Tab/Shift+Tab are captured inside list items (partial keyboard trap)

**Where:** library default — `@tiptap/extension-list/dist/index.js:320–326` (`ListItem.addKeyboardShortcuts`: `Tab: sinkListItem`, `Shift-Tab: liftListItem`); active in both editors via StarterKit
**Pattern:** WCAG 2.1.2 No Keyboard Trap
**Ours or library:** Library default (overridable in our config)

With the caret inside a list item, Tab indents instead of moving focus out of the editor, and Shift+Tab outdents instead of moving to the toolbar. It is *escapable* (when the command can't apply — e.g. first item, max depth — it returns `false` and the browser default proceeds), so it's not a hard trap, but the escape condition is undiscoverable. WCAG 2.1.2 requires that non-standard exit methods be advertised.

**Fix options:** accept it (common rich-text convention) but document it near the editor (visually-hidden hint or `aria-describedby` on the contenteditable, e.g. "Press Escape then Tab to leave the editor"); and/or add an `Escape` shortcut extension that blurs the editor / moves focus to the toolbar.

---

## 8. LOW — Disabled indent/outdent buttons drop out of the Tab sequence

**Where:** `TipTapEditor.tsx:165,176`; `ReactEmailEditor.tsx:147,154` (`disabled={...}`)
**Pattern:** APG toolbar pattern ("it is recommended that disabled toolbar buttons remain focusable")
**Ours or library:** Ours

Native `disabled` removes the buttons from the Tab order entirely, so a screen reader user tabbing the toolbar cannot discover that indent/outdent exist when the caret isn't in a list (it also makes the toolbar's tab-stop count shift unpredictably). APG recommends `aria-disabled="true"` + keeping focusability, with the click handler guarding:

```tsx
<button
  aria-disabled={disabled || undefined}
  onClick={() => { if (!disabled) onClick() }}
  ...
```

(`App.css` would need `.toolbar-btn[aria-disabled='true']` to mirror the current `:disabled` styling at line 130.) This matters more once roving tabindex (finding 4) exists, since disabled items should still be arrow-reachable.

---

## 9. LOW — Editor content areas have no accessible name

**Where:** both contenteditables. Verified in-browser: both render `role="textbox"` (added by TipTap core, `@tiptap/core/dist/index.js:5289`) with `tabindex="0"` but `aria-label`/`aria-labelledby` **null**, and no `aria-multiline`.
**Ours or library:** TipTap side ours (trivially fixable); React Email side a library gap with a workaround

A screen reader announces an anonymous "edit text" with no indication of which editor it is (there are two on the page, plus the output panes).

**Fix (TipTap)** — supported config:

```ts
useEditor({
  editorProps: {
    attributes: { 'aria-label': 'Email body', 'aria-multiline': 'true' },
  },
  ...
})
```

**Fix (React Email)** — `EmailEditor` does not expose `editorProps` (see `research/react-email-toolbar.md` §1), so set it in `onReady`:

```ts
const handleReady = useCallback((editorRef: EmailEditorRef) => {
  const dom = editorRef.editor?.view.dom
  dom?.setAttribute('aria-label', 'Email body')
  dom?.setAttribute('aria-multiline', 'true')
  setRawHTML(editorRef.editor?.getHTML() ?? '')
}, [])
```

---

## 10. What already works (verified)

- **Output-mode radio group** (`TipTapEditor.tsx:199–212`, `ReactEmailEditor.tsx:267–280`, `App.css:171–217`): the visually-hidden radios use `opacity: 0` + 1px box, **not** `display:none`, so they stay focusable and fully keyboard-operable (native radio-group arrow keys via shared `name`). The `:focus-visible` rule exists and works — `App.css:214–217` outlines the sibling `<span>`. Distinct `name` per editor instance avoids cross-panel grouping. Only nits: `role="group"` + `aria-label` is acceptable, though `<fieldset>/<legend>` or `role="radiogroup"` would be more precise.
- **Toolbar/group semantics:** `role="toolbar"` + `aria-label`, `role="group"` + `aria-label` per cluster, `role="separator"` with `aria-orientation="vertical"` — all correct.
- **Every toolbar button has an explicit `aria-label`** (important since visible labels like "B" / "→" are cryptic).
- **Focus visibility on buttons:** no CSS resets the default outline (`index.css` has no `outline: none`), so the UA focus ring shows on toolbar buttons and tabs. A branded `:focus-visible` style for `.toolbar-btn`/`.tab-btn` would be nicer but is not a defect.
- **No focus trap between toolbar and editor** (outside finding 7): Tab from the TipTap toolbar reaches the contenteditable and continues to "Load test content" and the radios; nothing cycles.
- **Tab panel `hidden` handling** is robust against CSS (`index.css:41–43`).

---

## Summary table — TipTap vs React Email toolbar

| Criterion | TipTap toolbar | React Email toolbar |
|---|---|---|
| Keyboard activation (Enter/Space) | Works (verified — bold applied) | **Broken — verified dead** (finding 1) |
| Activation handler | `onClick` | `onMouseDown` only |
| Selection preserved on mouse click | Via immediate `.focus()` re-focus | Via `mousedown` `preventDefault` |
| `aria-pressed` on B/I/U/S | Missing | Missing |
| `aria-pressed` on heading/para/list | Present | Present |
| Roving tabindex / arrow keys | No (12 tab stops, verified) | No (12 tab stops) |
| Focus order matches visual order | Yes (toolbar first in DOM) | **No** — toolbar after editor, CSS `order: -1` (finding 3) |
| Focus stolen into editor on activation | Yes (verified) | Yes (same handlers; moot until finding 1 fixed) |
| Disabled buttons focusable | No (native `disabled`) | No (native `disabled`) |
| Toolbar/group/separator semantics | Correct | Correct |
| Button `aria-label`s | All present | All present |
| Editor textbox accessible name | None | None |

**Ours vs library:** Findings 1, 2, 4, 5, 6, 8 are entirely in our wrapper code. Finding 3 is our CSS workaround for a real library constraint (children render after `EditorContent`) but is fixable in our code with a portal. Finding 7 is a TipTap library default (overridable). Finding 9 is trivially ours for TipTap and a library API gap (workaround available) for React Email.

**Suggested fix order:** 1 (one-line move, unblocks the entire React Email toolbar) → 2 (small, high screen-reader value) → 3 (portal refactor) → 5 → 4 → 9 → 8 → 6 → 7.

---

## Verification method

- Static review of `src/App.tsx`, `src/App.css`, `src/index.css`, both editor components/CSS, plus `@tiptap/core` and `@tiptap/extension-list` dist sources.
- Empirical: dev server on port 5198, Playwright-driven Chromium. Real `Enter`/`Space` key presses on focused toolbar buttons; real `Shift+Tab` traversal from the contenteditable; accessibility-tree/DOM inspection for `tabindex`, `aria-*`, and focus order. React Email Bold ignored both keys with a live text selection; the equivalent TipTap activation applied `<strong>` and moved focus into the editor. (Caveat: another session was editing the codebase and sharing the browser during testing; each result above was re-confirmed against the current file state on port 5198.)

---

## 11. KendoReact (Telerik) toolbar — addendum (2026-06-15)

**Scope:** the third exhibit, `src/editors/kendo/KendoEditor.tsx`. Unlike the two toolbars above (hand-built from native `<button>`s), KendoReact renders its **own** toolbar from `@progress/kendo-react-buttons` `Button`s inside a KendoReact `Toolbar`. So most a11y behavior is the vendor's, not ours.

**Method caveat:** this section is a **static / source-level** review only. The environment that added this exhibit had **no browser-automation tooling**, so — unlike findings 1–10, which were Playwright-verified — the keyboard/screen-reader claims here have **not** been confirmed in a live browser. They are marked accordingly and listed as open items in `research/kendo-notes.md` §9.

| Criterion | KendoReact toolbar | Ours or inherent |
|---|---|---|
| Keyboard activation (Enter/Space) | Expected to work — tools render real `<button>`s; built-in tools use an internal `onDownPreventDefault` (mousedown guard) with activation on click, the same split finding 1 prescribes. **Not browser-verified here.** | Inherent (vendor) for built-in tools; **ours** for the custom H1/H2/H3/P tools, which explicitly use `onMouseDown preventDefault` + `onClick` (`KendoEditor.tsx:60–66`). |
| `aria-pressed` on marks/headings | Built-in mark tools expose toggle state via Kendo's `Button` `togglable`/`selected`. Custom heading tools set `selected`, `togglable`, **and** an explicit `aria-pressed={active}`. | Mixed — vendor for marks, ours for headings. |
| Live active state on caret move | Native — Kendo re-renders every tool with a fresh `view` each transaction (no `useEditorState` equivalent needed). | Inherent. |
| Roving tabindex / arrow keys | KendoReact `Toolbar` *does* implement roving focus with arrow keys (its documented behavior) — potentially **better** than our two hand-built toolbars, which have 12 plain tab stops. **Not verified here.** | Inherent (if confirmed). |
| Focus order matches visual order | Toolbar precedes content in Kendo's DOM (no `order:-1` hack like React Email). | Inherent. |
| Editor textbox accessible name | Kendo applies a content-area `aria-label`/labelled-by to the editable. | Inherent. |

**Net:** on paper KendoReact's toolbar is the **strongest** of the three for accessibility — real buttons, native toggle state, native roving-tabindex, correct focus order — because it's a maintained vendor component rather than hand-rolled. The honest asterisk is that none of it was confirmed in a browser in this session; a live keyboard + screen-reader pass (and a check that the global Kendo theme doesn't disturb the other tabs' focus styling) is the outstanding work. Any defects found there would be **inherent** (vendor), with our only lever being issue reports or config — except the custom heading tools, which are ours to fix.
