# MangaYarou Project Standards & Development Rules

These rules are established to ensure long-term stability, production readiness, and to prevent common pitfalls encountered during development. All future modifications must adhere to these standards.

## 1. React-Konva Rendering & Hygiene

### ❌ NO Text/Whitespace between Konva Components
React-Konva treats any whitespace or JS comments inside a JSX block as a `Text` node. This will crash the renderer.
- **Rule**: Always map or group components tightly. Never leave newlines or spaces between siblings inside a `Group` or `Layer`.
- **Action**: Extract complex logic into sub-components rather than using inline IIFEs or fragments.

### ✅ Transformer & Interaction Logic
- **Rule**: Standardize interaction nodes using `id` (e.g., `#interaction-panel-ID`).
- **Action**: Use `stage.findOne('#id')` to sync Transformers. Ensure `draggable={isInteractive}` and `listening={isInteractive}` are correctly applied to the interaction pass.

---

## 2. State Integrity (Zustand)

### ✅ Mandatory Nested Spreading
To prevent metadata loss (like `currentPageId` or project settings), every state update must preserve the current state at every level.
- **Rule**: ALWAYS start a `set` with `...state`.
- **Rule**: When updating a page/panel/bubble, spread the parent object before modifying children.

---

## 3. Production Readiness & Asset Loading

### ✅ Local-File Protocol & Asset Management
To avoid browser security restrictions and crashes in production builds, adhere to these standards:
- **Rule**: Use the `local-file://` protocol for all local assets.
- **Action**: Always wrap local paths with `window.electron.pathToUrl(path)`.

#### 📂 Project Structure & Portability
- **Standard**: Every project must have `assets/` and `exports/` subdirectories.
- **Rule**: Copy all external images into the `assets/` folder. Use `copyFileToProject`.
- **Rule**: Sanitize filenames during copy: remove spaces, commas, and non-alphanumeric characters (keep `_` and `-`) to ensure URL safety.
- **Rule**: Always `trim()` project paths when loading or saving to prevent trailing whitespace bugs.

#### 🖱️ Drag & Drop (Electron)
- **Standard**: Standard browser `File.path` is deprecated or unreliable in some environments.
- **Rule**: Use `webUtils.getPathForFile(file)` in the preload process to retrieve native paths during D&D.

---

## 4. Error Handling & Debugging

### ✅ Bridge Logger
The application uses an IPC bridge to pipe renderer console logs to the main process terminal.
- **Rule**: Use `console.error` and `console.warn` liberally; they are automatically captured.
- **Rule**: Wrap complex IPC calls or logic in `try/catch`.
- **Action**: Report critical renderer-side failures to the user via UI or bridge log.

---

## 5. Component Architecture

### ✅ Modular Sidebars & Hooks
- **Rule**: `App.tsx` should remain a layout orchestrator.
- **Rule**: Extract complex sidebars (SidebarLeft, SidebarRight) and editor logic into separate files.
- **Rule**: Global listeners (keyboard shortcuts) should reside in custom hooks (e.g., `useKeyboardShortcuts`).
