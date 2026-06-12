# text-editor-review

A side-by-side comparison of two rich text editors for one specific job: **email-safe rich text editing embedded in a form**. The same minimal control set is implemented twice — once with headless [TipTap](https://tiptap.dev) and once with Resend's [`@react-email/editor`](https://www.npmjs.com/package/@react-email/editor) — so the cost of meeting identical requirements can be compared directly.

## The verdict

**Headless TipTap.** Full reasoning in [`research/editor-comparison.md`](research/editor-comparison.md), but in short:

- The from-scratch TipTap panel ended up **smaller** than the packaged-editor wrapper (236 lines + 49 CSS vs 383 + 95), because `@react-email/editor` has no fixed-toolbar API and needed three workarounds to behave.
- TipTap's JSON serializes deterministically to email-safe HTML via `@tiptap/static-renderer` with full node/mark control; `@react-email/editor`'s JSON contains proprietary node types a standard schema can't parse, forcing a DOM-walking fallback over its raw HTML output.
- `@react-email/editor`'s `extensions` prop **replaces** its built-in set (two internal extensions aren't re-exported), so custom extensions effectively mean rebuilding its schema.
- Dependency footprint: ~53 transitive packages for the whole `@tiptap/*` stack vs 192 for `@react-email/editor` — which depends on TipTap anyway.
- The steelman: if requirements ever grow into composing **whole emails** (sections, columns, buttons, images, theming), `@react-email/editor` becomes the right answer — that's what it's actually for.

## What's implemented

Both editors, behind tab navigation, with identical capability:

- **Marks:** bold, italic, underline, strikethrough
- **Blocks:** H1 / H2 / H3, paragraph, bullet list, ordered list
- **Hybrid indent/outdent:** promotes/demotes list items inside lists; applies email-safe `margin-left` text indent (2em steps, clamped) on paragraphs/headings otherwise
- **Fixed toolbar** (no bubble menu) with `aria-pressed` state and full keyboard operability
- **"Load test content"** button — a realistic document covering every supported format (`src/test-content.ts`)
- **Output panel with three modes:**
  - **Raw** — `editor.getHTML()` untouched
  - **Pretty** — raw output through a shared pretty-printer (`src/format-html.ts`)
  - **Email-safe** — every element carries inline styles (Gmail strips classes), plus Outlook fixes (`mso-line-height-rule:exactly` on headings, `mso-special-format:bullet` on list items) and a GMX/Web.de fallback for strikethrough

### Email-safe serialization (`src/email-serializer.ts`)

Two strategies, both exported:

- `serializeToEmailHTML(json)` — TipTap JSON → HTML via `@tiptap/static-renderer` with explicit node/mark mappings. Used by the TipTap tab.
- `styleHTMLForEmail(html)` — DOM walk over raw HTML applying the same inline styles. Used by the React Email tab, because its JSON contains proprietary node types (`container` etc.) that throw a `RangeError` in a standard TipTap schema.

## Repo tour

```
src/
  App.tsx                       Tab navigation (ARIA tabs pattern)
  email-serializer.ts           Both email-safe serialization strategies
  format-html.ts                Shared pretty-printer
  indent-extension.ts           Custom TipTap Indent extension (shared with serializer)
  test-content.ts               Realistic test document
  editors/
    tiptap/                     Headless TipTap implementation
    react-email/                @react-email/editor implementation + workarounds
research/
  editor-comparison.md          The write-up and recommendation
  email-safe-html.md            What survives Gmail/Outlook/Yahoo/etc.
  tiptap-serialization.md       Serializer options evaluated
  react-email-toolbar.md        How the fixed toolbar was achieved
  accessibility.md              Keyboard/screen-reader audit of both toolbars
  known-issues.md               Console warnings root-caused, draft upstream issues
todo.md                         Annotated task ledger — findings live inline
```

## Notable findings along the way

- **`@react-email/editor` fixed toolbar:** no API for it. Achieved by rendering our toolbar as a `children` of `EmailEditor` (inside its `EditorProvider`, so `useCurrentEditor` works) and lifting it above the content with CSS `order: -1`. The default bubble menu is suppressed with CSS.
- **Toolbar buttons over a contenteditable** need `onMouseDown={e => e.preventDefault()}` (so the editor keeps its selection) with the command in `onClick` (so Enter/Space still work). Doing the command in `onMouseDown` silently breaks all keyboard activation.
- **TipTap v3 re-rendering:** components do *not* re-render on selection-only changes. Every `isActive`/`can` value a toolbar renders must flow through a `useEditorState` selector — and the component only re-renders when the selector *output* changes, so partial selectors cause partial staleness.
- **TipTap v3 StarterKit bundles Underline** — adding `@tiptap/extension-underline` on top triggers a duplicate-extension warning.
- **Accessibility** (`research/accessibility.md`): critical issues found and fixed (keyboard activation); a backlog remains (roving tabindex per the ARIA toolbar pattern, `aria-pressed` on mark buttons, React Email's DOM order putting the toolbar after the content).
- **Two upstream bugs** in `@react-email/editor` were root-caused (unkeyed mark children in its serializer; an invalid `TextSelection` on blur) — draft issue reports sit in `research/known-issues.md`, unfiled.

## Running it

```sh
npm install
npm run dev
```

Open the printed URL, pick a tab, hit **Load test content**, and flip the output panel between Raw / Pretty / Email-safe.

`npx tsc --noEmit` type-checks; `npm run build` produces a production build.

## Open items

- Verify the email-safe output in a real client (paste into Gmail compose, or a Litmus run)
- Optionally file the two drafted upstream issues on `resend/react-email`
- Accessibility backlog in `research/accessibility.md` if either editor goes to production

See `todo.md` for the full ledger.
