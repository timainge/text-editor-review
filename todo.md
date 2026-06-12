# To Do

## General
- [x] indentation buttons are for text indent not list item indent, though if we wanted to get fancy they could have the effect of providing list hierarchy promotion/demotion for list items and for everything else text indent?
  - Implemented the fancy hybrid in both editors: in a list → sink/lift list item; otherwise → text indent via email-safe `margin-left` (2em steps, clamped 0–8em).
  - TipTap: custom `Indent` extension (`src/indent-extension.ts`, shared — the email serializer also registers it so the attr survives `Node.fromJSON`).
  - React Email: its `extensions` prop *replaces* the built-in set (and Placeholder/EmailTheming aren't re-exported), so a custom extension would mean rebuilding their schema. Used their built-in `StyleAttribute` (generic `style` attr on paragraph/heading) instead. Quirk: their Enter handler resets paragraph style, so indent doesn't carry to the next paragraph.
  - Both email-safe output modes verified to emit/preserve `margin-left`. `tsc`, build, and in-browser checks pass.
- [x] make sure that all editor specific code is encapsulated in their respective `src/editors/{editor}` path so that we can easily compare what is required for each. truly common code and significant should be kept on a common path for the same reason. trivially common code like layout etc can be duplicated in respective editor dirs so as ot not create extra compositional noise.
  - Audit result: editor-specific code lives in `src/editors/tiptap` and `src/editors/react-email`. Common+significant on common paths: `src/email-serializer.ts`, `src/test-content.ts`, and `src/format-html.ts` (pretty-printer was duplicated verbatim in both editors — extracted to shared module).
- [x] do a write up of each editor, what is required to make it meet the stated requirements and evaluate the complexity, reliability, flexibility of both. given that we have made both meet the requirement evaluate what other considerations make either one a better long term option. → `research/editor-comparison.md`
  - Recommendation: **headless TipTap** for email-safe rich text in forms — less code (236 lines vs 383 despite being from scratch), zero workarounds, full serialization control, neutral JSON storage format, 53 vs 192 transitive packages, mature ecosystem. `@react-email/editor` flips to the right answer only if requirements grow into whole-email design (sections, columns, buttons, images).

## React Email Editor — toolbar & styling

- [x] Research `@react-email/editor` toolbar configuration API → `research/react-email-toolbar.md`
  - Finding: `children` prop renders inside `EditorProvider`; `useCurrentEditor` works there. This is the documented escape hatch for custom UI.
  - Finding: `bubbleMenu` prop can only hide the *entire* bubble menu per node/mark context — it cannot remove individual buttons.
- [x] Research whether there are examples of a fixed (non-bubble) toolbar with `@react-email/editor`
  - Finding: no official examples exist; `children` + CSS `order: -1` is the correct pattern.
- [x] Fix borders — done; `re-editor-frame` wraps editor with matching border/radius treatment
- [x] Remove or hide default bubble menu — done; `[data-re-bubble-menu] { display: none }` suppresses the floating menu; fixed toolbar replaces it
- [x] Build fixed toolbar matching TipTap panel — done; `ReEmailToolbar` uses `useCurrentEditor` and the same shared CSS classes

## Email-safe HTML requirements

> See `research/email-safe-html.md` for full details and source citations.

- [x] Research which HTML tags and attributes survive common email clients
  - All tags in our set are supported. `<s>` is stripped by GMX/Web.de only (minor clients).
- [x] `<strong>` / `<em>` are safe but should carry redundant `font-weight`/`font-style` inline styles as a fallback
- [x] Nested `<ul>`/`<ol>` are structurally supported but Outlook converts `<li>` to `<p>` without `mso-special-format:bullet`
- [x] `<h1>`–`<h3>` need explicit `font-size`, `margin`, `line-height`, and `mso-line-height-rule:exactly` inline — Outlook and Yahoo both reset heading styles
- [x] `class` attributes are stripped by Gmail universally — inline styles are mandatory on every element

## TipTap serialisation

> See `research/tiptap-serialization.md` for full details, inline style values, and implementation sketch.

- [x] `editor.getHTML()` is **not email-safe** — all extensions emit bare semantic tags with no inline styles
- [x] `@tiptap/extension-email` does not exist; no ready-made community serialiser found
- [x] `@tiptap/static-renderer` is the right tool — installed; provides `renderToHTMLString` with `nodeMapping`/`markMapping` override hooks
- [x] **Implement `src/email-serializer.ts`** — custom serializer using `@tiptap/static-renderer` with inline styles per the research findings:
  - Headings: `font-size`, `font-weight`, `line-height`, `margin-top`, `margin-bottom`, `color`, `mso-line-height-rule:exactly`
  - `<strong>`: add `style="font-weight:bold"`; `<em>`: add `style="font-style:italic"`
  - `<u>`: safe as-is; `<s>`: wrap content in `<span style="text-decoration:line-through">` for GMX fallback
  - `<ul>`/`<ol>`: add `margin`/`padding`; `<li>`: add `margin-left:25px; mso-special-format:bullet`
- [x] Wire the serializer into both editors' HTML output panels with a UI selector (segmented control) to switch between output modes:
  - **Raw** — `editor.getHTML()`, no post-processing
  - **Pretty** — raw output run through the `formatHTML` pretty-printer (both editors)
  - **Email-safe** — TipTap uses `serializeToEmailHTML()` (JSON → `@tiptap/static-renderer`); React Email uses `styleHTMLForEmail()` (DOM walk over raw HTML) because its JSON contains proprietary node types (`container` etc.) that TipTap's standard schema cannot parse.
- [ ] Verify output against test content in a real email client (Gmail compose paste, or Litmus)

## Test data

- [x] Create test document (`src/test-content.ts`) covering all formatting types with realistic copy
- [x] "Load test content" button wired into TipTap editor
- [x] Wire "Load test content" into React Email Editor — `ref.current?.editor?.commands.setContent(TEST_HTML)`
- [ ] Verify serialized HTML output renders correctly in at least one real email client

## Known issues

> Investigated and root-caused — see `research/known-issues.md` for exact messages, stack-trace evidence, and draft upstream issue reports.

- [x] Duplicate `underline` extension warning — **was OUR bug, not the package's**: TipTap v3 StarterKit bundles Underline and we added the standalone extension on top (in TipTapEditor and the serializer). Fixed by removing `@tiptap/extension-underline` from both. (`@react-email/editor` itself correctly passes `underline: false` to its StarterKit.)
- [x] Missing React `key` prop warning — upstream: `composeReactEmail`'s `parseContent` maps marked nodes without keys. Only fires when calling `ref.getEmailHTML()`/`getEmail()`; we now use `getHTML()`, so it no longer appears in normal use. Cosmetic. No existing upstream issue found; draft report in `research/known-issues.md`.
- [x] `TextSelection` ProseMirror warning — upstream: fires on editor **blur** (not init); their `FocusScopes` `clearSelectionOnBlur` creates `TextSelection` at pos 0 (doc boundary) instead of `Selection.atStart(doc)`. Cosmetic. No existing upstream issue found; draft report in `research/known-issues.md`.
- [ ] Optionally file the two upstream issues on resend/react-email using the drafts in `research/known-issues.md` (needs your go-ahead — outward-facing)
- [x] Toolbar active states stale on selection change (TipTap: never updated on caret moves; React Email: only updated when indent-related state happened to change, so e.g. H1→H2 didn't refresh) — root cause: `editor.isActive(...)` read directly in JSX, but TipTap v3 components only re-render via `useEditorState` and only when the selector output changes. Fixed by routing ALL toolbar state (marks, headings, paragraph, lists, indent) through the `useEditorState` selector in both editors. Browser-verified: caret moves between H1/H2/H3/bold/italic update every button correctly in both toolbars.
- [x] Evaluate keyboard accessibility of both toolbars: focus order, `Tab`/`Shift-Tab` through buttons, screen reader announcements for active state → `research/accessibility.md`
  - **CRITICAL**: React Email toolbar buttons cannot be activated by keyboard at all — command runs in `onMouseDown` only, no `onClick` (our wrapper bug; empirically confirmed via Playwright. TipTap toolbar unaffected.)
  - HIGH: Bold/Italic/Underline/Strike lack `aria-pressed` in both toolbars (heading/list buttons have it) — toggle state invisible to screen readers
  - HIGH: React Email focus order contradicts visual order (toolbar after contenteditable in DOM, lifted with `order: -1`)
  - MODERATE: no roving tabindex/arrow keys in either toolbar (12 separate tab stops); tabs in App.tsx lack arrow-key nav
  - LOW: contenteditables have no accessible name; disabled indent buttons drop out of tab order
- [x] Fix the critical React Email keyboard-activation bug: keep `e.preventDefault()` in `onMouseDown` (preserves selection) but move the command call to `onClick` so Enter/Space work — fixed in `ReactEmailEditor.tsx` `ToolbarButton`
