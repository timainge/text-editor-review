# KendoReact Editor (Telerik) — Integration Notes & Evaluation

**Date:** 2026-06-15
**Package:** `@progress/kendo-react-editor` 15.0.0 (Telerik / Progress Software) — <https://www.telerik.com/kendo-react-ui/components/editor>
**Exhibit:** `src/editors/kendo/` (`KendoEditor.tsx` 153 lines, `KendoEditor.css` 58, `kendo-email.ts` 55)
**Method note (read first):** This was originally written without browser tooling (source + jsdom only). The **live-browser verification is now complete (2026-06-15, Playwright MCP) — see §9**, which supersedes the old "open items" and records two app-breaking bugs the source/jsdom checks missed (ProseMirror-singleton collisions with TipTap) plus their fixes. One correction surfaced by that work: Kendo does **not** bundle a private ProseMirror fork — `@progress/kendo-editor-common` depends on the standard `prosemirror-*` packages (see §9.1), so a few Step-0/§7 framings below ("bundles its own fork") are inaccurate and corrected in §9.1.

---

## Step 0 — Classification

| Question | Answer | Implication for this exhibit |
|---|---|---|
| **1. Distribution model** | **Batteries-included.** Ships a complete UI: a `Toolbar`, ~30 tools, dialogs (link, image, table wizard, find/replace), and an iframe edit mode. | We use Kendo's **native toolbar** (`tools` prop) rather than rebuilding one — the opposite choice from the TipTap exhibit, and the path `ADDING_AN_EDITOR.md` explicitly sanctions for Telerik. |
| **2. Framework fit** | **Native React** component (a `forwardRef` class component, `Editor`), peer `react ^18 \|\| ^19` — works on React 19.2. Mounts/unmounts cleanly; no Web Component or ref-mount gymnastics. | Standard JSX usage. We pass `defaultEditMode="div"` to keep the editable in the page DOM (the default is an `<iframe>`), which suits a form-embedded field and lets the page theme it. |
| **3. Content model** | **HTML string.** `EditorUtils.getHtml(state)` and the `onChange` event's `html` getter both yield a standard HTML string. ProseMirror is the internal engine (Kendo bundles its own fork as `@progress/kendo-editor-common`), but it is never the storage format. | **Low storage lock-in** (standard HTML, not a proprietary JSON). Email-safe path is the HTML-string path: reuse the shared `styleHTMLForEmail`. |
| **4. Licensing / footprint** | **Commercial** (Telerik license; `"SEE LICENSE IN LICENSE.md"`). Without a license key the Editor renders a **watermark** and logs a console error — non-blocking but unavoidable. Heavy: **434 packages** added at install, **31 `@progress/*`** packages (69 MB on disk), **13 transitive `prosemirror-*`** packages, a **704 KB** global theme CSS, lifting the production JS bundle to **4.25 MB** (1.24 MB gzip). | The license watermark and footprint are the two headline negative findings (§5, §7). No key was supplied, so per the playbook the integration is built and scaffolded honestly *with* the watermark; nothing is faked. |

---

## What it took to meet each contract item

### C1 — Self-contained component
`KendoEditor` (`src/editors/kendo/KendoEditor.tsx`) takes no props and renders toolbar → editable → actions → output panel. The toolbar and editable are Kendo's own (`<Editor>`); the actions row and output panel are the same plain JSX as the other exhibits. Mount/unmount is clean — `Editor` is a well-behaved React component (no StrictMode double-mount issues observed in the build; not re-verified in a live browser here).

### C2 — Control set in a fixed toolbar
Kendo renders all tools in its own fixed `Toolbar` (a real persistent toolbar, not a bubble menu), so the **fixed-toolbar requirement is met natively**. Tools are passed as a nested array (`tools={[[...],[...]]}`) where each inner array becomes a visually separated group:

| Control | How | Effort |
|---|---|---|
| Bold / Italic / Underline / Strikethrough | Built-in `EditorTools.Bold/Italic/Underline/Strikethrough` | Drop-in. |
| **H1 / H2 / H3 / Paragraph** | **Custom tools** (`createBlockTool`, `KendoEditor.tsx:46–82`) | Kendo ships block formatting only as a single **FormatBlock dropdown**, not discrete heading buttons. Rather than diverge to a dropdown, we built four discrete tools — the documented extension path. A "tool" is any component in the `tools` array; the Editor clones it with a fresh `view` prop every transaction. Each button calls `EditorUtils.formatBlockElements(view, tag)` and reads active state with `EditorUtils.getBlockFormats(state)`. ~36 lines for all four. |
| Bullet list / Ordered list | Built-in `EditorTools.UnorderedList/OrderedList` | Drop-in. |
| **Indent / Outdent (hybrid)** | Built-in `EditorTools.Indent/Outdent` | **Hybrid for free.** Kendo's Indent tool is natively list-aware: inside a list it sinks/lifts the list item (nesting); elsewhere it indents the block via inline **`margin-left`** (`config/indent-rules.js`: `style:'margin-left', step:30, unit:'px'`). This is exactly the hybrid the TipTap exhibit needed an 84-line custom extension to achieve, and it is **email-safe by default** (margin-left, never text-indent). |

**Coverage: every control in the set is present** — four discrete heading buttons, list buttons, hybrid indent — with no stubs and no silent no-ops.

### C3 — Live toolbar state on selection change — **free**
This was the hard-won bug in both TipTap exhibits (their components don't re-render on selection-only changes). Kendo solves it internally: a `toolbar-tools-update-plugin` re-renders every tool with the current `view` on each transaction (`Editor.mjs:246`). Built-in tools track their own active state; our custom heading tools get the same fresh `view` and recompute `getBlockFormats`. **No `useEditorState`-equivalent wiring was needed.** (Verified from source; the live caret-movement check awaits a browser — open item.)

### C4 — Keyboard accessibility (baseline)
Kendo's built-in tools render `@progress/kendo-react-buttons` `Button`s and use an internal `onDownPreventDefault` mousedown guard — i.e. they already implement the exact "preserve selection on mousedown, run on click" split the React Email exhibit had to be fixed to do. Our custom heading tools mirror it explicitly (`onMouseDown={e => e.preventDefault()}` + command in `onClick`) and expose toggle state via the Kendo `Button` `togglable`/`selected` props plus an explicit `aria-pressed`. The editable gets an accessible name from Kendo (`ariaLabel`/content-area label). *Full keyboard/SR walk not run here (no browser) — open item.*

### C5 — Load test content
`loadTestContent` (`KendoEditor.tsx:96`) grabs the live view from the editor ref and calls `EditorUtils.setHtml(view, TEST_HTML)`, then refreshes the raw-output state. Kendo ingests the shared `TEST_HTML` directly (it is an HTML editor), so **no conversion is needed** — unlike a Markdown- or JSON-only editor.

### C6 — Output panel, three modes
- **Raw** — Kendo's own `getHtml` output, surfaced via the `onChange` `html` getter (initial value seeded from `defaultContent`).
- **Pretty** — the shared `formatHTML` pretty-printer (Kendo emits a standard HTML string, so it just works).
- **Email-safe** — `kendoHTMLToEmail` (see §6).

---

## §5 — License watermark (headline finding)

`@progress/kendo-react-editor` depends on `@progress/kendo-licensing`. With **no license key activated**, the Editor sets `showLicenseWatermark = true` and renders a watermark overlay carrying the message *"No license found for Editor v15.0.0…"*, while `@progress/kendo-licensing` logs a `console.error`/`console.warn` (`Editor.mjs:107,220`; licensing `dist/index.js`). The editor **remains fully functional** — the watermark is non-blocking — but it is present on every render and cannot be removed without a paid (or trial) license key set via `setLicenseKey()` / a `kendo-ui-license.txt` / the `KENDO_UI_LICENSE` env var.

- **Ours or inherent?** **Inherent** to the commercial product. There is no code-side fix; it requires a license we were not given.
- **Honesty bar:** no key was fabricated. The exhibit ships as-is with the watermark, which is itself the finding a buyer needs to weigh.

This is the single biggest practical difference from the two open-source exhibits, where there is no license, no key management, and no watermark.

---

## §6 — Email-safe path (`src/editors/kendo/kendo-email.ts`)

Kendo emits an HTML string, so this is the **HTML-string strategy**: reuse the shared `styleHTMLForEmail` from `src/email-serializer.ts` (the same function the React Email exhibit uses) after a tiny, **editor-local** tag normalization.

Confirmed from Kendo's schema source (`kendo-editor-common/dist/es/config/schema.js`): marks serialize via `tagMark()` as `<strong>`, `<em>`, `<u>`, and **`<del>`** for strikethrough. `styleHTMLForEmail` only special-cases `<s>` for the GMX/Web.de double-wrap, so `kendo-email.ts` renames `<del> → <s>` **before** handing off (bold/italic/underline already serialize as `<strong>`/`<em>`/`<u>`, which the shared serializer handles directly). Block indent already arrives as inline `margin-left`, which `styleHTMLForEmail` preserves when it overwrites the `style` attribute — no work needed.

The normalization lives in the editor's own folder (not pushed into the shared serializer the other two exhibits depend on), per the encapsulation rule.

**Verified headlessly** (jsdom, bundling the real `kendo-email.ts` + shared serializer against representative Kendo output containing `<del>`, nested lists, and a `margin-left:60px` paragraph). All assertions passed:

```
PASS - no <del> remains            PASS - heading has mso-line-height-rule
PASS - strike double-wrapped       PASS - li has mso-special-format
PASS - no class attributes         PASS - margin-left preserved on p
PASS - strong inline font-weight
```

i.e. strikethrough becomes `<s><span style="text-decoration:line-through">…</span></s>`, headings carry `mso-line-height-rule:exactly`, `<li>` carries `mso-special-format:bullet`, indent survives as `margin-left`, and no `class` attributes leak. The transform is clean because Kendo's content model is plain HTML — no proprietary nodes to special-case (contrast React Email's `container`/`section` nodes, which broke the JSON path entirely).

---

## §7 — Dependency footprint (headline finding)

| Metric | Value | Evidence |
|---|---|---|
| Packages added at install | **434** | `npm install` output |
| `@progress/*` packages | **31** (69 MB on disk) | `ls node_modules/@progress`, `du -sh` |
| Transitive `prosemirror-*` | **13** | `ls node_modules \| grep prosemirror` |
| Global theme CSS | **704 KB** (98 KB gzip) | `dist/assets/index-*.css`; `@progress/kendo-theme-default/dist/all.css` |
| Production JS bundle | **4.25 MB** (1.24 MB gzip) | `npm run build` |
| License | **Commercial** (Telerik) | `package.json` `"SEE LICENSE IN LICENSE.md"` |

Two footprint caveats specific to Kendo:
1. **The theme is global.** KendoReact components are unstyled without `@progress/kendo-theme-default`, a single ~704 KB stylesheet. Importing it (in `KendoEditor.tsx`) loads it for the **whole app**, not just this tab — there is no per-component theming. Its custom properties are `--kendo-*`-namespaced and its rules are almost entirely `.k-*`-scoped, so collision risk with the app's tokens is low, but the weight is paid app-wide. *(Visual non-interference across tabs not re-checked in a browser here — open item.)*
2. **Whole component suites.** Pulling the Editor drags in `@progress/kendo-react-buttons`, `-dropdowns`, `-dialogs`, `-inputs`, `-layout`, `-popup`, `-treeview`, `-pdf`, `kendo-drawing`, etc. — even though this exhibit uses a handful of toolbar buttons. You buy the suite to use the Editor.

---

## §8 — Evaluation rubric

| # | Dimension | Score | Evidence / "ours vs inherent" |
|---|---|---|---|
| 1 | **Requirement coverage** | ✅ | All controls met; fixed toolbar and **hybrid indent are native** (indent is list-aware + `margin-left`, the very thing TipTap needed 84 custom lines for). Only gap: headings ship as a dropdown, so discrete H1/H2/H3/P are custom (~36 lines) — *inherent* (Kendo's design), but trivially worked around. |
| 2 | **Implementation complexity** | ✅ | 266 lines total (153 tsx + 58 css + 55 email), the **smallest of the three** exhibits, despite a from-scratch-feeling control set — because toolbar, live state, a11y plumbing, and hybrid indent come for free. Conceptual overhead is real though: you must learn Kendo's tool/`view` model and theme system. **Zero CSS suppression hacks** (contrast React Email's 3 workarounds). |
| 3 | **Reliability** | ⚠️ | Output is deterministic standard HTML. The standing reliability cost is the **license watermark + console error** on every render without a key (*inherent*). Edge-case behavior (nested lists, mixed marks, empty doc) and console cleanliness **not browser-verified here** — open item. |
| 4 | **Flexibility / extensibility** | ✅ | Full ProseMirror surface is exposed (`EditorUtils`, the `ProseMirror` namespace, `createProseMirrorTool`); adding a discrete tool is ~9 lines and documented. Counter-pressure: you're locked into Kendo's tool/theme conventions and a **commercial license** — extensibility is high *within* their model, gated by cost outside the trial. |
| 5 | **Email-safe output quality** | ✅ | HTML-string model = **low lock-in**; reuses the shared serializer with a 1-rule normalization; verified (§6). Indent is email-safe by default. Cleaner than React Email's fallback (no proprietary nodes). |
| 6 | **Accessibility** | ✅ (pending live audit) | Built-in tools are real `<button>`s with the correct mousedown/click split and toggle state; custom tools mirror it with `aria-pressed`. Likely shares the *roving-tabindex* gap the other two have (many tab stops) — to be confirmed in the live audit (open item). Issues here are **inherent** to Kendo's toolbar (we didn't hand-roll the buttons). |
| 7 | **Dependency footprint** | ❌ | 434 packages, 69 MB `@progress`, 704 KB global theme, 4.25 MB JS bundle, **commercial license**. The worst of the three by a wide margin (§7). *Inherent.* |
| 8 | **Maturity / ecosystem** | ✅ | Created **2019-02**, **1454 published versions**, v15.0.0 on 2026-05-20, modified within days of writing. Backed by Telerik/Progress with paid support, extensive docs, and demos. The most *mature* of the three (TipTap 2018, React Email 2026). *Inherent strength.* |

---

## §9 — Live-browser verification (done 2026-06-15, Playwright MCP)

The live walk the playbook prescribes is now complete — and it **caught two app-breaking runtime bugs that the source + jsdom checks could not see**, plus a console warning. All three are now fixed; the exhibit passes a full live walk in dev and production preview.

### §9.1 — Critical: ProseMirror-singleton collisions with TipTap (FIXED)

**Correction to Step 0 / §7:** the notes assumed Kendo "bundles its own ProseMirror fork." It does not. `@progress/kendo-editor-common` depends on the **standard** `prosemirror-*` packages — the same ones `@tiptap/pm` pulls in. ProseMirror is engineered as a set of **singletons** (each package registers global IDs / relies on `instanceof`), so two copies of any of them in one app collide. Because Kendo **pins exact** prosemirror versions while TipTap uses `^` ranges, npm could not dedupe them, leaving two copies of several packages and one shared copy of `prosemirror-state`.

Two collisions, both fatal at runtime (and invisible to `tsc`/`vite build`, which is precisely why a browser was required):

1. **Blank screen on load** — `RangeError: Duplicate use of selection JSON ID gapcursor`. Two `prosemirror-gapcursor` (TipTap 1.4.1; Kendo pinned 1.4.0) each call `Selection.jsonID("gapcursor")` against the single shared `prosemirror-state` Selection class at import time. The second throws during module evaluation → React never mounts → **all three tabs blank**, not just Kendo.
2. **Crash on Enter / block-split** — `RangeError: Can not convert <> to a Fragment (looks like multiple versions of prosemirror-model were loaded)`. Kendo's nested `prosemirror-model@1.25.4` built Fragments that failed the `instanceof` check in the shared `prosemirror-model@1.25.8`.

**Fix:** npm `overrides` in `package.json` force a single version of each duplicated package:

```json
"overrides": {
  "prosemirror-model": "1.25.8",
  "prosemirror-gapcursor": "1.4.1",
  "prosemirror-transform": "1.12.0",
  "prosemirror-view": "1.41.9"
}
```

The pinned versions are the ones TipTap already resolved to, so only Kendo is bumped (patch/minor within 1.x — ProseMirror keeps 1.x back-compatible) and TipTap is untouched. After `npm install`, no nested `prosemirror-*` remain under `@progress`. **Evaluation impact:** this is a genuine integration cost of dropping Kendo into an app that *already* has a ProseMirror-based editor — it does not appear when Kendo is the only editor. Counts against dimension 3 (reliability) for this specific multi-editor repo; an `overrides` block is the standard, low-risk remedy.

### §9.2 — Minor: React duplicate-key warning on the custom heading tools (FIXED)

Kendo keys each toolbar tool by `displayName || name` (`Editor.mjs:171`). All four heading tools are the same inner function `BlockTool` (from `createBlockTool`), so they collided on the key `"BlockTool"` → *"Encountered two children with the same key"* (×4) and unreliable reconciliation. **Fix:** set a unique `BlockTool.displayName = \`BlockTool(${tag})\`` in `createBlockTool`.

### §9.3 — Confirmed live (everything that was source/jsdom-only before)

- **Watermark:** renders as expected — diagonal "Invalid license" tiling across the editable **plus** a Kendo-injected top banner overlay ("License key missing for KendoReact v15.0.0", overlaps the app header). Inherent; no key supplied. Screenshot: `kendo-verified.png`.
- **Console:** clean except the **2 inherent Kendo license *warnings*** (no errors) once §9.1/§9.2 were fixed — in dev *and* production preview.
- **Live caret-movement toolbar state (§C3):** moving the caret from an H2 line to a P line flips the buttons' `aria-pressed` with **no click** — confirms the claim that live state is free.
- **Mouse + keyboard activation (§C4):** mouse clicks work; `Ctrl+B` shortcut works; `Enter` on a focused custom heading button applies the block. Toolbar uses **roving tabindex** (buttons `tabindex=-1`, single tab stop) — good baseline a11y.
- **Tab-switch lifecycle:** tabs toggle via `hidden`, so Kendo stays mounted; content persists across switches; no errors/leaks observed.
- **Theme isolation:** the global Kendo theme does **not** visually break or disable the TipTap/React Email tabs — both still render and edit after Kendo loads.
- **Functional:** B/I/U/S, H1/H2/H3/P, ordered/unordered lists, **hybrid indent both modes** (list item → nested `<ul>`; paragraph → `margin-left:30px`), Load test content, and email-safe output (verified attrs: heading `mso-line-height-rule:exactly` + inline `font-size`; `<li>` `mso-special-format`; `<strong>` inline `font-weight:bold`; **no `class` attrs**; `<del>`→`<s>` double-wrap). Matches the §6 jsdom assertions, now confirmed in-browser.

### §9.4 — Still open

- Email-safe output still unverified in a real email client (shared open item with the other two exhibits).
- Indent step is `30px` (Kendo default) vs `2em` in the other exhibits — cosmetic only; both serialize as email-safe `margin-left`.
- A full screen-reader pass (NVDA/VoiceOver) was not run — only the programmatic a11y affordances (roles, `aria-pressed`, roving tabindex, keyboard activation) were checked.

## Sources
- This repo: `src/editors/kendo/*`, `src/email-serializer.ts` (`styleHTMLForEmail`), `src/App.tsx`.
- Package source (local): `@progress/kendo-react-editor` — `Editor.d.ts`/`Editor.mjs` (ref `.view`, `showLicenseWatermark`, tools-update plugin), `tools/index.d.ts`, `tools/indent.mjs`, `utils/index.d.ts` (`formatBlockElements`, `getBlockFormats`, `getHtml`, `setHtml`); `@progress/kendo-editor-common/dist/es/config/schema.js` (mark `tagMark` → strong/em/u/del) and `config/indent-rules.js` (margin-left indent).
- npm registry (checked 2026-06-15): `npm view @progress/kendo-react-editor time/versions/license` — created 2019-02-13; 1454 versions; 15.0.0 published 2026-05-20.
- Build/footprint: `npm run build`; `npm install` summary; `du -sh node_modules/@progress`.
