# 漫画野郎 — プロジェクトスキル一覧

Cursor のエージェントが、本リポジトリで作業するときに参照する **プロジェクト固有スキル**です。各フォルダに `SKILL.md`（YAML フロントマター付き）があります。

## いつ何を読むか

| スキル | 作業内容の例 |
|--------|----------------|
| **konva-manga** | `Canvas.tsx`、`PanelItem` / `BubbleItem` / `MaterialItem`、Konva の `Layer` / `Group` / `Transformer` を触る |
| **zustand-manga** | `useMangaStore`、ページ・コマ・吹き出し・素材の追加・更新・Undo |
| **electron-manga** | `main` / `preload`、画像パス、`local-file`、ファイルコピー・D&D、rembg 同梱・`dist` |

## 追加・更新のしかた

- ルールを短く全体に効かせたい → リポジトリ直下の **`.cursorrules`**
- 手順・禁止事項・コード例を詳しく書く → **`.cursor/skills/<名前>/SKILL.md`**
- 仕様の説明（現状の挙動の整理）→ **`.spec/manga-editor.md`**
