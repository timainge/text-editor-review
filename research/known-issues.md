# Known Console Warnings — Investigation

**Package versions investigated:** `@react-email/editor` 1.5.4, `@tiptap/*` 3.26.1, React 19.2.6
**Date:** 2026-06-12
**Goal:** Reproduce, root-cause, and assess the three console warnings listed in `todo.md` → "Known issues", and determine for each whether it originates in our code or upstream in `@react-email/editor`.

**Method:** Dev server on `localhost:5197`, driven via Playwright with `console.warn`/`console.error` hooked through `page.addInitScript` to capture full stack traces for attribution. The `@react-email/editor` dist files (`node_modules/@react-email/editor/dist/*.mjs`, which retain `//#region src/...` source markers) were read directly to locate the responsible code.

---

## 1. Duplicate `underline` extension warning

### Exact console text

```
[tiptap warn]: Duplicate extension names found: ['underline']. This can lead to issues.
```

Appears **twice on page load** (warning level). React `StrictMode` double-instantiates the TipTap editor, so the single cause logs twice.

### Reproduced

Yes — fires on every page load, before any interaction.

### Root cause

**Our code, not `@react-email/editor`.** The todo's attribution ("internal to the package; file upstream issue") is **incorrect**.

Captured stack traces show every occurrence originates from **our TipTap editor**, never from `EmailEditor`:

```
resolveExtensions → new ExtensionManager → Editor.createExtensionManager → new Editor
  → _EditorInstanceManager.createEditor (useEditor, @tiptap/react)   ← TipTapEditor.tsx
```

and (when the **Email-safe** output mode is rendered):

```
resolveExtensions → renderToElement → renderToHTMLString (@tiptap/static-renderer)
  → serializeToEmailHTML (src/email-serializer.ts)
```

There are two duplicate-registration sites in our code:

- `src/editors/tiptap/TipTapEditor.tsx` (lines 47–53): `extensions: [StarterKit.configure({...}), Underline, Indent]`
- `src/email-serializer.ts` (line 97): `const extensions = [StarterKit, Underline, Indent]`

In TipTap **v3**, `@tiptap/starter-kit` already includes the `Underline` extension (`node_modules/@tiptap/starter-kit/dist/index.js` line 84: `if (this.options.underline !== false) extensions.push(Underline...)`). Adding the standalone `@tiptap/extension-underline` on top registers the name `underline` twice. This pattern was correct in TipTap v2 (whose StarterKit did *not* include underline) — it is a v2→v3 migration leftover.

`@react-email/editor` itself handles this correctly: its own `reactEmailStarterKit` passes `underline: false` to TipTap's StarterKit and registers its own `Underline` (an `EmailMark.from(UnderlineBase, ...)`) exactly once (`dist/extensions-Bv5gFQWm.mjs`, `addExtensions()`). With stack-trace hooks in place, the `EmailEditor` mount produces **zero** duplicate-extension warnings.

### Verdict

**Ours.** Fix: remove the standalone `Underline` from both extension arrays (or pass `underline: false` to `StarterKit.configure`), and drop the `@tiptap/extension-underline` dependency.

### Upstream issues

Not applicable (not an upstream bug). For completeness, GitHub search of `resend/react-email` for "Duplicate extension" returns no results.

### Impact

**Cosmetic in practice, but worth fixing.** When TipTap sees duplicate names, the later registration wins; here both registrations are the same `Underline` implementation from the same package version, so behavior is unchanged. It is still a config smell that could mask a real conflict later (e.g., if StarterKit's bundled Underline diverges from the standalone package).

---

## 2. Missing React `key` prop warning

### Exact console text

```
Each child in a list should have a unique "key" prop. See https://react.dev/link/warning-keys for more information.
```

Logged via `console.error`. The component stack runs through `react-dom`'s **server renderer** (`server.browser` → `warnForMissingKey` → `renderChildrenArray`), i.e. it fires during `@react-email/render`'s static render, not during normal UI rendering.

### Reproduced

Yes — but **only when calling `ref.getEmail()` / `ref.getEmailHTML()`** on a document that contains marked text (bold, italic, link, etc.). It does **not** fire on mount, typing, bubble-menu use, NodeSelector, or the slash-command menu (all verified interactively). Our current wrapper uses `editor.getHTML()` rather than `getEmailHTML()`, so the warning no longer appears in day-to-day use of this app; it was presumably observed when an earlier iteration called the email-export API. Reproduction in the current app required invoking `ref.getEmailHTML()` directly (verified: one `key` error per call with the test content loaded).

### Root cause

**Internal to `@react-email/editor`.** In `composeReactEmail` (`dist/core-C7MFC-X7.mjs`, region `src/core/serializer/compose-react-email.tsx`), `parseContent` maps the ProseMirror JSON to a React element array:

- Plain nodes are keyed: `jsx(NodeComponent, {...}, index)` ✓
- But when a node carries marks, the element is **re-wrapped without a key**:

```js
if (node.marks) for (const mark of sortMarksBySchema(node.marks, editor.schema)) {
    ...
    renderedNode = /* @__PURE__ */ jsx(MarkComponent, {
        mark, node, style: ..., extension: emailMark,
        children: renderedNode
    });   // ← no third (key) argument
}
return renderedNode;   // unkeyed element inside content.map(...)
```

So any text node with at least one mark becomes an unkeyed child of the mapped array, and React's static renderer (`@react-email/render` → `renderToReadableStream`) warns once per render.

### Verdict

**Upstream** (`resend/react-email`, `packages/editor`).

### Upstream issues

None found for the editor package. Closest matches are about *different* packages and predate the editor:

- [resend/react-email#1150](https://github.com/resend/react-email/issues/1150) — same symptom in `@react-email/render` with Tailwind (closed, 2024)
- [resend/react-email#1111](https://github.com/resend/react-email/issues/1111) — `@react-email/tailwind` (closed, 2024)

GitHub searches for `unique key` + editor, `composeReactEmail`, and `EmailEditor` in `resend/react-email` return nothing editor-related → **none found**.

### Impact

**Cosmetic.** The render is a one-shot static HTML serialization — there is no reconciliation pass where missing keys could cause mis-rendering. The only cost is console noise (in dev and prod, since the warning comes from the server renderer bundled with `@react-email/render`).

### Draft upstream issue (not filed)

> **Title:** `@react-email/editor`: `getEmail()`/`getEmailHTML()` logs `Each child in a list should have a unique "key" prop.` when content contains marks
>
> **Body:**
> Calling `ref.getEmail()` or `ref.getEmailHTML()` on a document containing any marked text (bold, italic, underline, link, …) logs a React key warning via `console.error`:
>
> ```
> Each child in a list should have a unique "key" prop. See https://react.dev/link/warning-keys for more information.
> ```
>
> **Versions:** `@react-email/editor` 1.5.4, React 19.2.6
>
> **Repro:**
> 1. Render `<EmailEditor ref={ref} content="<p><strong>hi</strong></p>" />`
> 2. Call `await ref.current.getEmailHTML()`
> 3. Observe the key warning from react-dom's server renderer.
>
> **Cause:** In `src/core/serializer/compose-react-email.tsx`, `parseContent` keys plain node elements (`jsx(NodeComponent, {...}, index)`), but when a node has marks it re-wraps the element with `jsx(MarkComponent, { ... })` **without a key**, so the outermost element returned from `content.map(...)` is unkeyed whenever marks are present.
>
> **Suggested fix:** pass `index` as the key on the outermost wrapper, e.g. key the final `renderedNode` after mark wrapping (or key each `MarkComponent` with `` `${index}-${mark.type}` ``).
>
> Impact is cosmetic (static one-shot render), but it pollutes the console on every email export.

---

## 3. `TextSelection` ProseMirror warning

### Exact console text

```
TextSelection endpoint not pointing into a node with inline content (doc)
```

Logged via `console.warn` by `prosemirror-state`'s `checkTextSelection`.

### Reproduced

Yes. Contrary to the todo's "on init" description, it fires **whenever the React Email editor loses focus** (e.g. focus the editor, then click our "Load test content" button or anywhere outside the editor chrome). Verified both ways: clicking the button *without* prior editor focus produces no warning; clicking it *after* focusing the editor produces exactly one.

### Root cause

**Internal to `@react-email/editor`.** Captured stack:

```
checkTextSelection → new TextSelection → TextSelection.create
  → blur (@react-email/editor)
  → HTMLDivElement.handleFocusOut (@react-email/editor)
```

In the package's `FocusScopes` extension (`dist/focus-scopes-DOsiXV7b.mjs`, region `src/extensions/focus-scopes.ts`, line 396), the `focusout` handler clears the selection on blur:

```js
if (clearSelectionOnBlur) transaction.setSelection(TextSelection.create(transaction.doc, 0));
```

`clearSelectionOnBlur` defaults to `true`. Position `0` in the react-email document sits at the `doc` boundary — the doc's first child is a block container (`body`/`container`), not a node with inline content — so ProseMirror's `TextSelection` constructor emits the warning every time. The correct API for "collapse selection to the start" is `Selection.atStart(doc)` (or `TextSelection.near(doc.resolve(0))`), which searches for the nearest valid inline position.

### Verdict

**Upstream** (`resend/react-email`, `packages/editor`).

**Workaround available in our code (untested):** the option is exposed through the react-email StarterKit config, so passing a custom `extensions` array with `StarterKit.configure({ FocusScopes: { clearSelectionOnBlur: false } })` would silence it — at the cost of replacing the default extension stack and losing the (intentional) clear-selection-on-blur behavior. Not worth it for a console warning.

### Upstream issues

**None found** in `resend/react-email` (GitHub web search + `gh search issues` for "TextSelection", "blur selection"). The same message has been reported against other TipTap/ProseMirror products (e.g. [ueberdosis/tiptap#2846](https://github.com/ueberdosis/tiptap/issues/2846), [TypeCellOS/BlockNote#1606](https://github.com/TypeCellOS/BlockNote/issues/1606)), confirming it is the standard `prosemirror-state` complaint about invalid `TextSelection` endpoints.

### Impact

**Cosmetic.** ProseMirror only warns; it still constructs the selection, and the editor's subsequent focus/selection behavior is correct in testing (selection is restored cleanly on refocus, typing and toolbar commands unaffected). One warning per blur does add steady console noise during normal use.

### Draft upstream issue (not filed)

> **Title:** `@react-email/editor`: FocusScopes `clearSelectionOnBlur` triggers `TextSelection endpoint not pointing into a node with inline content (doc)` on every blur
>
> **Body:**
> Every time the editor loses focus, ProseMirror logs:
>
> ```
> TextSelection endpoint not pointing into a node with inline content (doc)
> ```
>
> **Versions:** `@react-email/editor` 1.5.4, `@tiptap/*` 3.26.1
>
> **Repro:**
> 1. Render a default `<EmailEditor />`
> 2. Click into the editor
> 3. Click anywhere outside it (blur)
> 4. Warning appears in the console once per blur.
>
> **Cause:** In `src/extensions/focus-scopes.ts`, the `focusout` handler runs (with the default `clearSelectionOnBlur: true`):
>
> ```ts
> transaction.setSelection(TextSelection.create(transaction.doc, 0));
> ```
>
> Position `0` is the `doc` boundary; the first child of the react-email doc is a block node (`body`/`container`), not inline content, so `prosemirror-state`'s `checkTextSelection` warns on every call.
>
> **Suggested fix:** use `Selection.atStart(transaction.doc)` (or `TextSelection.near(transaction.doc.resolve(0))`) instead of `TextSelection.create(doc, 0)`, which resolves to the nearest valid inline position without warning.
>
> Impact is cosmetic, but it fires on every blur, so any app embedding the editor accumulates console noise.

---

## Summary

| # | Warning | Trigger | Ours or upstream | Upstream issue | Impact |
|---|---|---|---|---|---|
| 1 | `Duplicate extension names found: ['underline']` | Page load (×2 from StrictMode); also Email-safe serialization | **Ours** — standalone `Underline` added alongside TipTap v3 StarterKit (which now bundles it) in `TipTapEditor.tsx` and `email-serializer.ts:97` | n/a | Cosmetic (same extension wins); fix by removing the standalone import |
| 2 | `Each child in a list should have a unique "key" prop.` | `ref.getEmail()` / `getEmailHTML()` with marked text | **Upstream** — unkeyed `MarkComponent` wrapper in `compose-react-email.tsx` | None found ([#1150](https://github.com/resend/react-email/issues/1150) is `@react-email/render`, unrelated) | Cosmetic (static render, no reconciliation) |
| 3 | `TextSelection endpoint not pointing into a node with inline content (doc)` | Editor blur (not init) | **Upstream** — `TextSelection.create(doc, 0)` in `focus-scopes.ts` `clearSelectionOnBlur` | None found | Cosmetic (one warning per blur) |

## Sources

- Local: `node_modules/@react-email/editor/dist/extensions-Bv5gFQWm.mjs` (reactEmailStarterKit, Underline)
- Local: `node_modules/@react-email/editor/dist/core-C7MFC-X7.mjs` (`composeReactEmail`/`parseContent`)
- Local: `node_modules/@react-email/editor/dist/focus-scopes-DOsiXV7b.mjs` (`createFocusScopePlugin`)
- Local: `node_modules/@react-email/editor/dist/index.mjs` (`EmailEditor`, `RefBridge`/`getEmail*`)
- Local: `node_modules/@tiptap/starter-kit/dist/index.js` (bundled Underline in v3)
- [resend/react-email issues](https://github.com/resend/react-email/issues) — searched via web + `gh search issues`
- [ueberdosis/tiptap#2846](https://github.com/ueberdosis/tiptap/issues/2846) — origin of the `TextSelection` warning in prosemirror-state ≥1.4
