# MangaYarou Development Rules (Konva & State Management)

To prevent the "Canvas Disappearance Bug" and "State Corruption" from recurring, follow these strict rules when modifying the codebase.

## 1. React-Konva Rendering (High Priority)

### ❌ NO Whitespace or Comments inside Konva Groups/Layers
React-Konva interprets any text (including newlines, spaces, or JS comments) between Konva components as a `Text` node. This will cause a renderer error: `Text components are not supported for now in ReactKonva`.

**Bad:**
```tsx
<Group>
  <Line ... />
  {/* Risky Comment */}
  <Circle ... />
</Group>
```

**Good:**
```tsx
<Group>
  <Line ... />
  <Circle ... />
</Group>
```

### ❌ NO Complex IIFEs inside JSX
Immediately Invoked Function Expressions (IIFEs) often introduce whitespace and make reconciliation harder.

**Better Approach:** Extract complex conditional rendering into dedicated sub-components (e.g., `FocusAdjustmentHandle`, `PanelStrokes`). This keeps the main Konva tree clean and stable.

---

## 2. Zustand State Management

### ✅ Mandatory State Spreading
When updating a specific page's panels or bubbles, ALWAYS spread the top-level state and the current page object to ensure metadata like `currentPageId` is never lost.

**Correct Pattern:**
```typescript
updatePanel: (id, updates) => set((state) => ({
  ...state, // 1. Support all top-level keys
  pages: state.pages.map((page) =>
    page.id === state.currentPageId
      ? { ...page, panels: page.panels.map(...) } // 2. Spread the target page
      : page
  )
}))
```

---

## 3. Event Handling

### ✅ Cancel Drag Bubbling
Nested draggable elements (like adjustment handles inside a draggable panel) MUST stop propagation to prevent the parent from dragging simultaneously.

**Pattern:**
```tsx
onDragStart={(e) => { e.cancelBubble = true; }}
onDragMove={(e) => { e.cancelBubble = true; ... }}
```

---

## 4. Debugging

### ✅ Use the Bridge Logger
The application has a `window.electron.log` bridge. ALWAYS use this for renderer-side errors to ensure they appear in the terminal during development.

```tsx
window.electron.log(`[Renderer] Error: ${message}`);
```
