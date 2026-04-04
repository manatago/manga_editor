---
name: zustand-manga
description: 漫画野郎の Zustand（useMangaStore）を変更するとき。ページ・コマ・吹き出し・素材・Undo・履歴の整合性を保つ。
---

# Zustand（useMangaStore）

## ストアのファイル構成

ストアは **スライスパターン** で分割されている。触る機能に対応するファイルだけ編集すればよい。

```
src/renderer/src/store/
  types.ts                   ← Panel / Bubble / Material / Page など全ドメイン型
  helpers.ts                 ← deepClone / limitHistory / saveHistory / HISTORY_LIMIT
  bubbleLastStyle.ts         ← 吹き出しタイプごとの最終スタイル（localStorage 永続化）
  slices/
    historySlice.ts          ← past / future / undo / redo
    pageSlice.ts             ← pages / currentPageId / addPage / selectPage 等
    panelSlice.ts            ← selectedPanelId / clipboard / addPanel / reorderPanel 等
    bubbleSlice.ts           ← selectedBubbleId / clipboard / addBubble 等
    materialSlice.ts         ← selectedMaterialId / addMaterial 等
    projectSlice.ts          ← 保存・読込・テンプレート・アセット整理・エクスポート状態
  useMangaStore.ts           ← スライスを結合するだけ（ロジックは書かない）
```

**型を追加・変更する場合は `types.ts` を編集する。**
`useMangaStore.ts` は全型を re-export しているので、既存の import パスはそのまま機能する。

## このスキルを使うとき

- 上記スライスファイルのいずれかを編集するとき
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
- 長時間編集でメモリが膨らまないよう、履歴配列は **上限件数で丸める**（現行は 100 件）

## updatePanel / updateBubble の `undoable`

- ドラッグ中の連続更新などは **`undoable: false`** で履歴を増やさない、という使い分けがある。既存の `PanelItem` / `BubbleItem` の呼び出しを確認する

## 吹き出しテキストの「微調整」系フィールド

- `updateBubble` のような更新 API に、`textOffsetX` / `textOffsetY` / `textWeightLevel` / `textRoughness` などのフィールドが追加・拡張されることがある。
- UI/ドラッグ操作で連続更新される値は、基本的に **ドラッグ中は `undoable: false`、確定時だけ `undoable: true`** にして履歴肥大化を防ぐ（既存の連続更新パターンと揃える）。

## クリップボード拡張（吹き出し以外）

- クリップボード機能を増やすときは、`copyX` / `pasteX` の単位で `id` を除いたスナップショットを持つ。
- 貼り付け後は位置オフセットと選択状態の遷移（どの種別が選択されるか）を明示して、ショートカットの分岐と矛盾しないようにする。

## テンプレート・プロジェクト保存

- `saveAsTemplate` は `imagePath` 等を**除外**してパネル形状だけ保存する（**`grayscaleBrightness`** も画像トーン用のためテンプレートから除外）
- `setProjectData` は旧データ向けの**正規化**が入っている。フィールド追加時はここも検討
- 例: **`grayscaleBrightness`** は読み込み時 **±0.5 にクランプ**（UI スライダー ±50 と一致。手編集 JSON もこの範囲に収める）

## 新しいスライスを追加するとき

1. `store/slices/xxxSlice.ts` を作り `StateCreator<MangaState, [], [], XxxSlice>` で型付けする
2. `store/useMangaStore.ts` の `MangaState` 型に `& XxxSlice` を追加する
3. `create()((...a) => ({ ...createXxxSlice(...a), ... }))` に追加する
4. スライスファイルで `MangaState` を使う場合は `import type { MangaState } from '../useMangaStore'`（type-only import）にする（循環を runtime に持ち込まないため）

## 参照

- データモデル一覧: `.spec/manga-editor.md` の「データモデル」

## テストパターン

- 純粋関数は `vitest` で直接テストする（例: `utils/gridUtils.test.ts`）。
- ストアは `useMangaStore.getState()` ベースで操作し、`beforeEach` で最小限の初期状態に戻す。
- 追加するテストは、最低でも「状態変化」と「履歴（undo/redo）」のどちらかを検証する。
