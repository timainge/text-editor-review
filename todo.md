# To Do

## General
- [ ] indentation buttons are for text indent not list item indent, though if we wanted to get fancy they could have the effect of providing list hierarchy promotion/demotion for list items and for everything else text indent?
- [ ] make sure that all editor specific code is encapsulated in their respective `src/editors/{editor}` path so that we can easily compare what is required for each. truly common code and significant should be kept on a common path for the same reason. trivially common code like layout etc can be duplicated in respective editor dirs so as ot not create extra compositional noise.
- do a write up of each editor, what is required to make it meet the stated requirements and evaluate the complexity, reliability, flexibility of both. given that we have made both meet the requirement evaluate what other considerations make either one a better long term option.

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
- [ ] **Implement `src/email-serializer.ts`** — custom serializer using `@tiptap/static-renderer` with inline styles per the research findings:
  - Headings: `font-size`, `font-weight`, `line-height`, `margin-top`, `margin-bottom`, `color`, `mso-line-height-rule:exactly`
  - `<strong>`: add `style="font-weight:bold"`; `<em>`: add `style="font-style:italic"`
  - `<u>`: safe as-is; `<s>`: wrap content in `<span style="text-decoration:line-through">` for GMX fallback
  - `<ul>`/`<ol>`: add `margin`/`padding`; `<li>`: add `margin-left:25px; mso-special-format:bullet`
- [ ] Wire the serializer into both editors' HTML output panels with a UI selector (e.g. segmented control or dropdown) to switch between output modes:
  - **Raw** — `editor.getHTML()` / `ref.getEmailHTML()`, no post-processing
  - **Pretty** — raw output run through the existing `formatHTML` pretty-printer (TipTap only for now)
  - **Email-safe** — output from `serializeToEmailHTML()` with all inline styles applied
  This lets us directly compare what each mode produces for the same content and spot gaps in the serializer.
- [ ] Verify output against test content in a real email client (Gmail compose paste, or Litmus)

## Test data

- [x] Create test document (`src/test-content.ts`) covering all formatting types with realistic copy
- [x] "Load test content" button wired into TipTap editor
- [ ] Wire "Load test content" into React Email Editor once its API is confirmed
- [ ] Verify serialized HTML output renders correctly in at least one real email client

## Known issues

- [ ] `@react-email/editor` duplicate `underline` extension warning — internal to the package; file upstream issue
- [ ] `@react-email/editor` missing React `key` prop warning — internal to the package
- [ ] `@react-email/editor` `TextSelection` ProseMirror warning on init — internal to the package
- [ ] Evaluate keyboard accessibility of both toolbars: focus order, `Tab`/`Shift-Tab` through buttons, screen reader announcements for active state
