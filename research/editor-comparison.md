# Editor Comparison — TipTap (Headless) vs `@react-email/editor` vs KendoReact (Telerik)

**Date:** 2026-06-12 (TipTap / React Email); **2026-06-15** (KendoReact added)
**Packages compared:** `@tiptap/*` 3.26.1 (headless, hand-built toolbar) vs `@react-email/editor` 1.5.4 vs `@progress/kendo-react-editor` 15.0.0 (Telerik, batteries-included)
**Scope:** Final write-up for the stated requirements — email-safe rich text editing in forms: bold/italic/underline/strikethrough, H1–H3, paragraph, bullet/ordered lists, hybrid indent/outdent, fixed toolbar, and a 3-mode output panel (Raw / Pretty / Email-safe). All three implementations now meet the requirements; this document evaluates what it took, and which is the better long-term option.

> **KendoReact addendum (2026-06-15).** A third exhibit, the commercial KendoReact Editor, was added at the maintainer's request. Its full write-up is in **`research/kendo-notes.md`**; this document folds it into the executive summary (§1.1) and the comparison table (§4). One caveat that colours its rows: the environment that built it had **no browser-automation tools**, so KendoReact's claims are verified from package source + a headless jsdom round-trip, not a live browser (the other two were Playwright-verified). See `research/kendo-notes.md` §9.

Every claim below traces to code in this repo, one of the other research files, or a checkable external fact (npm registry, package dist sources). Facts that could *not* be re-verified are flagged inline.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [What It Took: TipTap](#2-what-it-took-tiptap)
3. [What It Took: React Email](#3-what-it-took-react-email)
4. [Comparison Table](#4-comparison-table)
5. [Long-Term Considerations](#5-long-term-considerations)
6. [When the Other Choice Would Be Right](#6-when-the-other-choice-would-be-right)
7. [Open Verification Items](#7-open-verification-items)
8. [Sources](#8-sources)

---

## 1. Executive Summary

**Recommendation: TipTap headless for our use case (email-safe rich text in forms).**

Both editors now meet every stated requirement, so the decision rests on *how* they got there and what that predicts about the future. The headline finding is counter-intuitive: the "batteries-included" option required **more code and more workarounds** than the from-scratch one.

- The TipTap wrapper is **236 lines** (`src/editors/tiptap/TipTapEditor.tsx`) + 49 lines CSS. Everything is hand-built, but every piece sits on a documented, stable API. The only custom machinery — the `Indent` extension — is 84 straightforward lines (`src/indent-extension.ts`).
- The React Email wrapper is **383 lines** (`src/editors/react-email/ReactEmailEditor.tsx`) + 95 lines CSS, *despite* the package shipping a complete UI. We had to rebuild the identical toolbar anyway (the package only offers a bubble-menu paradigm), then layer on three workarounds: a CSS `order: -1` reordering hack, a `display: none !important` suppression of the built-in bubble menu, and an indent implementation contorted around the package's all-or-nothing `extensions` prop.
- Email-safe output: TipTap's JSON serializes cleanly through `@tiptap/static-renderer` with full per-node/per-mark control (`src/email-serializer.ts:21–97`). React Email's JSON contains proprietary node types that a standard TipTap schema cannot parse, forcing a less precise DOM-walking fallback over its raw HTML (`src/email-serializer.ts:99–135`).
- Footprint and maturity: the TipTap stack is 53 packages / ~8.9 MB installed; `@react-email/editor` pulls **192 packages** transitively — including the entire `react-email` CLI (esbuild, socket.io, tailwindcss) — and is **under four months old** (first npm publish 2026-02-18, 1.0.0 on 2026-04-16, 32 stable releases since).

`@react-email/editor` is not a bad package — it is a *mismatched* one. Its value proposition is full email-template composition (sections, columns, buttons, images, theming, `getEmailHTML()` producing complete email documents). Our requirement is a constrained rich-text field in a form. We spent most of our React Email effort *suppressing* its features, which is the clearest possible signal that we are paying for capability we don't want and fighting defaults we can't configure.

### 1.1 Where KendoReact (Telerik) lands

**Recommendation unchanged: headless TipTap for this use case.** KendoReact is the *strongest* of the three on several axes and the weakest on the two that matter most here.

- **It is the least code and the fewest workarounds.** The exhibit is 266 lines total (vs TipTap 320, React Email 478) with **zero** CSS suppression hacks, because the fixed toolbar, live selection state, keyboard-accessible buttons, and — notably — the **hybrid indent** all ship natively. Kendo's Indent tool is list-aware *and* emits email-safe `margin-left` out of the box, which is exactly the behavior TipTap needed an 84-line custom extension for.
- **Its content model is clean.** Plain HTML string out, so the email-safe path reuses the shared `styleHTMLForEmail` with a one-rule tag fix (`<del>`→`<s>`); no proprietary nodes (contrast React Email). Low storage lock-in, and it is the most *mature* of the three (created 2019, 1454 published versions, Telerik support).
- **But it is commercial and heavy.** Without a license key it renders a **watermark** and logs a console error on every render (non-blocking, but inherent — no code fix). And it is the heaviest by far: **434 packages**, a **704 KB global theme**, a **4.25 MB** JS bundle. For a single constrained rich-text field, that is a steep price in licensing cost, bundle weight, and a whole component-suite dependency — to land in the *same place* TipTap reaches with five `@tiptap/*` packages and no license.

So Kendo would be the right call for a team **already standardised on KendoReact** (the license and bundle are sunk costs, and you inherit a vetted, supported, accessible component) — but for a greenfield, single-field email-safe editor, TipTap remains the recommendation. See `research/kendo-notes.md` for the full evaluation and the open browser-verification items.

---

## 2. What It Took: TipTap

### 2.1 Implementation inventory

| Piece | Where | Effort character |
|---|---|---|
| Editor + fixed toolbar | `src/editors/tiptap/TipTapEditor.tsx` (236 lines) | Mechanical. `useEditor` + StarterKit, one `<ToolbarButton>` per control calling documented commands (`toggleBold`, `toggleHeading`, `sinkListItem`, …). Toolbar is plain JSX rendered *before* `<EditorContent>` — fixed toolbar is the natural shape, not a workaround. |
| Hybrid indent/outdent | `src/indent-extension.ts` (84 lines) | The only "real" custom work. A TipTap `Extension` adding a global `indent` attribute to paragraph/heading, rendered as email-safe `margin-left:{n*2}em`, with `indent()`/`outdent()` commands. Used the documented `addGlobalAttributes`/`addCommands` APIs; no internals touched. The hybrid behavior (list promotion inside lists, text indent elsewhere) is a runtime branch in the toolbar handler (`TipTapEditor.tsx:175–196`). |
| Email-safe serialization | `src/email-serializer.ts` (`serializeToEmailHTML`, lines 21–97, 137–144) | Declarative. `@tiptap/static-renderer`'s `renderToHTMLString` with a complete `nodeMapping`/`markMapping`: inline styles per `research/email-safe-html.md` §10 (heading font-size/margins/`mso-line-height-rule`, `<strong style="font-weight:bold">`, the `<s><span>` GMX fallback, `mso-special-format:bullet` on `<li>`). The live editor is untouched — Approach B from `research/tiptap-serialization.md` §4, exactly as researched. The `Indent` extension is registered with the serializer too so `Node.fromJSON` keeps the attribute (`email-serializer.ts:94–97`). |
| Styling | `TipTapEditor.css` (49 lines) + shared `App.css` | Trivial; we own every DOM node. |

### 2.2 Problems encountered

- **One bug, and it was ours:** the duplicate-`underline` warning came from adding the standalone `@tiptap/extension-underline` on top of TipTap v3's StarterKit (which now bundles Underline) — a v2→v3 migration leftover, fixed by removing the import in both `TipTapEditor.tsx` and `email-serializer.ts` (`research/known-issues.md` §1). Note: `@tiptap/extension-underline` is still listed in `package.json` though no longer imported; it can be dropped.
- **One library default worth knowing:** Tab/Shift+Tab are captured inside list items (`@tiptap/extension-list` keyboard shortcuts) — a soft keyboard trap, escapable and overridable in config (`research/accessibility.md` §7).
- That's the complete list. No CSS hacks, no suppressed features, no schema fights.

### 2.3 Effort characterization

**Linear and predictable.** Each requirement mapped to a documented API: requirement → extension/command → toolbar button → serializer mapping. Nothing required reading the package's `dist/` output. The cost is that *we* own every line — there is no upstream UI to inherit fixes from.

---

## 3. What It Took: React Email

### 3.1 Implementation inventory

| Piece | Where | Effort character |
|---|---|---|
| Fixed toolbar | `ReactEmailEditor.tsx:93–259` (`ReEmailToolbar`) | **Rebuilt from scratch anyway.** The package has no fixed-toolbar API — only bubble menus (`research/react-email-toolbar.md` §9: "no built-in fixedToolbar prop"). The documented escape hatch is the `children` prop (rendered inside `EditorProvider`, so `useCurrentEditor()`/`useEditorState()` work). But children render *after* `EditorContent` in the DOM, so the toolbar is lifted visually with CSS `order: -1` (`ReactEmailEditor.css:41–52`) — which inverts keyboard focus order relative to visual order (`research/accessibility.md` §3). |
| Suppressing the built-in UI | `ReactEmailEditor.css:86–95`; `ReactEmailEditor.tsx:261–299` | The default text bubble menu cannot be disabled via props — `bubbleMenu.hideWhenActive*` only hides it per node/mark context, never removes individual buttons (`research/react-email-toolbar.md` §2). Suppression is `[data-re-bubble-menu] { display: none !important }` — a CSS hack against the package's own DOM, plus a hand-maintained list of its proprietary node names (`section`, `twoColumns`, `table`, …) for the `bubbleMenu` prop. |
| Hybrid indent/outdent | `ReactEmailEditor.tsx:56–153` | **Contorted by the package.** `EmailEditor`'s `extensions` prop *replaces* the entire built-in set — verified in `dist/index.mjs:196–207`: `extensionsProp ?? [StarterKit.configure(), Placeholder.configure(…), EmailTheming.configure(…)]` — and `Placeholder`/`EmailTheming` are **not re-exported** from `@react-email/editor/extensions` (absent from the export list in `dist/extensions/index.d.mts:393`). So registering our own `Indent` extension would mean rebuilding and maintaining their whole email schema. Instead we piggy-back on their built-in `StyleAttribute` (a generic `style` attribute on paragraph/heading), reading/writing `margin-left` with regex string surgery (`getIndentFromStyle`/`styleWithIndent`). Quirk inherited from their Enter handler: paragraph style resets on Enter, so indent does not carry to the next paragraph (`todo.md:7`). |
| Email-safe serialization | `src/email-serializer.ts` (`styleHTMLForEmail`, lines 99–135) | **Fallback path.** The editor's JSON contains proprietary node types (`container` etc.) that TipTap's standard schema cannot parse — attempting it raised a `RangeError` (`todo.md:50`; documented there, not re-reproduced for this write-up). So instead of JSON → controlled render, we DOM-walk the raw `getHTML()` output and overwrite `style` attributes from a tag→style table, special-casing `<s>` wrapping and preserving the editor-written `margin-left`. It works for our constrained tag set, but it is pattern-matching on output rather than rendering from a source of truth. |
| Frame/border styling | `ReactEmailEditor.css` (95 lines) | Required `display: contents` wrapper plus overrides of the package's own container styles to visually match the TipTap panel. |

**Fairness note:** we deliberately did *not* use the package's own `getEmailHTML()`/`getEmail()` (which produce complete email documents via `@react-email/render`). For a forms use case we need a fragment, not a document, and `getEmailHTML()` also triggers the upstream unkeyed-marks warning (`research/known-issues.md` §2). For the package's *intended* use case — composing whole emails with sections, columns, buttons, and images — that serialization pipeline is genuine, substantial value that TipTap does not have out of the box.

### 3.2 Problems encountered

- **Our bug:** toolbar buttons originally ran commands in `onMouseDown` only — keyboard activation (Enter/Space) was completely dead, empirically confirmed (`research/accessibility.md` §1). Fixed by keeping `preventDefault()` in `onMouseDown` and moving the command to `onClick` (`ReactEmailEditor.tsx:33–49`).
- **Upstream, cosmetic (both root-caused, no existing upstream issues found; draft reports in `research/known-issues.md`):**
  1. Unkeyed mark elements in `composeReactEmail` → React key warning on every `getEmailHTML()` call with marked text.
  2. `FocusScopes`' `clearSelectionOnBlur` constructs `TextSelection.create(doc, 0)` at the doc boundary → ProseMirror warning on every blur.
- **Structural a11y issue inherent to the design:** children-after-`EditorContent` rendering means any custom toolbar either sits below the editor or trades DOM order for visual order (`research/accessibility.md` §3, severity HIGH). A portal workaround exists in our code, but the default shape of the API produces the violation.

### 3.3 Effort characterization

**Front-loaded reverse engineering, then workarounds.** Three of the five implementation pieces required reading the package's compiled `dist/*.mjs` to find out what was possible (`research/react-email-toolbar.md` sources list; `research/known-issues.md` method). The package is well-built for its purpose, but our requirements sat orthogonal to its opinions, and its configuration surface (`bubbleMenu`, `theme`, `extensions`) offered no supported path for: a fixed toolbar, removing UI, or adding one extension.

---

## 4. Comparison Table

| Criterion | TipTap (headless) | `@react-email/editor` | KendoReact (Telerik) | Notes |
|---|---|---|---|---|
| **Complexity (to meet our requirements)** | ✅ Lower — 236-line wrapper + 84-line extension, all on documented APIs | ⚠️ Higher — 383-line wrapper + 3 workarounds (CSS reorder, bubble-menu suppression, StyleAttribute indent) requiring dist-source archaeology | ✅ Lowest LOC — 266 total, **0 CSS hacks**; toolbar/live-state/a11y/**hybrid indent** all native. Cost is conceptual (learn Kendo's tool + theme model), not lines | Counter-intuitive overall: the from-scratch headless option and the commercial packaged option both beat the OSS packaged one |
| **Reliability** | ✅ One issue total, ours (duplicate underline) | ⚠️ Two cosmetic upstream warnings (unkeyed marks, blur TextSelection), one indent quirk (style reset on Enter), one bug ours (mousedown) | ⚠️ **License watermark + console error** on every render without a key (inherent); deterministic HTML otherwise. Edge cases not browser-verified here | `research/known-issues.md` §4; Kendo's is a licensing artifact, not a bug |
| **Flexibility** | ✅ Total — every node/mark/command/serialized byte is ours; `extend()`/custom extensions are first-class | ❌ All-or-nothing — `extensions` prop replaces the built-in set; non-re-exported internals (`Placeholder`, `EmailTheming`); UI removable only via CSS | ✅ Full ProseMirror surface exposed (`EditorUtils`, `ProseMirror` ns, `createProseMirrorTool`); custom tool ≈ 9 lines. Gated by commercial license outside the model | KendoReact custom heading tools added in ~36 lines (`KendoEditor.tsx:46–82`) |
| **Accessibility** | ✅ Clean structure (toolbar first in DOM); remaining gaps are ours and fixable (`aria-pressed`, roving tabindex) | ⚠️ Same fixable gaps **plus** a structural one: focus order inverted by the children-rendering design (portal workaround needed) | ✅ Native `<button>` tools with correct mousedown/click split + toggle state; likely shares the roving-tabindex gap — live SR/keyboard audit still pending | `research/accessibility.md` §11; Kendo issues are inherent (vendor toolbar), not ours |
| **Email-safe output quality** | ✅ JSON → `static-renderer` with exact per-node inline styles; deterministic; serializer is the source of truth | ⚠️ DOM-walk over raw HTML (our fallback); its native `getEmailHTML()` emits full documents — wrong shape for form fragments | ✅ Plain HTML string → shared `styleHTMLForEmail` + one-rule `<del>`→`<s>` fix; indent already `margin-left`; no proprietary nodes. jsdom-verified (7/7) | `src/editors/kendo/kendo-email.ts`; `research/kendo-notes.md` §6 |
| **Dependency footprint** | ✅ 5 direct `@tiptap/*` packages (one droppable), 53 packages / ~8.9 MB installed | ❌ 1 direct package (1.7 MB) but **192 transitive packages**, incl. `react-email@6.6.0` CLI (7.6 MB) pulling esbuild, socket.io, tailwindcss; ships react-dom's server renderer to the browser (187 KB chunk in our build) | ❌ Worst — **434 packages** added, 31 `@progress` (69 MB), 13 `prosemirror-*`, **704 KB global theme CSS**, **4.25 MB** JS bundle, **commercial license** | `npm ls --all`; `du -sh`; build sizes. Note: `@react-email/editor` itself depends on `@tiptap/*` — choosing it means TipTap *plus* their layer |
| **Maturity** | ✅ npm since 2018 (v1), `@tiptap/core` since 2020-11, v2 2023-03, v3 stable 2025-07; large ecosystem | ❌ First publish 2026-02-18 (experimental); 1.0.0 2026-04-16; 32 stable releases in ~8 weeks to 1.5.4 | ✅ **Most mature** — created 2019-02, **1454 versions**, v15.0.0 2026-05-20, paid Telerik support + extensive docs | `npm view … time`. Kendo trades cost for stability + support |

---

## 5. Long-Term Considerations

### 5.1 Content lock-in

This is the most consequential long-term difference, because stored content outlives code.

- **TipTap:** documents are standard ProseMirror/TipTap JSON. They round-trip through any TipTap-compatible tooling, can be re-serialized to new formats later (`research/tiptap-serialization.md` §8 storage recommendation), and the schema is defined by extensions *we* choose.
- **React Email:** documents contain proprietary node types (`container`, `section`, `body`, …) that a standard TipTap schema rejects (`todo.md:50`). Stored JSON from this editor is readable only by re-importing their extension set — meaning the package version range becomes a constraint on your *data*, not just your UI. Migrating away later requires writing a converter for their node types.

For a forms product where submitted rich text may be stored for years, TipTap's neutral format is a material risk reduction.

### 5.2 Upgrade risk and upstream responsiveness

- `@react-email/editor` shipped 32 stable releases between 2026-04-16 and 2026-06-09 (npm registry). That pace suggests an actively developed product — Resend is a well-resourced company and the package will likely improve fast — but also that minor versions land several times a week. Our integration touches undocumented surfaces (`[data-re-bubble-menu]` attributes, children DOM position, `StyleAttribute` behavior, dist internals), which are exactly the surfaces fast-moving releases break silently. Neither of the two upstream bugs we found had existing issues filed, implying a small user base hitting edges before us.
- TipTap v3 has been stable since 2025-07, follows semver with published migration guides, and the APIs we use (`useEditor`, `Extension.create`, `static-renderer` mappings) are core, documented surface. Upgrade risk is conventional.

### 5.3 When requirements grow

- **Links, alignment, colors, more marks:** TipTap — add the extension, add a toolbar button, add one mapping function to `email-serializer.ts`. The pattern is established and each addition is ~20 lines across three files. React Email — links and alignment exist built-in (with their own bubble menus we currently suppress), so *re-enabling* is easy, but anything not built-in collides with the all-or-nothing `extensions` prop again.
- **Images, buttons, sections, columns — i.e., the email-template use case:** this flips the verdict. React Email has these as first-class nodes with upload handling (`onUploadImage`), dedicated bubble menus, theming, and a real document serializer. Recreating that on headless TipTap would be weeks of work (compare Maily, `research/tiptap-serialization.md` §3.2 — an entire product built to do exactly this).
- **When requirements shrink:** TipTap — delete a button and an extension. React Email — you cannot remove built-in node types (slash-command menu, layout nodes) without replacing the whole extension set; shrinkage means more CSS suppression.

### 5.4 Who fixes what

With TipTap we own all defects in our 370 lines — and can fix any of them same-day (everything in `research/accessibility.md` marked "ours" has a sketched fix). With React Email, the cosmetic warnings and the Enter-resets-style quirk wait on upstream; our only levers are issue reports (drafts ready in `research/known-issues.md`) and version bumps.

---

## 6. When the Other Choice Would Be Right

### The steelman for `@react-email/editor`

Choose it when you are building what it was built for:

1. **Full email composition.** If users design *whole emails* — sections, multi-column layouts, buttons, images, dividers, preview text — its schema, node views, upload pipeline, and `getEmail()` (HTML + plain text from one call, via `@react-email/render`) replace weeks of custom TipTap work, and the email-safety of the *full-document* output is upstream's job, not ours.
2. **Default UX is acceptable as-is.** A team happy with the bubble-menu + slash-command paradigm writes nearly zero UI code. Our costs were almost entirely *deviation* costs; with no deviation, the integration is a single component.
3. **Resend ecosystem alignment.** If the product already uses react-email templates and Resend for sending, the editor's output feeds that pipeline natively, and the fast release cadence means gaps you hit are plausibly fixed within weeks.
4. **Small team, no editor expertise.** Headless TipTap demands understanding ProseMirror concepts (schema, marks vs nodes, commands, selection). The packaged editor hides all of that until you deviate.

### The steelman for TipTap (why it wins *here*)

Our use case is the inverse of every point above: a constrained formatting set, a fixed toolbar, fragment output for arbitrary sending infrastructure, content stored long-term in a neutral format, and requirements that will evolve in small increments. Every dimension where React Email is strong is a dimension we actively suppressed.

---

## 7. Open Verification Items

Flagged for honesty; none affect the recommendation's direction.

- The `RangeError` from parsing React Email JSON with a standard TipTap schema is documented in `todo.md:50` but was not re-reproduced during this write-up.
- The "style resets on Enter" indent quirk is documented in `todo.md:7` and the code comment at `ReactEmailEditor.tsx:71–73`; not re-verified in-browser today.
- Neither editor's email-safe output has yet been verified in a real email client (open items in `todo.md` — "Verify output against test content in a real email client").
- Ecosystem-size claims for TipTap (large extension ecosystem, wide adoption) rest on `research/tiptap-serialization.md` and general knowledge; GitHub stars / npm download counts were not checked for this document.
- Bundle-size attribution per editor was not isolated (single Vite bundle); only the 187 KB `server.browser` chunk is unambiguously attributable to `@react-email/render`.

---

## 8. Sources

**This repo:**
- `todo.md` — annotated history of requirements, findings, fixes
- `src/editors/tiptap/TipTapEditor.tsx`, `src/editors/tiptap/TipTapEditor.css`
- `src/editors/react-email/ReactEmailEditor.tsx`, `src/editors/react-email/ReactEmailEditor.css`
- `src/indent-extension.ts`, `src/email-serializer.ts`, `src/format-html.ts`
- `research/email-safe-html.md`, `research/tiptap-serialization.md`, `research/react-email-toolbar.md`, `research/accessibility.md`, `research/known-issues.md`

**Package sources (local):**
- `node_modules/@react-email/editor/dist/index.mjs` (lines 196–207: `extensionsProp ?? […]`)
- `node_modules/@react-email/editor/dist/extensions/index.d.mts` (export list — no `Placeholder`/`EmailTheming`)
- `node_modules/@react-email/editor/package.json` (dependency on `react-email@6.6.0`)

**npm registry (checked 2026-06-12):**
- `npm view @react-email/editor time` — first publish 2026-02-18; 1.0.0 on 2026-04-16; 1.5.4 on 2026-06-09 (32 stable releases)
- `npm view @tiptap/core time` — created 2020-11-16; 2.0.0 2023-03-29; 3.x stable 2025-07
- `npm view tiptap time.created` — 2018-08-21 (v1)
- `npm ls --all` — 192 unique packages in the `@react-email/editor` subtree vs 53 in the `@tiptap/*` subtrees
- `du -sh` — `@react-email/editor` 1.7 MB + `react-email` 7.6 MB; all `@tiptap/*` 8.9 MB
