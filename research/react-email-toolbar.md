# `@react-email/editor` Toolbar Configuration Research

**Package version investigated:** 1.5.4  
**Date:** 2026-06-12  
**Goal:** Understand all toolbar configuration options and determine the best strategy for restricting/replacing the default bubble menu to only: bold, italic, underline, strikethrough, H1, H2, H3, paragraph, bullet list, ordered list, indent, outdent.

---

## 1. `EmailEditorProps` — Complete API Surface

From `/node_modules/@react-email/editor/dist/index.d.mts`:

```ts
interface EmailEditorProps {
  content?: Content;                    // TipTap JSON or HTML string
  onUpdate?: (ref: EmailEditorRef) => void;
  onReady?: (ref: EmailEditorRef) => void;
  theme?: EditorThemeInput;             // 'basic' | 'minimal' | ThemeConfig object
  editable?: boolean;                   // default: true
  placeholder?: string;
  bubbleMenu?: {
    hideWhenActiveNodes?: string[];     // default: ['button', 'horizontalRule']
    hideWhenActiveMarks?: string[];     // default: ['link']
  };
  extensions?: Extensions;             // replaces the entire default extensions array
  onUploadImage?: (file: File) => Promise<{ url: string }>;
  className?: string;
  children?: ReactNode;                // rendered inside the internal EditorProvider
}
```

### `EmailEditorRef`

```ts
interface EmailEditorRef {
  getEmail: () => Promise<{ html: string; text: string }>;
  getEmailHTML: () => Promise<string>;
  getEmailText: () => Promise<string>;
  getJSON: () => JSONContent;
  editor: Editor | null;               // direct TipTap Editor instance
}
```

**Key finding:** `ref.editor` exposes the raw TipTap `Editor` object. Any TipTap command can be dispatched from a custom toolbar via `ref.editor.chain().focus().<command>().run()`.

---

## 2. The `bubbleMenu` Prop — What It Controls

The `bubbleMenu` prop on `EmailEditor` has **two fields only**:

| Field | Type | Default | Effect |
|---|---|---|---|
| `hideWhenActiveNodes` | `string[]` | `['button', 'horizontalRule']` | Hides the **entire default text bubble menu** when the cursor is in one of these node types |
| `hideWhenActiveMarks` | `string[]` | `['link']` | Hides the **entire default text bubble menu** when one of these marks is active |

**Important limitations:**
- These two fields can only **show or hide the whole default text bubble menu**. They cannot hide individual items within it.
- You cannot use them to remove Bold, Uppercase, AlignLeft, or any other individual button.
- Passing `hideWhenActiveNodes: ['*']` or similar is not supported; there is no wildcard.

To suppress the entire default text bubble menu, you would need to pass a completely custom set of marks and nodes that are always active — but that is a hack, not a supported pattern.

---

## 3. The `theme` Prop — What It Controls

`theme` accepts `'basic' | 'minimal' | ThemeConfig`.

From the source, `EditorThemeInput = EditorTheme | ThemeConfig` where:

```ts
interface ThemeConfig {
  extends?: EditorTheme;
  styles: ThemeComponentStyles; // CSS for body, h1, h2, h3, paragraph, list, etc.
}
```

The `theme` prop controls **email output styles** (font sizes, colors, spacing on the serialized HTML) and the visual appearance of those elements inside the editor canvas. It does **not** control which buttons appear in the bubble menu. CSS custom properties (`--re-bg`, `--re-border`, etc.) control the chrome appearance.

---

## 4. The `children` Prop — Key Capability

`children?: ReactNode` is rendered **inside the `EditorProvider`** context. This is confirmed by the `EmailEditor` source:

```js
// from dist/index.mjs (decompiled)
return jsx(EditorProvider, {
  extensions,
  content,
  // ...
  children: [
    jsx(RefBridge, ...),
    jsx(EmailEditorReadyBridge, ...),
    jsx(BubbleMenu, { hideWhenActiveNodes: ..., hideWhenActiveMarks: ... }),
    jsx(BubbleMenu.LinkDefault, {}),
    jsx(BubbleMenu.ButtonDefault, {}),
    jsx(BubbleMenu.ImageDefault, {}),
    jsx(SlashCommandRoot, {}),
    children,          // <-- your ReactNode goes here
  ]
})
```

**What this means:**
- Any component passed as `children` runs inside TipTap's `EditorProvider` React context.
- This means `useCurrentEditor()` (from `@tiptap/react`) works inside your child components.
- The default bubble menus (text, link, button, image) are **still rendered** alongside your children. There is no prop to disable them from the `EmailEditor` API.
- `children` is the insertion point for an `Inspector` sidebar (confirmed by the official docs example) or any other custom UI.

### Critical limitation
You **cannot use the `children` prop to replace the default bubble menu**. The default `BubbleMenu` (text selection toolbar) is hardcoded in `EmailEditor` and rendered before `children`. It will still appear unless you suppress it via CSS or the `bubbleMenu` prop.

---

## 5. Exported UI Components from `@react-email/editor/ui`

The package exports a rich set of composable BubbleMenu primitives from `@react-email/editor/ui`:

### The `BubbleMenu` Compound Component

```ts
const BubbleMenu = RootWithDefault & {
  Root: RootWithDefault,         // wrapper with trigger logic
  ItemGroup: BubbleMenuItemGroup,
  Separator: BubbleMenuSeparator,
  Item: BubbleMenuItem,          // generic button — requires name, isActive, onCommand
  Bold, Italic, Underline, Strike, Code, Uppercase,
  AlignLeft, AlignCenter, AlignRight,
  NodeSelector, LinkSelector,
  ButtonToolbar, ButtonEditLink, ButtonUnlink, ButtonForm, ButtonDefault,
  LinkToolbar, LinkEditLink, LinkUnlink, LinkOpenLink, LinkForm, LinkDefault,
  ImageToolbar, ImageEditLink, ImageUnlink, ImageForm, ImageDefault,
}
```

### `BubbleMenuRoot` Props (the base container)

```ts
interface BubbleMenuRootProps {
  trigger?: TriggerFn;              // custom visibility function
  pluginKey?: PluginKey;            // ProseMirror plugin key for this menu instance
  hideWhenActiveNodes?: string[];
  hideWhenActiveMarks?: string[];
  placement?: 'top' | 'bottom';    // default: 'bottom'
  offset?: number;                 // default: 8px
  onHide?: () => void;
}
```

`RootWithDefault` checks: if `children` are provided, it renders `Root` (uses your children). If no children, it renders `Default` (the full default toolbar with NodeSelector, LinkSelector, Bold/Italic/Underline/Strike/Code/Uppercase, and alignment buttons).

### Pre-wired formatting items

`BubbleMenuBold`, `BubbleMenuItalic`, `BubbleMenuUnderline`, `BubbleMenuStrike`, `BubbleMenuCode`, `BubbleMenuUppercase` all accept only `{ className?, children? }`. They are self-contained — they use `useBubbleMenuContext()` internally to get the editor and call the right TipTap command.

### `BubbleMenuNodeSelector`

```ts
interface BubbleMenuNodeSelectorProps {
  omit?: string[];          // node names to exclude from the dropdown
  className?: string;
  triggerContent?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}
```

The `omit` prop filters the dropdown. Available node type names: `'Text'`, `'Title'`, `'Subtitle'`, `'Heading'`, `'Bullet List'`, `'Numbered List'`, `'Quote'`, `'Code'`.

Note: These are **display names**, not TipTap node type names. `'Title'` = H1, `'Subtitle'` = H2, `'Heading'` = H3.

### `BubbleMenuItem` (generic button)

```ts
interface BubbleMenuItemProps extends React.ComponentProps<'button'> {
  name: string;       // used for aria-label and data-item attribute
  isActive: boolean;
  onCommand: () => void;
}
```

Use this to build custom buttons (e.g., indent/outdent) that aren't pre-wired.

### `bubbleMenuTriggers`

```ts
const bubbleMenuTriggers: {
  textSelection(hideWhenActiveNodes?: string[], hideWhenActiveMarks?: string[]): TriggerFn;
  node(name: string): TriggerFn;
  nodeWithoutSelection(name: string): TriggerFn;
}
```

Used to build custom contextual menus that trigger on different conditions.

### `useBubbleMenuContext()`

```ts
interface BubbleMenuContextValue {
  editor: Editor;
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
}
```

Available inside any component rendered inside `<BubbleMenu>`. Provides direct access to the TipTap editor for custom commands.

---

## 6. The Default Bubble Menu — What It Contains

From reading the decompiled source (`Default` function in `root-_Hz1yayd.mjs`), the default text bubble menu renders:

1. `BubbleMenuNodeSelector` — dropdown with: Text, Title (H1), Subtitle (H2), Heading (H3), Bullet List, Numbered List, Quote, Code
2. `BubbleMenuLinkSelector` — link add/edit popover
3. `BubbleMenuItemGroup` containing: Bold, Italic, Underline, Strike, Code, **Uppercase**
4. `BubbleMenuItemGroup` containing: AlignLeft, AlignCenter, AlignRight

When the cursor is on a `code` inline mark, it shows only the NodeSelector + Code button.

**Controls NOT in the default bubble menu:**
- H1, H2, H3 as direct buttons (they live inside the NodeSelector dropdown)
- Indent / outdent buttons
- Bullet list / ordered list as direct buttons (they live inside NodeSelector)

---

## 7. Available Extensions for Indent/Outdent

From `@react-email/editor/extensions`, the `StarterKit` includes:
- `BulletList` — supports `sinkListItem` / `liftListItem` TipTap commands for indent/outdent
- `OrderedList` — same
- `ListItem` — required for indent/outdent to work

TipTap's indent/outdent commands within lists:

```ts
editor.chain().focus().sinkListItem('listItem').run()   // indent
editor.chain().focus().liftListItem('listItem').run()   // outdent
```

Note: `@react-email/editor` does **not** expose a dedicated `Indent` or `Outdent` extension — these are standard TipTap list commands. Indent/outdent only applies when the cursor is inside a list node.

---

## 8. `EmailEditorRef.editor` — TipTap Commands Available

`ref.editor` is the raw TipTap `Editor` instance. From outside the `EditorProvider` context (e.g., a toolbar rendered above the editor), you can call:

```ts
const e = ref.current?.editor;
if (!e) return;

// Text formatting
e.chain().focus().toggleBold().run()
e.chain().focus().toggleItalic().run()
e.chain().focus().toggleUnderline().run()
e.chain().focus().toggleStrike().run()

// Headings
e.chain().focus().toggleHeading({ level: 1 }).run()
e.chain().focus().toggleHeading({ level: 2 }).run()
e.chain().focus().toggleHeading({ level: 3 }).run()

// Paragraph
e.chain().focus().setParagraph().run()

// Lists
e.chain().focus().toggleBulletList().run()
e.chain().focus().toggleOrderedList().run()

// Indent/outdent (only works inside list nodes)
e.chain().focus().sinkListItem('listItem').run()
e.chain().focus().liftListItem('listItem').run()

// Active state checks
e.isActive('bold')
e.isActive('heading', { level: 1 })
e.isActive('bulletList')
e.isActive('orderedList')
```

However, using `ref.editor` from outside the editor's React context has a **reactivity problem**: the editor object reference doesn't change on state updates, so reading `isActive(...)` directly won't trigger re-renders. You need `useEditorState` (from `@tiptap/react`) inside the `EditorProvider` context to get reactive state.

---

## 9. Fixed Toolbar — Is It Possible?

There is no built-in `fixedToolbar` prop or similar on `EmailEditor`. The package only supports a bubble menu paradigm. However, there are two viable approaches:

### Approach A — Bubble-style restricted toolbar (simplest, fully supported)

Replace the default text bubble menu by passing custom children to `<BubbleMenu>` inside the `EmailEditor.children` prop. The default menu is still rendered, so you must also suppress it.

**Problem:** The default `BubbleMenu` in `EmailEditor` cannot be disabled via props. It will always render.

**Workaround:** Use CSS to hide it:
```css
[data-re-bubble-menu]:not([data-custom-bubble-menu]) {
  display: none !important;
}
```
Or, target by pluginKey — the default text bubble menu uses `pluginKey = new PluginKey("textBubbleMenu")`, which attaches a `data-re-bubble-menu=""` attribute to the container.

### Approach B — Fixed toolbar via `children` + `useCurrentEditor` (recommended)

Render a fixed toolbar component as a `children` of `EmailEditor`. Because children are inside `EditorProvider`, `useCurrentEditor()` works and gives reactive access to the editor:

```tsx
import { EmailEditor, type EmailEditorRef } from '@react-email/editor'
import { useCurrentEditor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'

function FixedToolbar() {
  const { editor } = useCurrentEditor()
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      isBold: e?.isActive('bold') ?? false,
      isItalic: e?.isActive('italic') ?? false,
      isUnderline: e?.isActive('underline') ?? false,
      isStrike: e?.isActive('strike') ?? false,
      isH1: e?.isActive('heading', { level: 1 }) ?? false,
      isH2: e?.isActive('heading', { level: 2 }) ?? false,
      isH3: e?.isActive('heading', { level: 3 }) ?? false,
      isParagraph: e?.isActive('paragraph') ?? false,
      isBulletList: e?.isActive('bulletList') ?? false,
      isOrderedList: e?.isActive('orderedList') ?? false,
    }),
  })
  if (!editor) return null

  return (
    <div className="fixed-toolbar">
      <button onClick={() => editor.chain().focus().toggleBold().run()}
              data-active={state?.isBold}>B</button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()}
              data-active={state?.isItalic}>I</button>
      <button onClick={() => editor.chain().focus().toggleUnderline().run()}
              data-active={state?.isUnderline}>U</button>
      <button onClick={() => editor.chain().focus().toggleStrike().run()}
              data-active={state?.isStrike}>S</button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              data-active={state?.isH1}>H1</button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              data-active={state?.isH2}>H2</button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              data-active={state?.isH3}>H3</button>
      <button onClick={() => editor.chain().focus().setParagraph().run()}
              data-active={state?.isParagraph}>P</button>
      <button onClick={() => editor.chain().focus().toggleBulletList().run()}
              data-active={state?.isBulletList}>• List</button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()}
              data-active={state?.isOrderedList}>1. List</button>
      <button onClick={() => editor.chain().focus().sinkListItem('listItem').run()}>
        Indent
      </button>
      <button onClick={() => editor.chain().focus().liftListItem('listItem').run()}>
        Outdent
      </button>
    </div>
  )
}

export function ReactEmailEditorWrapper() {
  return (
    <div>
      <EmailEditor
        bubbleMenu={{
          hideWhenActiveNodes: ['button', 'horizontalRule'],
          hideWhenActiveMarks: ['link'],
        }}
      >
        <FixedToolbar />
      </EmailEditor>
    </div>
  )
}
```

**Positioning challenge:** Since `FixedToolbar` is rendered *inside* `EditorProvider`, it is also inside the editor's DOM container (set by `className` or the default wrapper). You'll need to use `position: sticky` or CSS to pull it above the editor content, or use a React portal to render it outside the editor DOM entirely while keeping it inside the React context tree.

**Portal pattern for clean layout:**

```tsx
import { createPortal } from 'react-dom'

function PortaledFixedToolbar({ toolbarContainerRef }) {
  const { editor } = useCurrentEditor()
  // ... same state as above
  if (!editor || !toolbarContainerRef.current) return null
  return createPortal(<ToolbarContent editor={editor} />, toolbarContainerRef.current)
}

export function ReactEmailEditorWrapper() {
  const toolbarRef = useRef<HTMLDivElement>(null)
  return (
    <div>
      <div ref={toolbarRef} className="toolbar-slot" />
      <EmailEditor>
        <PortaledFixedToolbar toolbarContainerRef={toolbarRef} />
      </EmailEditor>
    </div>
  )
}
```

### Approach C — Restricted bubble menu only (no fixed toolbar)

Keep the floating bubble paradigm but restrict the default menu's contents to only your required controls. This requires:

1. Suppressing the default `BubbleMenu` with CSS (`[data-re-bubble-menu]`)
2. Adding a custom `<BubbleMenu>` with only the needed children inside `EmailEditor.children`

```tsx
<EmailEditor>
  <BubbleMenu>
    <BubbleMenu.ItemGroup>
      <BubbleMenu.Bold />
      <BubbleMenu.Italic />
      <BubbleMenu.Underline />
      <BubbleMenu.Strike />
    </BubbleMenu.ItemGroup>
    <BubbleMenu.NodeSelector omit={['Quote', 'Code']} />
    <BubbleMenu.ItemGroup>
      {/* Custom indent/outdent items using BubbleMenu.Item */}
      <BubbleMenu.Item
        name="indent"
        isActive={false}
        onCommand={() => editor.chain().focus().sinkListItem('listItem').run()}
      >
        →
      </BubbleMenu.Item>
      <BubbleMenu.Item
        name="outdent"
        isActive={false}
        onCommand={() => editor.chain().focus().liftListItem('listItem').run()}
      >
        ←
      </BubbleMenu.Item>
    </BubbleMenu.ItemGroup>
  </BubbleMenu>
</EmailEditor>
```

**Note on `BubbleMenu.Item` inside a custom `BubbleMenu`:** `BubbleMenuItem` requires `useBubbleMenuContext()` to be in scope, which is provided by the `BubbleMenu` root. For indent/outdent buttons, you'd need to access the editor via `useBubbleMenuContext()` inside a wrapper component.

---

## 10. Suppressing the Default Bubble Menu

Since the default text bubble menu cannot be disabled via props, the cleanest suppression is CSS. The default text bubble menu container has `data-re-bubble-menu=""` on it (all bubble menu roots get this). The default text menu also uses `pluginKey = new PluginKey("textBubbleMenu")`.

You can hide it globally in your editor's CSS scope:

```css
/* Suppress the default text bubble menu */
.re-editor-content [data-re-bubble-menu]:first-of-type {
  display: none !important;
}
```

However, this is fragile (depends on DOM order). A more reliable approach: use the `className` approach to give your custom bubble menu a distinguishing attribute, and hide any `[data-re-bubble-menu]` element that does NOT have that attribute.

Alternatively, since the package is open-source, you could also use a lower-level approach with `EditorProvider` from `@tiptap/react` directly, bypassing `EmailEditor` entirely — but you would lose the `getEmailHTML` serialization logic.

---

## 11. Indent/Outdent — Important Caveat

Indent (`sinkListItem`) and outdent (`liftListItem`) are **list-only operations** in TipTap. They only work when the cursor is inside a `bulletList` or `orderedList` node. Calling them outside a list has no effect. The buttons should be disabled when not in a list context:

```tsx
const canIndent = editor?.can().sinkListItem('listItem') ?? false
const canOutdent = editor?.can().liftListItem('listItem') ?? false
```

---

## Recommended Approach

### Recommendation: Option B (Fixed Toolbar via `children` + `useCurrentEditor`) with a portal

This is the most maintainable approach for your requirements:

**Why:**
- It is fully supported by the package API (`children` is a documented prop)
- `useCurrentEditor` from `@tiptap/react` is a stable, public TipTap API
- `useEditorState` gives reactive active-state for button highlighting
- A fixed toolbar is a better UX for this comparison app because users can see all available controls at all times
- You get complete control over the exact set of controls displayed
- The `EmailEditorRef.editor` gives you a reliable escape hatch for dispatching commands if needed from outside the context

**Step-by-step implementation plan:**

1. Create a `FixedToolbar` component that uses `useCurrentEditor()` and `useEditorState()` from `@tiptap/react`
2. Include buttons for: Bold, Italic, Underline, Strikethrough, H1, H2, H3, Paragraph, Bullet List, Ordered List, Indent (disabled unless in list), Outdent (disabled unless in list)
3. Use `createPortal` to render the toolbar into a `div` above the `EmailEditor`, while keeping the component tree inside `EmailEditor.children`
4. Suppress the default text bubble menu with targeted CSS: add a CSS rule in `ReactEmailEditor.css` targeting `[data-re-bubble-menu]` to `display: none` — or give your custom `BubbleMenu` a distinguishing class and only hide the one without that class
5. Keep `BubbleMenu.LinkDefault`, `BubbleMenu.ButtonDefault`, and `BubbleMenu.ImageDefault` (these are separate bubble menus for links, buttons, and images, and are useful context-sensitive menus to retain)
6. Disable indent/outdent buttons when `editor.can().sinkListItem('listItem')` / `liftListItem` returns `false`

**Imports required:**
```ts
import { BubbleMenu } from '@react-email/editor/ui'
import { useCurrentEditor, useEditorState } from '@tiptap/react'
import { createPortal } from 'react-dom'
```

**What you do NOT need to change:**
- The extensions (`StarterKit` already includes all needed node/mark types)
- The `theme` prop
- The `bubbleMenu` prop (it won't affect the fixed toolbar approach)

---

## Summary Table

| Goal | Mechanism | Supported? |
|---|---|---|
| Hide entire default text bubble menu on a node type | `bubbleMenu.hideWhenActiveNodes` | Yes |
| Hide entire default text bubble menu on a mark | `bubbleMenu.hideWhenActiveMarks` | Yes |
| Remove individual items from default bubble menu | No prop available | No — CSS hack only |
| Add custom components inside `EditorProvider` context | `children` prop | Yes (documented) |
| Access `Editor` instance reactively from children | `useCurrentEditor()` + `useEditorState()` | Yes |
| Build a fixed toolbar | `children` + portal + `useCurrentEditor()` | Yes (workaround, not built-in) |
| Suppress the default text bubble menu entirely | CSS targeting `[data-re-bubble-menu]` | Yes (CSS hack) |
| Compose a restricted custom bubble menu | `BubbleMenu` with children from `@react-email/editor/ui` | Yes (fully supported) |
| Indent/outdent | `sinkListItem` / `liftListItem` TipTap commands | Yes (inside lists only) |
| NodeSelector restricted to H1/H2/H3/Para/BulletList/OrderedList | `BubbleMenuNodeSelector omit={['Quote','Code']}` | Yes |

---

## Sources

- [Bubble Menu — React Email docs](https://react.email/docs/editor/features/bubble-menu)
- [EmailEditor API Reference — React Email docs](https://react.email/docs/editor/api-reference/email-editor.md)
- [BubbleMenu API Reference — React Email docs](https://react.email/docs/editor/api-reference/ui/bubble-menu.md)
- [Embed the React Email editor — Resend docs](https://resend.com/docs/knowledge-base/embed-react-email-editor)
- [TipTap BubbleMenu extension](https://tiptap.dev/docs/editor/extensions/functionality/bubble-menu)
- Local source: `/node_modules/@react-email/editor/dist/index.mjs`
- Local source: `/node_modules/@react-email/editor/dist/root-_Hz1yayd.mjs`
- Local source: `/node_modules/@react-email/editor/dist/index.d.mts`
- Local source: `/node_modules/@react-email/editor/dist/ui/index.d.mts`
- Local source: `/node_modules/@react-email/editor/dist/extensions/index.d.mts`
