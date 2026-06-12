# TipTap HTML Serialisation & Email Safety

**Date:** 2026-06-12  
**Scope:** TipTap v3 (current as of June 2026). Covers `getHTML()` output, email-safe serialisation options, available packages, and a recommended implementation approach.

---

## Table of Contents

1. [What `getHTML()` Produces](#1-what-gethtml-produces)
2. [No Built-in Email Serialisation Mode](#2-no-built-in-email-serialisation-mode)
3. [Available Packages and Community Extensions](#3-available-packages-and-community-extensions)
4. [Approaches: Custom `renderHTML` vs Post-Processing](#4-approaches-custom-renderhtml-vs-post-processing)
5. [How TipTap `renderHTML` Works](#5-how-tiptap-renderhtml-works)
6. [Email Client Compatibility Analysis](#6-email-client-compatibility-analysis)
7. [Recommended Inline Styles Per Element](#7-recommended-inline-styles-per-element)
8. [Recommended Implementation](#8-recommended-implementation)
9. [References](#9-references)

---

## 1. What `getHTML()` Produces

TipTap's `editor.getHTML()` method (and the equivalent `generateHTML()` utility from `@tiptap/html` or `@tiptap/core`) serialises the editor's ProseMirror document to a plain HTML string. **It uses semantic HTML tags only — no inline styles are added by default.**

This is confirmed by reading the actual extension source code in the TipTap repository ([ueberdosis/tiptap on GitHub](https://github.com/ueberdosis/tiptap)). Every `renderHTML` method returns a bare tag name merged with any user-configured `HTMLAttributes` (which default to an empty object `{}`).

### Tag mapping for supported formatting

| Format | TipTap Extension | HTML output |
|---|---|---|
| Paragraph | `extension-paragraph` | `<p>` |
| Heading H1 | `extension-heading` | `<h1>` |
| Heading H2 | `extension-heading` | `<h2>` |
| Heading H3 | `extension-heading` | `<h3>` |
| Bold | `extension-bold` | `<strong>` |
| Italic | `extension-italic` | `<em>` |
| Underline | `extension-underline` | `<u>` |
| Strikethrough | `extension-strike` | `<s>` |
| Bullet List | `extension-list` (BulletList) | `<ul>` |
| Ordered List | `extension-list` (OrderedList) | `<ol>` |
| List Item | `extension-list` (ListItem) | `<li>` |

Source-verified `renderHTML` definitions (current `main` branch):

```typescript
// Bold (bold.tsx)
renderHTML({ HTMLAttributes }) {
  return <strong {...mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)}><slot /></strong>
}

// Italic (italic.ts)
renderHTML({ HTMLAttributes }) {
  return ['em', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
}

// Underline (underline.ts)
renderHTML({ HTMLAttributes }) {
  return ['u', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
}

// Strike (strike.ts)
renderHTML({ HTMLAttributes }) {
  return ['s', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
}

// Heading (heading.ts)
renderHTML({ node, HTMLAttributes }) {
  const level = this.options.levels.includes(node.attrs.level)
    ? node.attrs.level
    : this.options.levels[0]
  return [`h${level}`, mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
}

// BulletList (bullet-list.ts)
renderHTML({ HTMLAttributes }) {
  return ['ul', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
}

// OrderedList (ordered-list.ts)
renderHTML({ HTMLAttributes }) {
  // omits `start` attribute when start === 1
  return ['ol', mergeAttributes(this.options.HTMLAttributes, attributesWithoutStart), 0]
}

// ListItem (list-item.ts)
renderHTML({ HTMLAttributes }) {
  return ['li', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
}

// Paragraph (paragraph.ts)
renderHTML({ HTMLAttributes }) {
  return ['p', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
}
```

### Example output

A document with an H1, bold text, a bullet list, and strikethrough would produce HTML like:

```html
<h1>My Heading</h1>
<p>Hello <strong>world</strong> and <em>everyone</em>.</p>
<p>This is <u>underlined</u> and <s>strikethrough</s>.</p>
<ul>
  <li>Item one</li>
  <li>Item two</li>
</ul>
```

**No CSS classes, no inline styles, no `style` attributes of any kind** unless the user has explicitly configured `HTMLAttributes` on an extension.

---

## 2. No Built-in Email Serialisation Mode

TipTap has **no built-in "email mode" or email serialiser**. The official documentation mentions that HTML output "can be easily rendered in other places, for example in emails," but this is aspirational marketing language — it does not mean the output is email-client-safe out of the box.

A search of the `@tiptap/*` namespace on npm confirmed that **`@tiptap/extension-email` does not exist**. No email-specific extension was found under the official `@tiptap` scope as of June 2026.

The TipTap pro extensions list (tiptap.dev/docs/guides/pro-extensions) also contains no email-specific serialiser.

---

## 3. Available Packages and Community Extensions

### 3.1 Official TipTap packages relevant to serialisation

| Package | Purpose | Email-relevant? |
|---|---|---|
| `@tiptap/html` | Server/browser `generateHTML()` utility | Partially — generates HTML without an editor, but still no inline styles |
| `@tiptap/static-renderer` | Render JSON to HTML string, Markdown, or React without an editor instance | Yes — supports custom `nodeMapping` / `markMapping` for full output control |
| `@tiptap/core` | `generateHTML()` (browser-only variant) | Same caveats as `@tiptap/html` |

`@tiptap/static-renderer` is the most relevant official tool, providing a `renderToHTMLString()` function that accepts override mappings:

```js
import { renderToHTMLString, serializeChildrenToHTMLString } from '@tiptap/static-renderer/pm/html-string'

renderToHTMLString({
  extensions: [StarterKit],
  content: yourJSONContent,
  options: {
    nodeMapping: {
      paragraph({ children }) {
        return `<p style="margin: 0 0 16px 0;">${serializeChildrenToHTMLString(children)}</p>`
      },
    },
    markMapping: {
      bold({ children }) {
        return `<strong style="font-weight: bold;">${serializeChildrenToHTMLString(children)}</strong>`
      },
    },
  },
})
```

Docs: [tiptap.dev/docs/editor/api/utilities/static-renderer](https://tiptap.dev/docs/editor/api/utilities/static-renderer)

### 3.2 Community packages

#### `tiptap-markdown` / `@tiptap/markdown`
Provides Markdown import/export. Not relevant to email. ([npmjs.com/package/tiptap-markdown](https://www.npmjs.com/package/tiptap-markdown))

#### Maily (`@maily-to/render`)
The most mature TipTap-based email rendering library found in the community. Open source, actively maintained (last commit June 2026). Repo: [github.com/arikchakma/maily.to](https://github.com/arikchakma/maily.to).

Maily works by walking TipTap JSON and mapping each node type to a React Email component. It uses `@react-email/components` for email-safe primitives, then calls `juice` (CSS inliner) as a post-processing step. Key details from source:

- **Bold**: `<strong>{text}</strong>` (no inline style — relies on `<strong>` being sufficient)
- **Italic**: `<em>{text}</em>`
- **Underline**: `<u>{text}</u>`
- **Strikethrough**: `<s style={{ textDecoration: 'line-through' }}>{text}</s>` — inline style added explicitly
- **Headings**: Rendered via React Email's `<Heading>` component with hard-coded `fontSize`, `lineHeight`, `fontWeight` per level (H1: 36px/40px/800, H2: 30px/36px/700, H3: 24px/38px/600)
- **Bullet list**: Wrapped in `<Container>` then `<ul style={{ paddingLeft: '26px', listStyleType: 'disc' }}>`, items as `<li style={{ marginBottom: '8px', ... }}>`
- **Ordered list**: `<ol style={{ paddingLeft: '26px', listStyleType: 'decimal' }}>`, same `<li>` structure
- Final pass: calls `juice` to inline any remaining CSS

Maily is a full editor platform, not a drop-in serialiser library. However, its approach patterns are directly instructive.

#### `email-template-builder` by noobships
([github.com/noobships/email-template-builder](https://github.com/noobships/email-template-builder)) — Uses `@tiptap/static-renderer` with React Email components. Stores content as JSON, renders email HTML via a custom `lib/tiptap-react-email-renderer.tsx`.

#### No standalone npm package for "TipTap email-safe HTML"
Despite a thorough search of npm and GitHub, there is **no general-purpose standalone npm package** that takes TipTap HTML or JSON and outputs inline-styled email-safe HTML. The GitHub topic `tiptap-email` has only two repositories (Maily and a derivative).

---

## 4. Approaches: Custom `renderHTML` vs Post-Processing

There are three distinct strategies for producing email-safe HTML from TipTap. Each has different trade-offs.

### Approach A: Override `renderHTML` on each extension

Extend TipTap's built-in extensions using `.extend({ renderHTML() { ... } })` so the inline styles are baked into the serialisation.

**Pros:**
- Single source of truth — the same extensions used for editing produce email-safe HTML
- No post-processing step needed
- Works with both `editor.getHTML()` and `generateHTML()`
- Clean, TipTap-idiomatic approach

**Cons:**
- The inline styles will also appear in the live editor DOM, which can interfere with your editor's stylesheet (you may be using CSS classes for editor display)
- Need to maintain a separate set of extensions or use a flag to switch between editor and email mode
- `renderHTML` changes affect the editor's own rendering — less suitable if you want clean semantic markup in the editor and styled output only for email

### Approach B: Use `@tiptap/static-renderer` with custom mappings

Call `renderToHTMLString()` with a custom `nodeMapping` and `markMapping` when generating email HTML, entirely separate from the live editor.

**Pros:**
- Zero impact on the live editor rendering — editor extensions remain clean
- Complete control over the email output (any tag, any style)
- Works server-side or in a background step without a DOM
- Most flexible — can also render to React Email components if needed

**Cons:**
- Requires maintaining a separate mapping object alongside the extension definitions
- Must keep mappings in sync as extensions are added/changed

### Approach C: Post-process `getHTML()` output with a DOMParser pass or CSS inliner

Call `editor.getHTML()` and then transform the raw HTML string — either by running it through a tool like `juice` (which inlines CSS from a stylesheet) or writing a DOMParser-based walker that adds `style` attributes element by element.

**Pros:**
- Conceptually simple — start from what TipTap already gives you
- `juice` is a mature, well-tested package

**Cons:**
- Requires an additional npm dependency (`juice`) and a CSS stylesheet to inline
- In a browser context, `juice` needs a DOM environment or server-side execution
- CSS inlining via a stylesheet is less predictable than explicit per-element styles
- Adds complexity without being cleaner than Approach B

### Recommendation summary

| Approach | Complexity | Editor impact | Server-side safe | Recommended |
|---|---|---|---|---|
| A: Override `renderHTML` | Medium | Yes (styles bleed into editor) | Yes | Only if editor and email use same render path |
| B: Static renderer with mappings | Low–Medium | None | Yes | **Yes — preferred** |
| C: Post-process / CSS inliner | Medium–High | None | Conditional | Avoid unless already using `juice` |

**Approach B is recommended.** It is the cleanest separation of concerns: the editor extensions remain focused on editing, and a dedicated email serialiser function produces email-safe output from the same JSON.

---

## 5. How TipTap `renderHTML` Works

For completeness, the mechanics of `renderHTML` and how to override it on StarterKit extensions.

### The `extend()` pattern

Every TipTap extension exposes a static `.extend()` method that accepts a partial override object. The name is the only property that cannot be changed.

```typescript
import { Bold } from '@tiptap/extension-bold'
import { mergeAttributes } from '@tiptap/core'

const EmailBold = Bold.extend({
  renderHTML({ HTMLAttributes }) {
    return [
      'strong',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        style: 'font-weight: bold;',
      }),
      0,
    ]
  },
})
```

### Using the extended extension

Pass the extended extension instead of the original. With StarterKit, disable the built-in version and pass your override:

```typescript
import StarterKit from '@tiptap/starter-kit'

const editor = new Editor({
  extensions: [
    StarterKit.configure({
      bold: false,       // disable StarterKit's built-in Bold
      italic: false,
      strike: false,
      // ...etc
    }),
    EmailBold,         // your custom version
    EmailItalic,
    EmailStrike,
    // ...
  ],
})
```

### The `renderHTML` return value

The function returns a ProseMirror-compatible array (or JSX in v3's TSX extensions):

```typescript
// Array form (most extensions):
return ['tag', { /* attributes */ }, 0]
// `0` is the "hole" marker — where child content is inserted

// Nested form (e.g., CodeBlock):
return ['pre', ['code', HTMLAttributes, 0]]

// JSX form (v3 Bold uses JSX):
return <strong {...mergeAttributes(attrs)}><slot /></strong>
```

`mergeAttributes` from `@tiptap/core` safely merges multiple attribute objects, including deduplicating `class` strings.

---

## 6. Email Client Compatibility Analysis

### 6.1 Semantic tag support

Based on data from [caniemail.com](https://www.caniemail.com) and community research:

| Tag | Gmail | Outlook (Windows) | Apple Mail | Yahoo Mail | Notes |
|---|---|---|---|---|---|
| `<strong>` | ✅ | ✅ | ✅ | ✅ | **100% support** per caniemail.com |
| `<em>` | ✅ | ✅ | ✅ | ✅ | Broadly supported |
| `<u>` | ✅ | ✅ | ✅ | ⚠️ | Yahoo/AOL may strip `<ins>` (not `<u>`) |
| `<s>` | ⚠️ | ⚠️ | ✅ | ✅ | GMX and Web.de **strip `<s>` entirely** |
| `<h1>`–`<h3>` | ✅ | ⚠️ | ✅ | ✅ | Outlook/Samsung/Yahoo reset `font-size` and `margin` |
| `<ul>`, `<ol>` | ✅ | ⚠️ | ✅ | ✅ | Outlook may add extra spacing; padding needs explicit values |
| `<li>` | ✅ | ⚠️ | ✅ | ✅ | Spacing varies; `padding-left` inconsistent in Outlook |
| `<p>` | ✅ | ✅ | ✅ | ✅ | Universally supported |

### 6.2 Why semantic tags alone are insufficient

- **Headings**: Outlook desktop (Windows), Samsung Email, mail.ru, and Yahoo (IE-based) perform a CSS reset that zeroes out `font-size` and `margin` on heading elements. Without explicit inline styles, H1 and H2 look identical to body text in those clients.
- **Strikethrough (`<s>`)**: GMX and Web.de strip `<s>` entirely. A nested `<span style="text-decoration: line-through;">` is the safe fallback.
- **Underline (`<u>`)**: `<u>` itself is well-supported, but older semantic alternatives (`<ins>`) are stripped by Yahoo/AOL.
- **Bold (`<strong>`)**: Essentially universal, but some very old IE-based clients (now rare) did not always apply bold styling; `font-weight: bold` inline is belt-and-braces.
- **Lists**: Outlook renders lists using the Word rendering engine, which can produce extra indentation or drop custom `padding-left` values. Explicit `padding-left: 26px` and `list-style-type` inline are needed.
- **`font-weight` CSS property**: Supported in Apple Mail and Gmail; only partially supported in Outlook and Yahoo Mail (per caniemail.com/features/css-font-weight/). This is why inline `font-weight: bold` on `<strong>` is a useful belt-and-braces measure.

**Conclusion**: The output of `editor.getHTML()` is not email-safe as-is. The semantic tags are correct, but the absence of inline styles means the rendering will be broken or inconsistent in Outlook desktop, GMX/Web.de (for `<s>`), and Yahoo Mail (for headings).

---

## 7. Recommended Inline Styles Per Element

Based on guidance from [goodemailcode.com](https://www.goodemailcode.com/email-code/text.html), [caniemail.com](https://www.caniemail.com), [edmdesigner.com](https://blog.edmdesigner.com/typography-in-modern-html-emails/), and real-world patterns from Maily's source code.

### Text marks

```html
<!-- Bold -->
<strong style="font-weight: bold;">text</strong>

<!-- Italic -->
<em style="font-style: italic;">text</em>

<!-- Underline — <u> is fine; add inline style for redundancy -->
<u style="text-decoration: underline;">text</u>

<!-- Strikethrough — must include nested span for GMX/Web.de -->
<s style="text-decoration: line-through;">
  <span style="text-decoration: line-through;">text</span>
</s>
<!-- OR simply: -->
<span style="text-decoration: line-through;">text</span>
```

### Headings

Based on edmdesigner.com recommendations and Maily's hard-coded values. Margins are reset explicitly because Outlook/Samsung/Yahoo perform their own reset.

```html
<h1 style="font-size: 36px; line-height: 40px; font-weight: 800; margin: 0 0 16px 0;">Heading 1</h1>
<h2 style="font-size: 30px; line-height: 36px; font-weight: 700; margin: 0 0 12px 0;">Heading 2</h2>
<h3 style="font-size: 24px; line-height: 32px; font-weight: 600; margin: 0 0 10px 0;">Heading 3</h3>
```

### Paragraph

```html
<p style="margin: 0 0 16px 0;">Text</p>
```

### Lists

```html
<ul style="padding-left: 26px; margin: 0 0 16px 0; list-style-type: disc;">
  <li style="margin-bottom: 8px; margin-top: 8px; padding-left: 6px;">Item</li>
</ul>

<ol style="padding-left: 26px; margin: 0 0 16px 0; list-style-type: decimal;">
  <li style="margin-bottom: 8px; margin-top: 8px; padding-left: 6px;">Item</li>
</ol>
```

---

## 8. Recommended Implementation

### Overview

The recommended approach is **Approach B**: use `@tiptap/static-renderer`'s `renderToHTMLString()` with a custom `nodeMapping` and `markMapping` as a dedicated email serialiser. The live editor continues to use standard extensions unchanged.

This keeps the editor clean, the email output fully controlled, and requires only one additional package (`@tiptap/static-renderer`, which is already part of the TipTap ecosystem).

### Prerequisites

```bash
npm install @tiptap/static-renderer
# @tiptap/core and your extensions are already installed
```

### Implementation sketch

```typescript
// lib/emailSerializer.ts
import StarterKit from '@tiptap/starter-kit'
import { renderToHTMLString, serializeChildrenToHTMLString } from '@tiptap/static-renderer/pm/html-string'
import type { JSONContent } from '@tiptap/core'

type NodeRenderer = (opts: { node: JSONContent; children: unknown }) => string
type MarkRenderer = (opts: { mark: unknown; children: unknown }) => string

const nodeMapping: Record<string, NodeRenderer> = {
  doc({ children }) {
    return serializeChildrenToHTMLString(children)
  },
  paragraph({ children }) {
    return `<p style="margin: 0 0 16px 0;">${serializeChildrenToHTMLString(children)}</p>`
  },
  heading({ node, children }) {
    const level = (node.attrs?.level as number) || 1
    const styles: Record<number, string> = {
      1: 'font-size: 36px; line-height: 40px; font-weight: 800; margin: 0 0 16px 0;',
      2: 'font-size: 30px; line-height: 36px; font-weight: 700; margin: 0 0 12px 0;',
      3: 'font-size: 24px; line-height: 32px; font-weight: 600; margin: 0 0 10px 0;',
    }
    const style = styles[level] ?? styles[3]
    return `<h${level} style="${style}">${serializeChildrenToHTMLString(children)}</h${level}>`
  },
  bulletList({ children }) {
    return `<ul style="padding-left: 26px; margin: 0 0 16px 0; list-style-type: disc;">${serializeChildrenToHTMLString(children)}</ul>`
  },
  orderedList({ children }) {
    return `<ol style="padding-left: 26px; margin: 0 0 16px 0; list-style-type: decimal;">${serializeChildrenToHTMLString(children)}</ol>`
  },
  listItem({ children }) {
    return `<li style="margin-bottom: 8px; margin-top: 8px; padding-left: 6px;">${serializeChildrenToHTMLString(children)}</li>`
  },
  hardBreak() {
    return '<br />'
  },
  text({ node }) {
    return node.text ?? ''
  },
}

const markMapping: Record<string, MarkRenderer> = {
  bold({ children }) {
    return `<strong style="font-weight: bold;">${serializeChildrenToHTMLString(children)}</strong>`
  },
  italic({ children }) {
    return `<em style="font-style: italic;">${serializeChildrenToHTMLString(children)}</em>`
  },
  underline({ children }) {
    return `<u style="text-decoration: underline;">${serializeChildrenToHTMLString(children)}</u>`
  },
  strike({ children }) {
    // Double-wrap for GMX/Web.de which strip the <s> tag entirely
    return `<s style="text-decoration: line-through;"><span style="text-decoration: line-through;">${serializeChildrenToHTMLString(children)}</span></s>`
  },
}

/**
 * Converts TipTap JSON content to an email-safe HTML string with inline styles.
 * All elements that TipTap outputs without inline styles (headings, lists, etc.)
 * are given explicit inline styles for compatibility with Gmail, Outlook, Yahoo Mail, etc.
 */
export function serializeToEmailHTML(content: JSONContent): string {
  return renderToHTMLString({
    extensions: [StarterKit],
    content,
    options: {
      nodeMapping: nodeMapping as any,
      markMapping: markMapping as any,
    },
  })
}
```

### Usage

```typescript
// In your component or API handler
import { serializeToEmailHTML } from './lib/emailSerializer'

// Store JSON from the editor, not HTML:
const json = editor.getJSON()  // store this in your database

// When sending email:
const emailHtml = serializeToEmailHTML(json)

// Wrap in an email-safe container before sending:
const fullEmailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #374151;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    ${emailHtml}
  </div>
</body>
</html>
`
```

### Alternative: Override `renderHTML` directly (when editor and email use the same render path)

If the project cannot take on `@tiptap/static-renderer` as a dependency (e.g., the codebase already calls `editor.getHTML()` everywhere and refactoring to store JSON is out of scope), then overriding `renderHTML` on the extensions is a viable fallback:

```typescript
import { Heading } from '@tiptap/extension-heading'
import { Bold } from '@tiptap/extension-bold'
import { mergeAttributes } from '@tiptap/core'

const headingStyles: Record<number, string> = {
  1: 'font-size: 36px; line-height: 40px; font-weight: 800; margin: 0 0 16px 0;',
  2: 'font-size: 30px; line-height: 36px; font-weight: 700; margin: 0 0 12px 0;',
  3: 'font-size: 24px; line-height: 32px; font-weight: 600; margin: 0 0 10px 0;',
}

const EmailHeading = Heading.extend({
  renderHTML({ node, HTMLAttributes }) {
    const level = node.attrs.level as number
    const style = headingStyles[level] ?? headingStyles[3]
    return [
      `h${level}`,
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { style }),
      0,
    ]
  },
})

// ...similar for Bold, Italic, Underline, Strike, BulletList, OrderedList, ListItem, Paragraph
```

**Caveat**: These styles will be present in the live editor DOM too. You may need to reset them in your editor's stylesheet (e.g., `.ProseMirror strong { font-weight: inherit; }`), or use a separate editor instance for display vs. email export.

### Storage recommendation

Regardless of serialisation approach, **store TipTap content as JSON** (via `editor.getJSON()`), not as HTML. This gives you a stable, format-agnostic source of truth that can be re-serialised to different output formats (editor display, email, plain text) as requirements change. JSON is also easier to process programmatically and does not carry stale inline styles from prior serialisation attempts.

---

## 9. References

- [TipTap HTML Utility docs](https://tiptap.dev/docs/editor/api/utilities/html)
- [TipTap Static Renderer docs](https://tiptap.dev/docs/editor/api/utilities/static-renderer)
- [TipTap Extend Existing Extensions](https://tiptap.dev/docs/editor/extensions/custom-extensions/extend-existing)
- [TipTap Export to JSON and HTML guide](https://tiptap.dev/docs/guides/output-json-html)
- [TipTap Bold extension docs](https://tiptap.dev/docs/editor/extensions/marks/bold)
- [TipTap Heading extension docs](https://tiptap.dev/docs/editor/api/nodes/heading)
- [TipTap source – Bold (bold.tsx)](https://github.com/ueberdosis/tiptap/blob/main/packages/extension-bold/src/bold.tsx)
- [TipTap source – Heading (heading.ts)](https://github.com/ueberdosis/tiptap/blob/main/packages/extension-heading/src/heading.ts)
- [TipTap source – Lists (extension-list)](https://github.com/ueberdosis/tiptap/tree/main/packages/extension-list/src)
- [Maily open-source email editor (arikchakma/maily.to)](https://github.com/arikchakma/maily.to)
- [noobships/email-template-builder](https://github.com/noobships/email-template-builder)
- [Can I Email – `<strong>` tag support](https://www.caniemail.com/features/html-strong/)
- [Can I Email – CSS font-weight support](https://www.caniemail.com/features/css-font-weight/)
- [Can I Email – CSS text-decoration support](https://www.caniemail.com/features/css-text-decoration/)
- [Good Email Code – text formatting](https://www.goodemailcode.com/email-code/text.html)
- [Litmus – strikethrough in email](https://litmus.com/community/discussions/175-using-strikethrough-text-in-email)
- [EDMdesigner – Typography in modern HTML emails](https://blog.edmdesigner.com/typography-in-modern-html-emails/)
- [HTML and CSS in Emails 2026 (designmodo)](https://designmodo.com/html-css-emails/)
- [Why Inline CSS is still essential for HTML emails](https://www.francescatabor.com/articles/2025/12/12/why-inline-css-is-still-essential-for-html-emails)
- [WooCommerce Email HTML Best Practices](https://developer.woocommerce.com/docs/features/email/email-html-best-practices/)
- [TipTap Discussion – retaining inline styles](https://github.com/ueberdosis/tiptap/discussions/5675)
- [npm @tiptap/html](https://www.npmjs.com/package/@tiptap/html)
- [npm @tiptap/static-renderer](https://www.npmjs.com/package/@tiptap/static-renderer)
- [awesome-tiptap community resources](https://github.com/ueberdosis/awesome-tiptap)
