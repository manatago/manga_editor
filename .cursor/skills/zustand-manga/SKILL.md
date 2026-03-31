---
name: zustand-manga
description: 漫画野郎の Zustand（useMangaStore）を変更するとき。ページ・コマ・吹き出し・素材・Undo・履歴の整合性を保つ。
---

# Zustand（useMangaStore）

## このスキルを使うとき

- `src/renderer/src/store/useMangaStore.ts` を編集するとき
- ページ / コマ / 吹き出し / 素材の**追加・更新・削除**のロジックを追加するとき
- **Undo / Redo** の挙動に触るとき

## 状態更新の原則

1. **`set` のコールバックでは、必要なら必ず `...state` でトップレベルを維持する**  
   `currentPageId` や `currentProjectPath` などが、意図せず `undefined` にならないようにする。

2. **ネストした配列の更新**（`pages` → 某 `page` → `panels` / `bubbles` 等）は、  
   対象の `page` オブジェクトも `...page` で広げてから、子配列だけを差し替える。

3. **スプレッドで重複キーを作らない**  
   `{ ...foo, ...bar, x: 1 }` のように、同じキーを二重に定義すると、後勝ちで意図とズレたり lint に引っかかる。既存の `updatePanel` 等の書き方に合わせる。

## 履歴（Undo / Redo）

- `saveHistory` で `past` に積み、`future` は新規操作でクリアする既存パターンがある
- `undo` / `redo` では選択 ID（`selectedPanelId` 等）をクリアする仕様に注意。UI 側が「選択が外れた」と解釈する

## updatePanel / updateBubble の `undoable`

- ドラッグ中の連続更新などは **`undoable: false`** で履歴を増やさない、という使い分けがある。既存の `PanelItem` / `BubbleItem` の呼び出しを確認する

## 吹き出しテキストの「微調整」系フィールド

- `updateBubble` のような更新 API に、`textOffsetX` / `textOffsetY` / `textWeightLevel` / `textRoughness` などのフィールドが追加・拡張されることがある。
- UI/ドラッグ操作で連続更新される値は、基本的に **ドラッグ中は `undoable: false`、確定時だけ `undoable: true`** にして履歴肥大化を防ぐ（既存の連続更新パターンと揃える）。

## テンプレート・プロジェクト保存

- `saveAsTemplate` は `imagePath` 等を**除外**してパネル形状だけ保存する
- `setProjectData` は旧データ向けの**正規化**が入っている。フィールド追加時はここも検討

## 参照

- データモデル一覧: `.spec/manga-editor.md` の「データモデル」
