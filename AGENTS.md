# AGENTS.md

Guidance for AI agents and humans working on this repository. Read this before editing anything under `src/`.

## What this project is

A Google Apps Script library that adds a **Mermaid** menu to Google Docs. It lets users:

- Insert a new Mermaid diagram as an inline PNG image (editor dialog with live preview).
- Edit a previously inserted diagram (source and theme are stored in the image's alt text).
- Paste Markdown and insert it as styled Docs content (headings, lists, tables, code blocks, rules, blockquotes), rendering any ```` ```mermaid ```` fences to images.
- Manage custom Mermaid themes (stored per user as `base` theme + `themeVariables`).

It is a fork of the archived `renanlecaro/mermaid-gdocs` marketplace add-on. **It is no longer distributed as a standalone add-on.** It is used as an Apps Script **library** consumed by other Apps Script projects.

## How it is deployed and consumed (important)

There is no build step, no `clasp` config, no package.json and no automated tests. Deployment is manual:

1. **Library project.** An Apps Script project contains exactly these files from `src/`:
   - `appsscript.json`
   - `Code.gs`
   - `index.html`
   - `paste_markdown.html`
   - `theme_settings.html`

   `src/` in this repo is the source of truth; the Apps Script project is a copy. Keep them in sync by hand.

2. **Consumer project.** A Google Doc's bound Apps Script project adds the library with the identifier `MermaidManager` and contains only thin wrappers in its own `Code.gs`:

   ```js
   function addMenu() { MermaidManager.createMenu(); }
   // function onOpen() { MermaidManager.createMenu(); }
   function addNewChart() { MermaidManager.addNewChart(); }
   function editSelectedChart() { MermaidManager.editSelectedChart(); }
   function openPasteMarkdownDialog() { MermaidManager.openPasteMarkdownDialog(); }
   function openThemeDialog() { MermaidManager.openThemeDialog(); }
   function insertImage(source, theme, base64, width, height) { return MermaidManager.insertImage(source, theme, base64, width, height); }
   function insertMarkdownBlocks(blocks) { return MermaidManager.insertMarkdownBlocks(blocks); }
   function setImageFrameConfig(config) { return MermaidManager.setImageFrameConfig(config); }
   function getImageFrameConfig() { return MermaidManager.getImageFrameConfig(); }
   function getMermaidThemeConfig() { return MermaidManager.getMermaidThemeConfig(); }
   function saveMermaidCustomTheme(theme) { return MermaidManager.saveMermaidCustomTheme(theme); }
   function deleteMermaidCustomTheme(id) { return MermaidManager.deleteMermaidCustomTheme(id); }
   ```

   Note the consumer currently exposes the menu via `addMenu()` rather than an `onOpen()` trigger. The header comment at the top of `src/Code.gs` shows the `onOpen` variant; both are valid.

**Why wrappers exist.** Menu items and `google.script.run` calls from HTML dialogs can only reach functions defined in the *consumer* project, never library functions directly. The dialogs (`index.html`, `paste_markdown.html`, `theme_settings.html`) ship inside the library, but every server call they make resolves against the consumer's global scope.

**Consequence for any change:** if you add, rename or change the signature of a server function that is called from a menu item or from a dialog, you must:

1. Mark it `@public` in `src/Code.gs`.
2. Add or update the matching wrapper in the header comment of `src/Code.gs`.
3. Tell the user that every consumer project's wrapper list must be updated too, otherwise the menu item or dialog call fails at runtime with a "function not found" style error.

Functions ending in `_` are private helpers (Apps Script convention) and are not exposed to consumers.

## File map

| Path | Status | Role |
|---|---|---|
| `src/Code.gs` | **Active** | All server-side logic. Menu, dialogs, image insert/replace, Markdown block insertion, table and code-block styling, theme and frame persistence. |
| `src/index.html` | **Active** | "New chart" / "Edit selected chart" dialog. Mermaid editor with live preview, theme select, frame controls, SVG to PNG export. |
| `src/paste_markdown.html` | **Active** | "Paste from markdown" dialog. Parses Markdown with `marked`, renders Mermaid fences to PNG, sends a block list to the server. |
| `src/theme_settings.html` | **Active** | "Manage themes" dialog. CRUD for custom themes with a live preview and colour swatches. |
| `src/appsscript.json` | **Active** | Manifest. V8 runtime, no explicit OAuth scopes (inferred; `@OnlyCurrentDoc` in `Code.gs` restricts to the open document). |
| `src/Mermaid Gdocs.gs` | **Legacy, unused** | Original standalone Docs add-on entry point. Kept only in case standalone add-on packaging is ever revived. Do not edit, do not include in the Apps Script project. |
| `src/Mermaid Slides.gs` | **Legacy, unused** | Original Google Slides variant. Same rules as above. The library currently targets Docs only (`DocumentApp`). |
| `custom_themes/*.json` | Reference | Sample `themeVariables` JSON files that can be pasted into the "Manage themes" dialog. |
| `docs/` | Legacy | Static marketing site and privacy policy from the original marketplace add-on. Not part of the library. |
| `deploy.sh` | Legacy | Rsyncs `docs/` to the original author's server. Not relevant to this fork; do not run. |
| `README.md` | Partly stale | Still describes the project as a standalone wrapper. Treat this file as the authoritative description of how the code is used. |
| `vscode/` | Empty | Ignore. |

## Architecture and data flow

### Dialog bootstrapping

Server functions open dialogs with `HtmlService.createHtmlOutputFromFile(...)` and append a `<script>` that sets window globals as the initial payload:

- `window.graphDataFromGoogle` (editor): `{ source, label, theme, currentWidth, maxImageWidth, maxImageWidthRatio }`
- `window.mermaidImageLayoutFromGoogle` (paste dialog): `{ maxWidth, widthRatio }`
- `window.mermaidThemeDataFromGoogle` (all dialogs): result of `getMermaidThemeConfig()`

Always serialise with `jsonForHtml_()` which escapes `<` to avoid breaking out of the script tag. The dialogs additionally re-fetch theme and frame config through `google.script.run` on load so they pick up the latest state.

### Image round-trip

1. Dialog renders Mermaid to SVG in the browser (Mermaid 11 from jsDelivr, plus optional ELK layout loader).
2. `getScaling()` computes a display size that fits the document content width (reported by the server as page width minus margins, times `DOCUMENT_POINTS_TO_IMAGE_PIXELS = 2`, capped at `DOC_MAX_DIMENSION = 1600`) and a raster quality multiplier.
3. `svgAsPng()` draws the SVG to a canvas, optionally with a border frame, and produces a base64 PNG data URL.
4. The dialog calls `insertImage(source, theme, base64, width, height)` on the consumer, which forwards to the library.
5. The server decodes the PNG, inserts it as an **inline image** in a centred paragraph, and tags it:
   - `altTitle = 'mermaid-graph/<themeId>'`
   - `altDescription = <mermaid source>`

   Older images may store a JSON object `{ source, theme }` in the alt description. `editSelectedChart()` handles both forms. Keep that backward compatibility.

6. `findSelectedImage()` identifies editable images by the `mermaid-graph` alt-title prefix. Only inline images work; wrapped or floating images are not found.

### Edit flow

When replacing a selected image the server either swaps the inline image in place (keeping the user's resized width via `currentWidth`), or, if the image sits alone in a single-cell table, removes that table and reinserts a plain paragraph.

### Markdown flow

`paste_markdown.html` turns `marked` tokens into a flat list of blocks: `heading`, `paragraph`, `list_item`, `code`, `mermaid`, `table`, `rule`. Each block carries `quoteDepth` (blockquote nesting, rendered as indent) and inline segments `{ text, bold, italic, code, strikethrough, superscript, subscript, linkUrl }`. Mermaid blocks are rendered client-side and carry `base64`, `width`, `height`, `theme`. The server inserts blocks starting after the cursor's top-level element, or at the end of the body if there is no cursor.

Markdown mermaid fences accept a theme after the language, for example ```` ```mermaid forest ````. The "Theme" select in the paste dialog can override all fences.

Code blocks become single-cell tables styled by `MARKDOWN_CODE_STYLE`, with a basic JavaScript/TypeScript syntax highlighter. Tables are styled by `MARKDOWN_TABLE_STYLE` and column widths are set proportionally to content length. These style objects at the top of `Code.gs` are the place to tune appearance.

### Themes

- Built-in: `default`, `forest`, `dark`, `neutral`, `base` (`MERMAID_BUILT_IN_THEMES`).
- Custom: ids are `custom:<slug>`, always rendered with Mermaid theme `base` plus the stored `themeVariables`.
- Storage: `PropertiesService.getUserProperties()` under key `mermaidCustomThemes` (JSON array). Hard limits: 8000 chars total, 60 char names, 150 variable keys, 500 char string values. All input is sanitised server-side; keep that behaviour when changing the schema.
- Image frame settings (border width, colour, padding) are stored under `mermaidImageFrameConfig` in the same user properties.

Theme resolution logic (`normalizeMermaidThemeData`, `resolveThemeId`, `getMermaidRenderConfig`) is **duplicated** in `index.html` and `paste_markdown.html`, as are `sanitizeFrameConfig`, `getScaling`, `drawImageFrame` and `svgAsPng`. This is deliberate because each dialog is a self-contained HTML file loaded with `createHtmlOutputFromFile` and there is no module sharing. When you change one copy, change the other.

### Multi-tab documents

`getActiveBody_()` prefers the active tab's body when the Docs tabs API is available and falls back to `document.getBody()`. Use it instead of calling `getBody()` directly.

## Conventions and constraints

- **Runtime.** Apps Script V8. `Code.gs` mixes `var` style with some ES2015+ (optional chaining, arrow functions, template literals), which V8 supports. Do not introduce ES modules, `import`, Node APIs or npm dependencies in `.gs` files.
- **Dialog JS.** Dialogs use `<script type="module">` and load Mermaid 11, `marked` and the ELK layout loader from jsDelivr at runtime. There is no bundling. External network access from the dialog sandbox is required.
- **Google styling.** Dialogs link `https://ssl.gstatic.com/docs/script/css/add-ons1.css` for Google-like controls.
- **Defensive API calls.** `Code.gs` guards many Docs API methods with `typeof x.method === 'function'` because availability varies by runtime version and element type. Keep that pattern when adding new styling calls.
- **Errors.** Server functions throw `Error` with user-readable messages; dialogs show them via `withFailureHandler`. Keep messages human-friendly, they are displayed directly.
- **Scopes.** Do not remove the `@OnlyCurrentDoc` annotation. Do not add explicit `oauthScopes` to `appsscript.json` unless a feature genuinely needs them, and say so in the change description.
- **Legacy files.** Do not modify, delete or "clean up" `Mermaid Gdocs.gs` or `Mermaid Slides.gs`. Do not port new features into them.
- **Git.** Work happens on `develop`; `master` is the main branch. Commit messages follow `feat: ...`, `fix: ...` style.

## Local development

- Serve `src/` statically (for example `npx http-server src`) and open `index.html` to iterate on the editor UI. When `window.google` is undefined, the editor shows the generated PNG inline instead of inserting it, and server calls resolve to `null`.
- `paste_markdown.html` and `theme_settings.html` can be opened the same way for layout and parsing work, but their server calls reject because the Apps Script runtime is unavailable. Insert and save will not work outside Docs.
- To test end to end: paste the five active files into the library Apps Script project, create a new library version or redeploy, and open a Doc whose bound script includes the wrappers above. Run `addMenu` (or reload if `onOpen` is enabled) to get the **Mermaid** menu.
- There are no automated tests. For any change to `Code.gs`, describe the manual checks you expect the user to run (insert, edit, paste Markdown with a mermaid fence and a table, save and delete a custom theme).

## Known quirks worth keeping in mind

- Only the default signed-in Google account works with the add-on's selection APIs. `findSelectedImage()` catches the resulting error and shows a long explanatory alert. Do not "simplify" that away.
- `widenMarkdownTable_()` assumes a US Letter content width of 468pt whereas image sizing reads the real page geometry. These two code paths are intentionally independent for now.
- "Invalid image data" errors from Docs mean the PNG is too large. The dialogs cap raster size at 1600px; if you change `DOC_MAX_DIMENSION`, `MAX_RASTER_DIMENSION` or `EXPORT_QUALITY_MULTIPLIER`, change them in both dialogs.
- Horizontal rules are inserted as a centred line of underscores because the Docs API has no native rule element.
- Icons (FontAwesome) in Mermaid diagrams are not supported because the SVG is rasterised without external fonts.

## Checklist before finishing a change

1. Did you touch a `@public` function signature or add a new server entry point? Update the wrapper list in the `Code.gs` header and remind the user to update consumer projects.
2. Did you change shared dialog logic (theme resolution, scaling, frame, PNG export)? Apply the same change to every dialog that contains the copy.
3. Did you add new Docs API calls? Guard them like the existing code does.
4. Did you leave `Mermaid Gdocs.gs` and `Mermaid Slides.gs` untouched?
5. Remind the user that `src/` must be copied into the Apps Script library project and a new library version deployed.
