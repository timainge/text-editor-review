# Adding an editor to the comparison

A playbook for a future session tasked with adding a **third (or Nth) rich text editor** to this project. Read it fully before writing code.

> **The one thing to internalise first.** The two editors already here — TipTap and `@react-email/editor` — are *both* TipTap underneath. So almost everything you'll see in `src/editors/tiptap/` and `src/editors/react-email/` (ProseMirror JSON, `useEditorState`, `editor.chain().focus()`, `@tiptap/static-renderer`, the `Indent` extension) is **TipTap-specific implementation detail, not the contract.** The next editor may be Telerik/KendoReact, CKEditor, TinyMCE, Lexical, Quill, Slate, a Web Component, a non-React widget mounted into a ref, or something commercial that needs a license key. Do **not** assume it has a ProseMirror document, an `isActive()` method, or a chainable command API. Treat the existing two as *examples of one family*, and build the new one against the **contract** and **rubric** in this document.

---

## What this project is

A **comparison harness**, not a product. Each editor is an independent "exhibit" that fulfils the same contract, displayed behind a tab. The point is to surface *what it costs* to make each editor meet identical requirements, and to evaluate the trade-offs. Your job adding an editor is half engineering (make it meet the contract) and half evaluation (honestly document what it took and how it scored).

**Negative results are first-class data.** If an editor *cannot* do something in the required set, or only can with a heavy workaround, that is a finding to document — not a failure to hide or paper over. The comparison is more valuable when a gap is recorded clearly than when it's faked with brittle glue.

## Read these first

- `README.md` — current state and the standing recommendation.
- `research/editor-comparison.md` — the evaluation write-up and the dimensions used to compare. **Your new editor must end up in here.**
- `research/email-safe-html.md` — the definition of "email-safe HTML". This is the editor-agnostic *target* every editor's output is measured against. Non-negotiable spec.
- `research/accessibility.md` — the a11y audit method and the known backlog.
- `research/known-issues.md` — how console warnings / upstream bugs are recorded.
- `todo.md` — the annotated task ledger; findings live inline next to each item.
- The two existing editors under `src/editors/` — as **reference**, understanding they are one editor family.

---

## Project structure

```
src/
  main.tsx                      App bootstrap (you will not touch this)
  App.tsx                       Tab navigation — THE integration point (see below)
  App.css                       SHARED toolbar + output-panel CSS classes
  index.css                     Design tokens (CSS vars) + the [hidden] fix
  test-content.ts               Shared TEST_HTML sample document
  format-html.ts                Shared pretty-printer  (HTML string -> indented HTML)
  email-serializer.ts           Shared email-safe transforms (two strategies, see below)
  indent-extension.ts           TipTap-ONLY. Not reusable for non-TipTap editors.
  editors/
    tiptap/                     Exhibit 1 — headless TipTap (a TipTap-family example)
    react-email/                Exhibit 2 — @react-email/editor (also TipTap underneath)
    <your-editor>/              Exhibit N — what you will create
research/                       One+ markdown report per concern; your findings go here
todo.md                         Task ledger
README.md                       Top-level summary; update when done
```

### The integration point: `src/App.tsx`

Editors are currently wired **manually** in three places in `App.tsx`. To register a new exhibit:

1. Add it to the `Tab` union type: `type Tab = 'tiptap' | 'react-email' | '<your-editor>'`.
2. Import your editor's exported component.
3. Add a `<button role="tab" …>` to the `tablist` and a matching `<div role="tabpanel" …>` wrapping your component. Mirror the existing `aria-selected` / `aria-controls` / `id` / `hidden` wiring exactly — the tab/panel ARIA relationships are part of the harness, not your editor.

That is the entire integration surface. Your editor component is a black box to `App.tsx`: it takes no props and renders everything below the tab (toolbar, editing surface, actions, output panel).

> If you are adding the 4th+ editor and the three-places-in-`App.tsx` wiring has become genuinely repetitive, a small `EDITORS: {id, label, Component}[]` registry array is a reasonable, minimal refactor. Don't gold-plate it, and don't change the ARIA tab semantics.

### Shared vs. per-editor code (encapsulation rule)

This is a project requirement, not a style preference (see `todo.md`):

- **All editor-specific code lives under `src/editors/<your-editor>/`.** Component, its CSS, any adapters, any editor-specific serialization.
- **Only genuinely shared, significant code goes in `src/`.** Today that's `test-content.ts`, `format-html.ts`, and `email-serializer.ts`. (`indent-extension.ts` lives in `src/` only because *two TipTap exhibits* share it — it is not general.)
- **Trivially common things (layout, a button) may be duplicated** per editor rather than abstracted, to keep each exhibit readable in isolation and avoid coupling exhibits together. Don't create a shared abstraction that forces two editors into the same shape — that defeats the comparison.

Rule of thumb: if reusing a shared module makes your editor *honestly* simpler (e.g. it emits an HTML string and `styleHTMLForEmail` just works), reuse it. If reusing it requires bending your editor to look like TipTap, write your own and document why.

### Shared CSS you can use (from `App.css`)

These class names are shared and styled already — reuse them so exhibits look consistent: `.toolbar`, `.toolbar-group`, `.toolbar-sep`, `.toolbar-btn` (supports `data-active` for the pressed look and `:disabled`), `.html-output`, `.html-output-label`, `.output-mode-selector`, `.output-mode-option`, `.html-output-code`, `.editor-actions`, `.action-btn`. Design tokens (colors, fonts) are CSS vars in `index.css` (`--accent`, `--border`, `--bg`, etc.) — use them, don't hardcode colors.

If your editor ships its own toolbar/chrome (e.g. Telerik), you don't have to reskin it to these classes — but you must still meet the *fixed-toolbar* and *accessibility* parts of the contract, and you should note the visual divergence as a finding.

---

## Step 0 — Classify the editor before writing anything

This step is what prevents overfitting. Answer these four questions and record the answers at the top of your research file; they determine your whole approach.

1. **Distribution model — headless or batteries-included?**
   - *Headless* (you build all UI; editor manages document/state only). Example in repo: TipTap.
   - *Batteries-included* (ships its own toolbar/menus/UI). Example in repo: `@react-email/editor` ships a bubble menu. Telerik/CKEditor/TinyMCE ship full toolbars.
   - Implication: headless → you build the toolbar from scratch. Batteries-included → you likely *suppress or reconfigure* its built-in UI to match the fixed-toolbar requirement, which can be its own fight.

2. **Framework fit — how does it mount in React 19?**
   - Native React component / official React wrapper / Web Component / vanilla JS mounted into a `useRef` container / `<iframe>`-based.
   - Implication: non-React and ref-mounted editors need explicit lifecycle handling (mount/unmount, StrictMode double-invoke, syncing React state with an imperative instance). Don't assume hooks like the TipTap `useEditor`/`useEditorState` pattern exist.

3. **Content model — what does it store and emit?**
   - HTML string (Quill, TinyMCE, CKEditor, Telerik typically) / structured JSON document (TipTap/ProseMirror, Lexical, Slate) / Markdown / proprietary blob.
   - Implication: this decides your **email-safe path** (see below) and is itself a scored dimension (HTML-string and neutral formats are low lock-in; proprietary JSON is storage lock-in).

4. **Licensing / auth / footprint.**
   - Open-source vs commercial (license key, trial banner, paid tier)? Bundle size and transitive dependency count? Does it require a server, a CDN script, or network calls?
   - Implication: a license key or trial watermark, a CDN-only distribution, or a 2 MB bundle are all legitimate findings. If it needs a key you don't have, install it, scaffold the integration, document the blocker, and stop — don't fabricate.

---

## The contract — what every exhibit must provide

Framed editor-agnostically. After each item, *"Example (non-binding)"* shows how the TipTap-family exhibits did it — copy the **intent**, not necessarily the mechanism.

### C1. A self-contained React component

Exported from `src/editors/<your-editor>/`, takes no props, renders: toolbar → editing surface → actions row → output panel. Registered in `App.tsx` per the integration point above. Must mount/unmount cleanly (test tab-switching back and forth; watch for StrictMode double-mount issues with imperative editors).

### C2. The required control set, in a fixed toolbar

Controls: **bold, italic, underline, strikethrough; H1, H2, H3, paragraph; bullet list, ordered list; indent, outdent.**

- The toolbar must be **fixed/persistent** — not a floating or selection-bubble menu. If the editor ships a bubble/floating menu, suppress it and provide a fixed toolbar.
- **Indent/outdent is "hybrid":** inside a list it promotes/demotes the list item (nesting); elsewhere it applies a text indent. The text indent must serialize email-safe (`margin-left`, not `text-indent` — see email-safe spec). If your editor can't do one half of this, do the half it can and document the gap.
- **Coverage honesty:** implement every control the editor supports natively or with reasonable custom work. For any control that's impossible or needs disproportionate effort, leave it out (or stub it visibly) and record it under "requirement coverage" in the rubric. Don't hide a gap behind a button that silently does nothing.
- *Example (non-binding):* TipTap exhibits build `<button>`s wired to `editor.chain().focus().toggleBold().run()`. A batteries-included editor might instead expose its own toolbar config or imperative commands — use whatever it offers.

### C3. Toolbar reflects the current selection, live

When the caret moves or selection changes, the toolbar's active/pressed states must update to reflect the formatting at the new location (e.g. caret in an H2 → H2 shows active; caret in bold text → Bold shows active). Use `data-active` on `.toolbar-btn` for the visual state and `aria-pressed` for screen readers.

- This was a real bug we fixed in both existing exhibits, and the mechanism was entirely TipTap-specific (TipTap v3 components don't re-render on selection-only changes; state had to be routed through a `useEditorState` selector). **Your editor's reactivity model is almost certainly different.** Find out how *it* notifies you of selection changes (an `onSelectionChange`/`selectionUpdate` event, a controlled `value`, polling the instance, a React binding) and drive the toolbar state from that.
- Verify this *in a browser* (see workflow) — it's easy to get a toolbar that updates on click but goes stale on cursor movement.

### C4. Keyboard accessibility (baseline)

- Every toolbar control must be operable by keyboard (Tab to it, Enter/Space activates) **without** destroying the editor's selection.
- A classic trap (which we hit): doing the command in `onMouseDown` preserves selection for mouse users but *breaks keyboard activation entirely* because `onMouseDown` never fires for keyboard. The fix that satisfies both: prevent default on `onMouseDown` (to keep selection) **and** run the command in `onClick` (so Enter/Space work). Whatever editor you use, confirm both mouse and keyboard paths apply formatting.
- Give the editing surface an accessible name. Mirror the ARIA `role="toolbar"` / `role="group"` structure from the shared classes where you build your own toolbar.
- Full audit (roving tabindex, focus order, etc.) goes in `research/accessibility.md`; the baseline above is the minimum to ship.

### C5. "Load test content" action

A button in the `.editor-actions` row that loads the shared sample document so all exhibits can be compared on identical content. Source it from `src/test-content.ts` (`TEST_HTML`).

- If your editor ingests HTML directly, feed it `TEST_HTML`.
- If it can't ingest HTML (e.g. it only takes Markdown or a proprietary model), convert `TEST_HTML` to what it needs *inside your editor's folder*, and document the conversion as a finding (lossy? hard? that's evaluation data). Do not change the shared `TEST_HTML` to suit one editor.

### C6. Output panel with three modes

A `.html-output` panel with a `.output-mode-selector` (Raw / Pretty / Email-safe), exactly like the existing exhibits:

- **Raw** — the editor's own output, untouched. Whatever it natively produces (HTML string, serialized JSON, Markdown). If it's not HTML, show the native format and say so in the label/finding.
- **Pretty** — human-readable, indented HTML. If your editor emits an HTML string, reuse `formatHTML` from `src/format-html.ts`. If it emits something else, pretty-print whatever is reasonable and note it.
- **Email-safe** — the editor's content transformed to email-safe HTML per `research/email-safe-html.md`. **This is the crux of the whole project** — see the next section.

---

## The email-safe output — the crux

Every exhibit must turn its content into HTML that survives real email clients. The **target** is defined once, editor-agnostically, in `research/email-safe-html.md`. Summary of the invariants (read the file for the why and the citations):

- **Inline styles on every element** — Gmail strips `class` and `<style>`. No CSS classes in the output.
- **Headings** carry explicit `font-size`, `font-weight`, `line-height`, `margin`, plus `mso-line-height-rule:exactly` (Outlook).
- **Lists**: `margin`/`padding` on `<ul>`/`<ol>`; `<li>` carries `mso-special-format:bullet` (Outlook).
- **Strikethrough**: double-wrap — `<s><span style="text-decoration:line-through">…</span></s>` (GMX/Web.de strip bare `<s>`).
- **Bold/italic**: redundant inline `font-weight`/`font-style` as well as the semantic tag.
- **Indent**: `margin-left` (never `text-indent`).

### Picking your email-safe strategy (decision)

The harness already has **two** strategies in `src/email-serializer.ts`. Which (if either) you use depends on your editor's content model from Step 0:

| Your editor emits… | Strategy |
|---|---|
| A standard **HTML string** | Likely reuse `styleHTMLForEmail(html)` — it walks the DOM of an HTML string and applies the inline styles/fixes above. This is the most reusable path; many third-party editors (Quill, TinyMCE, CKEditor, Telerik) emit HTML strings. Verify the mapping covers your tags; extend it in a shared-safe way or wrap it locally if your editor emits tags it doesn't handle. |
| A **ProseMirror/TipTap JSON** doc | `serializeToEmailHTML(json)` renders ProseMirror JSON via `@tiptap/static-renderer` with explicit node/mark mappings. Only applicable if your editor genuinely produces a TipTap-compatible schema. (Note: `@react-email/editor`'s JSON contains proprietary node types that *broke* this path — hence it falls back to `styleHTMLForEmail` over its raw HTML. Proprietary nodes in a "JSON" model are a trap.) |
| A **different structured model** (Lexical, Slate, proprietary) or **Markdown** | Neither shared function applies directly. Write your own transform **inside `src/editors/<your-editor>/`**. Easiest correct route is usually: get the editor to emit HTML (most do, even if it's not their native model) and run that HTML through `styleHTMLForEmail`. If you must serialize the native model yourself, target the same invariants. |

Two rules:
- **Don't force your editor's output through the wrong serializer.** If `serializeToEmailHTML` throws on your content (it builds a schema and will reject unknown node types), that's the signal you're on the HTML-string path instead.
- **If you extend the shared `styleHTMLForEmail`/`EMAIL_STYLES` map**, make sure you don't break the existing two exhibits — they share it. Re-run their email-safe output after any change. If your additions are editor-specific, do them locally instead.

---

## Common problem classes (not recipes)

We hit these with the TipTap family; they're *general classes* to check for in any editor. The fix will differ per editor — these tell you what to look for, not what to type.

- **Selection/focus loss when clicking a toolbar button** over a contenteditable. (See C4 — the `onMouseDown`/`onClick` split.)
- **Stale toolbar state on selection change** — toolbar updates on action but not on caret movement. (See C3 — find the editor's selection-change signal.)
- **A built-in floating/bubble menu** competing with your fixed toolbar — suppress it (CSS `display:none`, a config flag, or a prop). Beware suppressing it from breaking the editor's own internal menus you *do* need.
- **The output contains proprietary/unknown nodes** a generic serializer can't parse → use the HTML-string path. (See email-safe table.)
- **Config or extension conflicts / duplicate registration** producing console warnings — investigate and attribute (our bug vs upstream), per `research/known-issues.md`. The duplicate-`underline` warning turned out to be *our* bug, not the library's.
- **License banners, watermarks, CDN/network dependencies, StrictMode double-mount** — all legitimate findings for non-TipTap, commercial, or imperative editors specifically.

---

## Workflow

1. **Classify (Step 0)** and start the research file with the answers.
2. **Install & scaffold.** Add the dependency (`npm install …`). Create `src/editors/<your-editor>/` with the component + CSS. Register in `App.tsx` (3 places). Get an empty editor rendering in its tab first.
3. **Meet the contract** C1–C6 incrementally. Run `npx tsc --noEmit` and `npm run build` frequently — both must stay green.
4. **Verify in a real browser — do not trust code-reading.** Run `npm run dev -- --port <free port>` and drive it with the Playwright MCP tools. The reliable method (this is how we caught the stale-state bug): load the page, click "Load test content", programmatically place the caret in specific nodes (an H1, an H2, bold text, a list item), and assert the right `.toolbar-btn`s have `data-active`. Test both mouse and keyboard activation. Test tab-switching away and back. Kill the dev server when done.
5. **Parallelise where it helps** (the maintainer prefers this). Independent sub-tasks — the a11y audit, the console-warnings investigation, the comparison write-up — can run as background agents while you build, then you reconcile. Don't parallelise edits to the *same* file.
6. **Write the findings** (deliverables below).
7. **Update the cross-cutting docs** and `todo.md`. Leave the tree green (`tsc` + `build`).

---

## Evaluation rubric

Score the new editor on each dimension, with **evidence**, and add it to the comparison table in `research/editor-comparison.md`. These dimensions come from the existing write-up; keep them consistent so the comparison stays apples-to-apples. Use a simple scale (e.g. ✅ strong / ⚠️ caveats / ❌ poor, or 1–5) and **always cite the evidence**, not just the score.

| # | Dimension | What to measure | How to get evidence |
|---|---|---|---|
| 1 | **Requirement coverage** | How many of the C2 controls are met natively / with custom work / not at all; is indent truly hybrid; fixed toolbar achieved | Feature-by-feature checklist against the control set |
| 2 | **Implementation complexity** | Lines of code + CSS for the exhibit; number of workarounds/hacks; conceptual overhead | `wc -l src/editors/<your-editor>/*`; count discrete workarounds and name them |
| 3 | **Reliability** | Console errors/warnings; edge-case failures; how deterministic the output is; StrictMode behaviour | Browser console capture; try the edge cases (nested lists, mixed marks, empty doc) |
| 4 | **Flexibility / extensibility** | Can you add a control the editor doesn't ship? How much lock-in to its way of doing things? | Note what extending it took (e.g. the indent feature); read its extension API |
| 5 | **Email-safe output quality** | How faithfully it maps to the email-safe target; how clean the transform is; storage-format neutrality (HTML/Markdown = low lock-in, proprietary = high) | Diff its email-safe output against the invariants; note the content model |
| 6 | **Accessibility** | Keyboard operability, ARIA, focus order, screen-reader state | Follow the method in `research/accessibility.md`; verify in browser |
| 7 | **Dependency footprint** | Transitive package count; bundle size impact; license (open/commercial); network/CDN/server needs | `npm ls`/`du -sh node_modules/<pkg>`; build size; check the license |
| 8 | **Maturity / ecosystem** | Age, release cadence, community size, docs quality, upstream responsiveness | `npm view <pkg> time/versions`; check repo/issues; note doc quality |

For each dimension, also state plainly: **is the limitation ours (our wrapper) or inherent to the editor?** That distinction is the most useful output of the whole exercise.

---

## Deliverables (definition of done)

Code:
- [ ] `src/editors/<your-editor>/` with the component + CSS, fully encapsulated.
- [ ] Registered in `App.tsx` (Tab type, import, tab button + tabpanel) with correct ARIA wiring.
- [ ] Contract C1–C6 met, or every gap explicitly documented.
- [ ] `npx tsc --noEmit` and `npm run build` both pass.
- [ ] Browser-verified: live selection state, mouse + keyboard activation, tab-switch lifecycle, all three output modes, email-safe output matches the spec.

Documentation:
- [ ] `research/<your-editor>-notes.md` (mirror the tone/format of the existing `research/*.md`): the Step-0 classification, what it took to meet each requirement (with file refs and effort), workarounds, gaps, and findings.
- [ ] New row(s) added to the comparison table in `research/editor-comparison.md`, and the recommendation revisited if this editor changes it.
- [ ] `research/accessibility.md` extended with this editor's audit (and whether issues are ours vs inherent).
- [ ] `research/known-issues.md` extended if it produced console warnings / upstream bugs (root-caused, attributed).
- [ ] `todo.md` updated — check off items, add any new ones, keep findings inline.
- [ ] `README.md` updated — at minimum the title/subtitle if they name the editors, the "what's implemented" list, and the repo tour.

Honesty bar: every claim in the write-up should trace to something checkable — code in this repo, the email-safe spec, a browser observation, or a verifiable external fact (version, license, package count). If you couldn't verify something, say so rather than asserting it.
