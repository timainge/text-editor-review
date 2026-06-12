# Email-Safe HTML: Tag, Attribute, and Inline Style Survival Guide

> Research date: June 2026  
> Sources: Can I Email (caniemail.com), Litmus, Email on Acid, Good Email Code, Campaign Monitor, Google Workspace Gmail CSS docs, and others. All citations are inline.

---

## Table of Contents

1. [Client Landscape and Rendering Engines](#1-client-landscape-and-rendering-engines)
2. [Style Blocks and Class Attributes](#2-style-blocks-and-class-attributes)
3. [Semantic HTML Tags: Safety Assessment](#3-semantic-html-tags-safety-assessment)
4. [Heading Tags: h1–h3 Deep Dive](#4-heading-tags-h1h3-deep-dive)
5. [List Tags: ul, ol, li](#5-list-tags-ul-ol-li)
6. [Inline Formatting: strong, em, u, s](#6-inline-formatting-strong-em-u-s)
7. [blockquote](#7-blockquote)
8. [Inline CSS Properties](#8-inline-css-properties)
9. [Cross-Client Summary Table](#9-cross-client-summary-table)
10. [Recommendations for This Project](#10-recommendations-for-this-project)

---

## 1. Client Landscape and Rendering Engines

Understanding *why* clients behave differently is the key to writing robust email HTML.

| Client | Rendering Engine | Notes |
|---|---|---|
| Gmail (web) | Browser DOM + Google sanitizer | Strips/rewrites styles; 102 KB HTML clip threshold |
| Gmail iOS | WebKit + Google sanitizer | Strips `<style>` for non-Google accounts (GANGA) |
| Gmail Android | Chromium + Google sanitizer | Same GANGA limitation |
| Apple Mail macOS | WebKit (Safari engine) | Most standards-compliant; 287/307 features supported |
| Apple Mail iOS | WebKit | 282/305 features; minor differences from macOS |
| Outlook 2016–2021 Windows | Microsoft Word (MSO engine) | The most problematic client; Word was not designed for HTML |
| Outlook.com | Browser DOM | Full `<style>` support; mostly well-behaved |
| New Outlook for Windows (2023+) | Chromium (WebView2) | Modern CSS largely works; some preview-pane bugs |
| Yahoo Mail | Browser DOM + Yahoo sanitizer | Full `<style>` support; several quirks documented |

**The central problem** is Outlook 2016–2021 Windows. It uses the Word rendering engine, which ignores flexbox, CSS Grid, `border-radius`, `background-image`, `max-width`, and many margin/padding rules. The practical upshot: **any email that must look correct in enterprise environments has to be coded around the Word engine.**

The "New Outlook" for Windows (the 2023+ Chromium-based client that Microsoft is migrating users to) is far more capable, but as of 2025–2026 the classic Word-engine Outlook still has significant active usage in enterprise settings, so it cannot yet be ignored.

Sources: [The Complete Guide to Email Client Rendering Differences in 2026 – DEV Community](https://dev.to/aoifecarrigan/the-complete-guide-to-email-client-rendering-differences-in-2026-243f), [New Outlook rendering issues – Customer.io](https://customer.io/learn/message-composing/new-outlook-rendering-issues), [caniemail.com scoreboard](https://www.caniemail.com/scoreboard/)

---

## 2. Style Blocks and Class Attributes

This is the most consequential decision for email HTML architecture.

### 2.1 `<style>` Block Support

| Client | `<style>` in `<head>` | Notes |
|---|---|---|
| Apple Mail macOS / iOS | ✅ Full | The most reliable |
| Outlook.com | ✅ Full | Supported since 2019-06 |
| Yahoo Mail | ✅ Full | Supported since 2019-06 |
| Gmail (web) | ⚠️ Partial | Supported in `<head>` only; stripped if block > 8,192 chars; stripped if any invalid/nested `@` rule is encountered |
| Gmail iOS | ⚠️ Partial | Not supported for non-Google-account (GANGA) users |
| Gmail Android | ⚠️ Partial | Same GANGA limitation |
| Outlook 2016–2021 | ⚠️ Buggy | `<style>` elements must be declared before their rules are used; limited to MSO-targeting |

Sources: [Can I Email – `<style>` element](https://www.caniemail.com/features/html-style/), [FreshInbox – Gmail supports the Style tag… sort of](https://freshinbox.com/blog/gmail-supports-style-sort-of/), [Email on Acid – Gmail development guide](https://www.emailonacid.com/blog/article/email-development/12-things-you-must-know-when-developing-for-gmail-and-gmail-mobile-apps-2/)

### 2.2 Class Attributes

**Gmail strips `class` and `id` attributes** from email body elements. Even if Gmail does process a `<style>` block in the head, class-selector rules (`.foo { color: red }`) will not match anything in the body because Gmail removes the class attributes during sanitization. Gmail also strips `id` attributes for the same reason.

The only reliable way to style for Gmail is **inline styles on every element**.

There is a workaround: Gmail does *not* strip the `title` attribute, so `[title="foo"]` CSS attribute selectors can function in Gmail web. However, this is a niche technique and does not work in Gmail mobile apps.

**Other clients** (Apple Mail, Yahoo Mail, Outlook.com) do support class attributes when a `<style>` block is also present. But since Gmail is typically the highest-volume client (roughly 30%+ of market share), relying on class-based styles alone is dangerous.

**Practical conclusion:** Write all structural and visual styles as inline styles. Use a `<style>` block only for:
- MSO-targeting conditional comments (Outlook-specific fixes)
- Mobile media queries for responsive adjustments
- CSS resets that are acceptable to degrade gracefully

Sources: [Litmus – Understanding Gmail and CSS](https://www.litmus.com/blog/understanding-gmail-and-css-part-1), [Gmail CSS Support – Google Developers](https://developers.google.com/workspace/gmail/design/css), [FreshInbox – CSS classes in Gmail](https://freshinbox.com/blog/gmail-supports-style-sort-of/)

---

## 3. Semantic HTML Tags: Safety Assessment

### Quick-reference table

| Tag | Gmail | Apple Mail | Outlook 2016–2021 | Outlook.com | Yahoo Mail | Safe? |
|---|---|---|---|---|---|---|
| `<h1>`–`<h3>` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Yes — needs inline styles |
| `<p>` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Yes — add `margin:0` |
| `<ul>`, `<ol>` | ✅ | ✅ | ⚠️ Partial | ✅ | ✅ | ⚠️ Yes with fixes |
| `<li>` | ✅ | ✅ | ⚠️ Partial | ✅ | ✅ | ⚠️ Yes with fixes |
| `<strong>` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Yes — add `font-weight:bold` |
| `<em>` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Yes — add `font-style:italic` |
| `<u>` | ✅ | ✅ | ✅ | ✅ | ⚠️ Yahoo/AOL strips `<ins>` | ✅ Yes — add `text-decoration:underline` |
| `<s>` | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ GMX/Web.de strip it; add span fallback |
| `<br>` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Universally safe |
| `<blockquote>` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Yes — reset default margin |

Sources: [Can I Email – `<strong>`](https://www.caniemail.com/features/html-strong/), [Can I Email – `<del>`](https://www.caniemail.com/features/html-del/), [Can I Email – lists](https://www.caniemail.com/features/html-lists/), [Can I Email – `<blockquote>`](https://www.caniemail.com/features/html-blockquote/), [Good Email Code – text](https://www.goodemailcode.com/email-code/text)

---

## 4. Heading Tags: h1–h3 Deep Dive

### 4.1 Tag support

`<h1>` through `<h3>` are **100% supported** in all major clients according to Can I Email data — Gmail, Apple Mail, Outlook 2016+, Outlook.com, and Yahoo Mail all render heading tags. The tag is never stripped. Source: [Can I Email – `<h1>` to `<h6>`](https://www.caniemail.com/features/html-h1-h6/)

### 4.2 Why inline styles are still required

Support for the *tag* does not mean support for *default heading presentation*. Several clients apply their own user-agent stylesheet resets to headings:

- **Outlook 2016–2021 Windows** performs margin and/or `font-size` resets on headings. Without explicit inline styles, heading sizes and spacing will be wrong.
- **Yahoo Mail** also applies `font-size` and `margin` resets.
- **Samsung Mail** resets margins on headings.
- **LaPoste.net** (a smaller French webmail) forces `<h1>` to `color:#fff` and `<h2>` to `background:#354963` — which could make text invisible on certain backgrounds.

Additionally, Outlook's Word engine applies a **green tint to headings below h1** if no explicit color is set. Setting `color` inline avoids this.

Source: [Good Email Code – text](https://www.goodemailcode.com/email-code/text), [Typography in Modern HTML Emails – EDMdesigner](https://blog.edmdesigner.com/typography-in-modern-html-emails/), [Can I Email – `<h1>` to `<h6>`](https://www.caniemail.com/features/html-h1-h6/)

### 4.3 Required inline styles for headings

Based on browser user-agent stylesheet defaults and the specific resets applied by Outlook and Yahoo, the minimum safe inline style set for headings is:

```html
<h1 style="margin:0.67em 0; font-size:2em; line-height:1.2; font-weight:bold;">
<h2 style="margin:0.83em 0; font-size:1.5em; line-height:1.2; font-weight:bold;">
<h3 style="margin:1em 0; font-size:1.17em; line-height:1.3; font-weight:bold;">
```

**Why each property:**

| Property | Why needed |
|---|---|
| `font-size` | Outlook and Yahoo reset heading sizes; explicit value overrides the reset |
| `margin` | Outlook and Yahoo strip or change default margins; must be set inline |
| `line-height` | Without `mso-line-height-rule: exactly`, Outlook expands line height unpredictably (especially when emoji are present) |
| `font-weight: bold` | Belt-and-suspenders for legacy IE/Outlook where `<h1>` bold may not apply |
| `color` | Prevents the Outlook green tint applied to h2–h6 |

**For Outlook Windows specifically**, add the MSO line-height rule to prevent layout-breaking expansion:

```html
<h1 style="...line-height:32px; mso-line-height-rule:exactly;">
```

`mso-line-height-rule: exactly` tells Outlook to use precisely the value specified rather than auto-expanding for tall glyphs or emoji. Without it, a 24px line can silently become 34px+, shifting everything below it.

Source: [Good Email Code – text](https://www.goodemailcode.com/email-code/text), [Tabular – mso-line-height-rule explained](https://tabular.email/blog/mso-line-height-rule-exactly-explained), [EDMdesigner – typography](https://blog.edmdesigner.com/typography-in-modern-html-emails/)

### 4.4 Avoid padding on heading tags in Outlook

Outlook converts heading tags and divs to paragraphs with nested spans, stripping block-level styling including padding. If spacing around a heading is needed, move it to the containing `<td>` element instead:

```html
<td style="padding-top:16px; padding-bottom:8px;">
  <h2 style="margin:0; font-size:1.5em; color:#333333;">Section Title</h2>
</td>
```

Source: [Email on Acid – Outlook tips](https://www.emailonacid.com/tip/outlook-desktop/)

---

## 5. List Tags: ul, ol, li

### 5.1 Basic support

According to Can I Email, `<ul>`, `<ol>`, and `<li>` have broad support with one universal partial-support caveat: the `reversed` attribute on `<ol>` is not supported in Gmail, Outlook.com, or Yahoo Mail. For standard forward-counting ordered lists and all unordered lists, support is effectively universal.

The `value` attribute on `<li>` (for setting a specific number) causes Outlook desktop to close the list prematurely — avoid it.

Source: [Can I Email – `<ul>`, `<ol>`, `<dl>`](https://www.caniemail.com/features/html-lists/)

### 5.2 Outlook Windows rendering problems

Classic Outlook 2007–2019 (Word engine) has well-documented list rendering problems:

1. **Bullets may not appear** — `<li>` elements can be converted to `<p>` elements, losing bullet points entirely.
2. **Large default margins** — Outlook adds approximately 48px of left margin to lists, which can push content outside container boundaries.
3. **Margin changes break bullets** — When a `margin-left` value is applied to the `<ul>`, Outlook converts `<li>` items to `<p>` elements, removing the bullet.
4. **Cannot change bullet color or `font-weight` on ordered list numbers** — This is a hard Outlook limitation.

Sources: [Litmus – Ultimate Guide to Bullet Points in HTML Email](https://www.litmus.com/blog/the-ultimate-guide-to-bulleted-lists-in-html-email), [Uplers – Bullet list Outlook hacks](https://email.uplers.com/blog/bullet-list-outlook-hacks/), [Email on Acid – Outlook tips](https://www.emailonacid.com/tip/outlook-desktop/)

### 5.3 Recommended list implementation

The most reliable cross-client approach uses `mso-special-format:bullet` for Outlook and standard margin resets for other clients:

```html
<ul style="margin:0; padding:0; list-style-type:disc;">
  <li style="margin-left:25px; margin-bottom:4px; mso-special-format:bullet;">
    List item text
  </li>
</ul>
```

For Outlook 2007–2013, add a conditional comment targeting those specific versions:

```html
<!--[if gte mso 9]>
<style>
  li { text-align:-webkit-match-parent; display:list-item; text-indent:-1em; }
</style>
<![endif]-->
```

**What `mso-special-format:bullet` does:** It forces Outlook to render the element as a true list item rather than a paragraph. The trade-off is that it resets the Outlook margin to the default ~48px and forces the bullet style back to disc — so you cannot use this property and also override margins in Outlook simultaneously.

**Alternative approach** for when styling control matters more than semantics: replace the list with a table or use manual `•` / `1.` characters in `<p>` tags. However, this degrades accessibility (screen readers handle `<ul>/<li>` better than tables with bullet characters).

Source: [Litmus – Ultimate Guide to Bullet Points](https://www.litmus.com/blog/the-ultimate-guide-to-bulleted-lists-in-html-email), [Uplers – Outlook bullet hacks](https://email.uplers.com/blog/bullet-list-outlook-hacks/), [Good Email Code – MSO styles](https://www.goodemailcode.com/email-enhancements/mso-styles.html)

### 5.4 Nested lists

Nested lists can work, but require correct HTML structure: the nested `<ul>` or `<ol>` **must be placed inside a `<li>` element**, not after the closing `</li>`. Placing it outside creates rogue bullet rendering in Gmail IMAP and other clients.

```html
<!-- CORRECT -->
<ul>
  <li>Parent item
    <ul>
      <li>Child item</li>
    </ul>
  </li>
</ul>

<!-- WRONG - causes rogue bullets -->
<ul>
  <li>Parent item</li>
    <ul>
      <li>Child item</li>
    </ul>
</ul>
```

Nested lists inherit parent list styling, so no additional margin/padding is needed on the child list itself. However, Outlook's spacing issues compound in nested lists — test thoroughly.

Source: [Litmus – Ultimate Guide to Bullet Points](https://www.litmus.com/blog/the-ultimate-guide-to-bulleted-lists-in-html-email)

---

## 6. Inline Formatting: strong, em, u, s

### 6.1 `<strong>` (bold)

**Support: 100% across all tested clients.** Can I Email reports full support in Gmail (all platforms), Apple Mail (macOS and iOS), Outlook (2003 through 2021, Outlook.com, iOS, Android), and Yahoo Mail.

**Caveats:**
- In very old Internet Explorer rendering contexts (some legacy Outlook versions), `<strong>` may not render bold text. The fix is to add a redundant inline style: `<strong style="font-weight:bold;">`. This is belt-and-suspenders defensive coding.

**Semantic vs. presentational:** `<strong>` (semantic importance) and `<b>` (visual bold) both work in email. For new content, prefer `<strong>` for meaning; email rendering is identical across all current clients.

Source: [Can I Email – `<strong>`](https://www.caniemail.com/features/html-strong/), [Good Email Code – text](https://www.goodemailcode.com/email-code/text)

### 6.2 `<em>` (italic)

**Support: Universally supported.** Similar to `<strong>`, all major clients render `<em>` as italic text. The same legacy IE caveat applies: add `style="font-style:italic;"` as a redundant inline style for maximum safety.

**`<i>` vs `<em>`:** Both work. Prefer `<em>` semantically; rendering is identical in email clients.

Source: [Good Email Code – text](https://www.goodemailcode.com/email-code/text)

### 6.3 `<u>` (underline)

**Support: Generally safe, with one caveat.**

- Gmail, Apple Mail, Outlook 2016–2021, Outlook.com: ✅ Supported
- Yahoo Mail: ✅ Supported for `<u>`
- **`<ins>` tag**: Yahoo Mail and AOL strip the `<ins>` element entirely. If your editor outputs `<ins>` for underlines, wrap the content in a `<span style="text-decoration:underline;">` instead.

The recommended pattern for cross-client underline:
```html
<u style="text-decoration:underline;">underlined text</u>
```

Or, if the editor outputs `<ins>`:
```html
<span style="text-decoration:underline;">underlined text</span>
```

Note: Underline on links (`<a>`) has separate Outlook quirks — Outlook sometimes forces underlines on all links regardless of `text-decoration:none`. This is a known Outlook bug unrelated to the `<u>` tag.

Source: [Good Email Code – text](https://www.goodemailcode.com/email-code/text), [Litmus – Outlook rendering](https://litmus.com/community/discussions/8592-oct-20-outlook-link-underline-issue-resolved-all-links-underlined-regardless-of-css-inline-style-important-tags-mso-rules)

### 6.4 `<s>` (strikethrough)

**Support: Mostly safe, two clients strip it entirely.**

- Gmail, Apple Mail, Outlook, Outlook.com, Yahoo Mail: ✅ Supported
- **GMX and Web.de**: Strip the `<s>` tag entirely
- **`<del>` vs `<s>`:** Can I Email reports 100% support for `<del>` across all tested clients. However, Outlook MSO versions add default **red color** to `<del>` elements (representing tracked deletions) that cannot be overridden with inline styles.

**Recommended pattern** for strikethrough that works everywhere (including GMX/Web.de):
```html
<s><span style="text-decoration:line-through;">struck-through text</span></s>
```

The outer `<s>` covers clients that support it semantically; the inner `<span>` with `text-decoration:line-through` provides the visual rendering as a fallback if `<s>` is stripped. Avoid `<del>` if you don't want Outlook's red-color treatment.

Source: [Good Email Code – text](https://www.goodemailcode.com/email-code/text)

---

## 7. blockquote

### Support

`<blockquote>` has **100% support** (97.56% full + 2.44% partial) across all major clients including Gmail, Apple Mail, Outlook 2016–2021, Outlook.com, and Yahoo Mail. The HEY email client has a quirk where blockquotes are wrapped in a `<details>` element, but HEY is a very minor client.

Source: [Can I Email – `<blockquote>`](https://www.caniemail.com/features/html-blockquote/)

### Rendering and styling

The `<blockquote>` tag by default adds left margin (typically 40px) and indentation in most clients. Outlook 2007+ (Word engine) has difficulty applying CSS box-model properties (like `border-left`, `padding`) to `<blockquote>` elements. While the tag renders, custom styling of the quotation appearance via inline CSS is unreliable in Outlook.

If you need a styled visual quotation (e.g., a left border), the reliable Outlook approach is to wrap the blockquote in a table cell with `border-left` on the `<td>`:

```html
<table cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="border-left:4px solid #cccccc; padding-left:12px;">
      <blockquote style="margin:0; padding:0;">
        Quote text here
      </blockquote>
    </td>
  </tr>
</table>
```

For simpler use cases where just indentation is needed (not a visual border), `<blockquote>` alone works without any workaround.

Source: [Can I Email – `<blockquote>`](https://www.caniemail.com/features/html-blockquote/), [Microsoft Q&A – blockquote in Outlook](https://learn.microsoft.com/en-gb/answers/questions/5514300/how-to-detect-quoted-content-patterns-in-outlook-e)

---

## 8. Inline CSS Properties

### 8.1 Safe properties

The following properties have widespread support across all the clients in scope:

| Property | Gmail | Apple Mail | Outlook 2016–2021 | Outlook.com | Yahoo Mail | Notes |
|---|---|---|---|---|---|---|
| `color` | ✅ | ✅ | ✅ | ✅ | ✅ | Universally safe |
| `background-color` | ✅ | ✅ | ✅ | ✅ | ✅ | Universally safe |
| `font-size` | ✅ | ✅ | ⚠️ Partial | ✅ | ⚠️ Partial | Works inline; can be reset by client UA |
| `font-weight` | ✅ | ✅ | ✅ | ✅ | ✅ | Safe inline |
| `font-style` | ✅ | ✅ | ✅ | ✅ | ✅ | Safe inline |
| `text-decoration` | ✅ | ✅ | ✅ | ✅ | ✅ | Safe inline; Outlook link quirks unrelated |
| `line-height` | ✅ | ✅ | ⚠️ Use with mso rule | ✅ | ✅ | Add `mso-line-height-rule:exactly` for Outlook |
| `margin` | ✅ | ✅ | ⚠️ Partial | ✅ | ✅ | Works on inline elements; unreliable on tables in Outlook |
| `padding` | ✅ | ✅ | ⚠️ On `<td>` only | ✅ | ✅ | Reliable only on `<td>` in Outlook; fails on `<div>`, headings |

Sources: [Mailmodo – Email CSS support guide](https://www.mailmodo.com/guides/email-css-support/), [Campaign Monitor CSS guide](https://www.campaignmonitor.com/css/), [Google Developers – Gmail CSS support](https://developers.google.com/workspace/gmail/design/css)

### 8.2 margin and padding caveats in Outlook Windows

The Word rendering engine in Outlook 2016–2021 has significant margin/padding limitations:

- `padding` works **only on `<td>` elements**. Applying it to `<div>`, `<p>`, `<h1>`, etc. will be ignored or produce unexpected results.
- `margin` works on text-level elements (`<p>`, `<h1>`) but is unreliable on block containers like `<div>` and `<table>`.
- For spacing between block elements, move padding to the enclosing `<td>` and set `margin:0` on the content element itself.

MSO-specific alternatives:
- `mso-margin-top-alt` / `mso-margin-bottom-alt` — Outlook-specific top/bottom margin control
- `mso-padding-alt` — Padding control for Outlook (requires a border on `<p>`)
- `mso-para-margin` — Shorthand for all margin sides in Outlook

Source: [Good Email Code – MSO styles](https://www.goodemailcode.com/email-enhancements/mso-styles.html), [Badsender – Outlook rendering problems](https://www.badsender.com/en/2024/04/16/outlook-email-display-problems/)

### 8.3 Avoid shorthand properties

Some email clients (particularly older Outlooks and Yahoo) only parse individual properties, not shorthand:

```css
/* Risky - some clients ignore shorthand */
margin: 10px 20px;

/* Safe - use individual properties */
margin-top: 10px;
margin-right: 20px;
margin-bottom: 10px;
margin-left: 20px;
```

This is especially important for `margin`, `padding`, `font`, and `background`.

Source: [HTML Email Best Practices 2026 – MarkaPlugin](https://markaplugin.com/blog/html-email-best-practices-2026), [Yahoo Mail CSS quirks – Email on Acid](https://www.emailonacid.com/blog/article/email-development/9-ways-to-prevent-yahoo-headaches/)

### 8.4 Yahoo Mail–specific CSS quirks

Yahoo Mail has several unique behaviors to account for:

- Converts `height` to `min-height` (can break responsive image sizing)
- Removes `!important` if there is a space before it (`display:none !important` → `display:none`, but `display:none!important` works)
- Converts single quotes to double quotes inside style attributes — this can break font-family declarations with multi-word font names

Source: [Email on Acid – Yahoo tips](https://www.emailonacid.com/blog/article/email-development/9-ways-to-prevent-yahoo-headaches/), [Uplers – Yahoo Mail update](https://email.uplers.com/blog/whats-new-in-yahoo-mail-pro/)

---

## 9. Cross-Client Summary Table

This table summarizes the most important compatibility facts for the specific tags this project's editor produces.

| Feature | Gmail web | Gmail iOS/Android | Apple Mail | Outlook 2016–2021 | Outlook.com | Yahoo Mail |
|---|---|---|---|---|---|---|
| `<style>` blocks | ⚠️ Head only; < 8KB; invalid rules strip entire block | ⚠️ Not for non-Gmail accounts | ✅ | ⚠️ Buggy | ✅ | ✅ |
| `class` attributes | ❌ Stripped | ❌ Stripped | ✅ | ❌ Limited | ✅ | ✅ |
| `<h1>`–`<h3>` tag | ✅ | ✅ | ✅ | ✅ (needs inline styles) | ✅ | ✅ (needs inline styles) |
| `font-size` on headings | ✅ | ✅ | ✅ | ⚠️ Resets without inline | ✅ | ⚠️ Resets without inline |
| `margin` on headings | ✅ | ✅ | ✅ | ⚠️ Resets without inline | ✅ | ⚠️ Resets without inline |
| `<p>` tag | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `<ul>` / `<ol>` | ✅ | ✅ | ✅ | ⚠️ Margin/bullet issues | ✅ | ✅ |
| `<li>` | ✅ | ✅ | ✅ | ⚠️ May render as `<p>` | ✅ | ✅ |
| Nested lists | ✅ (inside `<li>`) | ✅ | ✅ | ⚠️ Spacing issues | ✅ | ✅ |
| `<strong>` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `<em>` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `<u>` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `<s>` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `<br>` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `<blockquote>` | ✅ | ✅ | ✅ | ✅ (CSS box-model partial) | ✅ | ✅ |
| `font-weight` inline | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `font-style` inline | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `text-decoration` inline | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `color` inline | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `background-color` inline | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `margin` inline | ✅ | ✅ | ✅ | ⚠️ On `<td>` only reliably | ✅ | ✅ |
| `padding` inline | ✅ | ✅ | ✅ | ⚠️ On `<td>` only | ✅ | ✅ |
| `line-height` inline | ✅ | ✅ | ✅ | ⚠️ Use `mso-line-height-rule` | ✅ | ✅ |

Legend: ✅ = reliable support, ⚠️ = partial/conditional support, ❌ = not supported

---

## 10. Recommendations for This Project

This section translates the research into concrete guidance for an editor that produces: **h1–h3 headings, bold (`<strong>`), italic (`<em>`), underline (`<u>`), strikethrough (`<s>`), unordered lists (`<ul>`/`<li>`), and ordered lists (`<ol>`/`<li>`)**.

### 10.1 Architecture: Always Use Inline Styles

**Do not rely on `<style>` blocks or `class` attributes for primary styling.** Gmail strips class attributes universally and the style block behavior is unreliable across mobile Gmail variants. Every element the editor outputs should carry its own inline `style` attribute.

Use `<style>` blocks only for:
- Outlook MSO conditional overrides
- Mobile responsive breakpoints (which are acceptable to degrade in non-supporting clients)

### 10.2 Heading Output

Emit the following inline styles on every heading, always:

```html
<h1 style="font-size:2em; font-weight:bold; line-height:1.2; margin-top:0.67em; margin-bottom:0.67em; color:#000000; mso-line-height-rule:exactly;">
<h2 style="font-size:1.5em; font-weight:bold; line-height:1.2; margin-top:0.83em; margin-bottom:0.83em; color:#000000; mso-line-height-rule:exactly;">
<h3 style="font-size:1.17em; font-weight:bold; line-height:1.3; margin-top:1em; margin-bottom:1em; color:#000000; mso-line-height-rule:exactly;">
```

Key points:
- **Always set `font-size`** — Outlook and Yahoo reset heading sizes without it.
- **Always set `margin-top` and `margin-bottom`** individually (not shorthand `margin`) — Outlook and Yahoo strip or change default margins.
- **Always set `color`** — Prevents Outlook's unsolicited green tint on h2–h3.
- **Add `mso-line-height-rule:exactly`** — Prevents Outlook's auto-expanding line height.
- If the editor allows users to change heading appearance, emit their chosen `font-size` and `color` values inline. Never rely on cascading from a stylesheet.
- Do not apply `padding` to heading tags directly — move any vertical spacing to the enclosing `<td>` if inside a table layout.

### 10.3 Paragraph Output

```html
<p style="margin-top:0; margin-bottom:1em; font-size:1em; line-height:1.5;">
```

- **Always set `margin` individually** (`margin-top`, `margin-bottom`), not shorthand.
- Reset `margin-top:0` to prevent double-spacing between elements in some clients.

### 10.4 Bold and Italic Output

These are safe as semantic tags, but always add redundant inline styles:

```html
<strong style="font-weight:bold;">bold text</strong>
<em style="font-style:italic;">italic text</em>
```

The inline style is a no-op in well-behaved clients but protects against legacy IE/Outlook rendering paths where the semantic meaning is not translated to visual weight.

### 10.5 Underline Output

Use `<u>` with an explicit inline style:

```html
<u style="text-decoration:underline;">underlined text</u>
```

**Do not use `<ins>`** — it is stripped by Yahoo Mail and AOL.

### 10.6 Strikethrough Output

Use `<s>` with a nested `<span>` for maximum coverage including GMX and Web.de:

```html
<s><span style="text-decoration:line-through;">struck text</span></s>
```

**Do not use `<del>`** for strikethrough in email — Outlook MSO applies a red color to `<del>` (the tracked-changes semantic) that cannot be overridden with inline `color` styles.

### 10.7 Unordered List Output

```html
<ul style="margin-top:0; margin-bottom:1em; margin-left:0; padding-left:0; list-style-type:disc;">
  <li style="margin-left:25px; margin-bottom:4px; mso-special-format:bullet;">Item text</li>
  <li style="margin-left:25px; margin-bottom:4px; mso-special-format:bullet;">Item text</li>
</ul>
```

Include in the email's `<head>` (inside a `<!--[if gte mso 9]>` block) to fix Outlook 2007–2013 specifically:

```html
<!--[if gte mso 9]>
<style>
  li { text-align:-webkit-match-parent; display:list-item; text-indent:-1em; }
</style>
<![endif]-->
```

**Known trade-off:** `mso-special-format:bullet` resets Outlook's bullet margin to the default ~48px and forces disc bullets. You cannot use this property and also apply a custom `margin-left` in Outlook simultaneously. For most transactional/content email, this default is acceptable.

### 10.8 Ordered List Output

```html
<ol style="margin-top:0; margin-bottom:1em; margin-left:0; padding-left:0;">
  <li style="margin-left:25px; margin-bottom:4px;">Item text</li>
  <li style="margin-left:25px; margin-bottom:4px;">Item text</li>
</ol>
```

- Do not use the `reversed` attribute — not supported in Gmail, Outlook.com, or Yahoo Mail.
- Do not use the `value` attribute on `<li>` — causes Outlook to prematurely close the list.
- Bullet/number styling (color, weight) on ordered list items **cannot be changed** in Outlook for Windows. Accept this limitation.

### 10.9 Nested Lists

Structure nested lists with the child `<ul>` or `<ol>` always inside a `<li>`, never after the closing `</li>`:

```html
<ul style="margin:0; padding:0;">
  <li style="margin-left:25px; mso-special-format:bullet;">
    Parent item
    <ul style="margin:0; padding:0;">
      <li style="margin-left:25px; mso-special-format:bullet;">Nested item</li>
    </ul>
  </li>
</ul>
```

Outlook's spacing issues compound at nesting depth — test nested lists specifically in Outlook 2016/2019 before shipping.

### 10.10 Blockquote Output

For simple indentation:

```html
<blockquote style="margin:1em 0; margin-left:40px; padding:0; border:none;">
  <p style="margin:0;">Quoted text</p>
</blockquote>
```

For styled blockquotes with a left border (requires table wrapper in Outlook):

```html
<!--[if mso]>
<table cellpadding="0" cellspacing="0" border="0"><tr><td style="border-left:4px solid #cccccc; padding-left:16px;">
<![endif]-->
<blockquote style="margin:0; padding:0 0 0 16px; border-left:4px solid #cccccc;">
  <p style="margin:0;">Quoted text</p>
</blockquote>
<!--[if mso]></td></tr></table><![endif]-->
```

The conditional comment makes the table wrapper visible only to the Word-engine Outlook; all other clients use the inline `border-left` on the `<blockquote>` itself.

### 10.11 What You Can Safely Skip

- You do **not** need to replace `<strong>` with a `<span style="font-weight:bold;">` — `<strong>` renders correctly in all current clients when backed by the redundant inline style.
- You do **not** need to replace `<em>` with a `<span style="font-style:italic;">` — same reasoning.
- You do **not** need to avoid `<h1>`–`<h3>` tags — they are universally supported; only the *default styling* is unreliable without inline styles.
- You do **not** need to replace `<ul>`/`<li>` with tables for normal use — semantic lists with the fixes above are preferred over tables for both accessibility and maintainability.

### 10.12 Summary of Must-Have Inline Styles

| Element | Required Inline Styles |
|---|---|
| `<h1>` | `font-size:2em; font-weight:bold; line-height:1.2; margin-top:0.67em; margin-bottom:0.67em; color:[value]; mso-line-height-rule:exactly` |
| `<h2>` | `font-size:1.5em; font-weight:bold; line-height:1.2; margin-top:0.83em; margin-bottom:0.83em; color:[value]; mso-line-height-rule:exactly` |
| `<h3>` | `font-size:1.17em; font-weight:bold; line-height:1.3; margin-top:1em; margin-bottom:1em; color:[value]; mso-line-height-rule:exactly` |
| `<p>` | `margin-top:0; margin-bottom:1em` |
| `<ul>` | `margin-top:0; margin-bottom:1em; margin-left:0; padding-left:0` |
| `<ol>` | `margin-top:0; margin-bottom:1em; margin-left:0; padding-left:0` |
| `<li>` | `margin-left:25px; margin-bottom:4px; mso-special-format:bullet` |
| `<strong>` | `font-weight:bold` |
| `<em>` | `font-style:italic` |
| `<u>` | `text-decoration:underline` |
| `<s>` | *(wrap content in `<span style="text-decoration:line-through;">`)* |
| `<blockquote>` | `margin:1em 0; margin-left:40px; padding:0` |
| `<br>` | *(none needed)* |

---

## Key Sources

- [Can I Email – feature tables](https://www.caniemail.com/)
- [Can I Email – `<h1>`–`<h6>`](https://www.caniemail.com/features/html-h1-h6/)
- [Can I Email – `<strong>`](https://www.caniemail.com/features/html-strong/)
- [Can I Email – `<del>`](https://www.caniemail.com/features/html-del/)
- [Can I Email – `<blockquote>`](https://www.caniemail.com/features/html-blockquote/)
- [Can I Email – `<ul>`, `<ol>`, `<dl>`](https://www.caniemail.com/features/html-lists/)
- [Can I Email – `<style>` element](https://www.caniemail.com/features/html-style/)
- [Good Email Code – text elements](https://www.goodemailcode.com/email-code/text)
- [Good Email Code – MSO styles](https://www.goodemailcode.com/email-enhancements/mso-styles.html)
- [Litmus – Ultimate Guide to Bullet Points in HTML Email](https://www.litmus.com/blog/the-ultimate-guide-to-bulleted-lists-in-html-email)
- [Litmus – Understanding Gmail and CSS](https://www.litmus.com/blog/understanding-gmail-and-css-part-1)
- [Litmus – Outlook rendering differences](https://www.litmus.com/blog/a-guide-to-rendering-differences-in-microsoft-outlook-clients)
- [Email on Acid – 12 things for Gmail development](https://www.emailonacid.com/blog/article/email-development/12-things-you-must-know-when-developing-for-gmail-and-gmail-mobile-apps-2/)
- [Email on Acid – Outlook desktop tips](https://www.emailonacid.com/tip/outlook-desktop/)
- [Google Developers – Gmail CSS support](https://developers.google.com/workspace/gmail/design/css)
- [Tabular – mso-line-height-rule explained](https://tabular.email/blog/mso-line-height-rule-exactly-explained)
- [Uplers – Bullet list Outlook hacks](https://email.uplers.com/blog/bullet-list-outlook-hacks/)
- [Uplers – Yahoo Mail Pro update](https://email.uplers.com/blog/whats-new-in-yahoo-mail-pro/)
- [Badsender – Outlook rendering problems 2024](https://www.badsender.com/en/2024/04/16/outlook-email-display-problems/)
- [Customer.io – New Outlook rendering issues](https://customer.io/learn/message-composing/new-outlook-rendering-issues)
- [DEV Community – Complete guide to email rendering differences 2026](https://dev.to/aoifecarrigan/the-complete-guide-to-email-client-rendering-differences-in-2026-243f)
- [EDMdesigner – Typography in modern HTML emails](https://blog.edmdesigner.com/typography-in-modern-html-emails/)
- [Mailmodo – Email CSS support guide](https://www.mailmodo.com/guides/email-css-support/)
- [Campaign Monitor – CSS support guide](https://www.campaignmonitor.com/css/)
