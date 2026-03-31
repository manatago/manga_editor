---
name: konva-manga
description: 漫画野郎の React-Konva キャンバスを変更するとき。白画面・Text ノード誤認識・Transformer 同期を防ぐ。
---

# Konva / React-Konva（漫画野郎）

## このスキルを使うとき

- `Canvas.tsx`、`PanelItem.tsx`、`BubbleItem.tsx`、`MaterialItem.tsx` など、**Konva のツリー**を編集するとき
- **Transformer** を追加・変更するとき
- ドラッグ・ヒット領域・`renderPass`（content / effects / strokes / interaction）を触るとき

## 最重要：React-Konva と「空白・コメント」

React-Konva は、`Group` / `Layer` などの子要素の**間に入る空白・改行・JSX コメント**を `Text` ノードとして解釈することがあり、次のエラーでクラッシュする：

`Text components are not supported for now in ReactKonva`

### 禁止パターン

- `Group` 内で、子コンポーネントの間に**だけ**コメントを置く
- 子の間に**不要な改行・スペース**だけが残る（チームの方針としては「詰める」かサブコンポーネントに切り出す）

### 推奨

- 複雑な条件分岐や IIFE は、**別コンポーネント**に切り出す（IIFE を JSX 内に大量に置かない）
- インタラクション用ノードは **`id` を付ける**（例: `#interaction-${panelId}`）。`Stage.findOne('#id')` で Transformer と同期する

## Transformer

- パネルは `transformerRef` が `interaction-` プレフィックスのノードを指す想定。パネル変更後は `useEffect` でノードを再バインドしている
- 吹き出し・素材も同様に、選択 ID 変更時に `nodes([node])` と `forceUpdate` を検討する既存パターンに合わせる

## ドラッグのネスト

親がドラッグ可能なとき、内側のハンドルや子ノードでは **`e.cancelBubble = true`**（`onDragStart` / `onDragMove` 等）で親への伝播を止める。既存の調整ハンドルと同じ考え方。

## 吹き出しテキスト（フィルタ・掠れ・二重レイヤー）

- Konva の `filters` は **`cache()` が前提**。テキストに掠れ等のフィルタを入れるときは、描画後に `cache()` が走るようにする（`requestAnimationFrame` で 1 フレーム遅延する既存パターンに合わせる）。
- `react-konva` はカスタム props をノードに載せないため、フィルタ用のパラメータは **`setAttr` / `setAttrs`** でノードに渡す必要がある（例: `distressStrength`, `distressScale`）。
- 極太（擬似太字）の実装で `Text` を二重に重ねる場合、JSX の空白問題を避けるために **サブコンポーネント化**して `Group` の子を詰める（`BubbleHorizontalTextLayers` のように分離する）。

## 吹き出し：Shift+ドラッグのモード切り替え（テキストオフセット）

- 吹き出し選択中に `Shift` 押下でドラッグすると、**吹き出し自体は固定**し、`textOffsetX` / `textOffsetY` を更新するモードがある。
- 実装は親 `Group` にフラグ（例: `isTextOffsetMode`）と開始時のポインタ座標を `setAttr` で保持し、`dragBoundFunc` で位置固定、`onDragMove` で offset 更新、`onDragEnd` で確定更新（undoable）に分ける。

## エクスポート時

- `isExporting` が true のときは **インタラクション層（Transformer 含む）を描画しない**。エクスポート用の変更ではこの分岐を壊さない

## 参照

- 仕様のキャンバス構成: `.spec/manga-editor.md` の「画面・操作」
