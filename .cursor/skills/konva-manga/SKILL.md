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

## PanelItem の分割構成

- `PanelItem.tsx` にロジックを集約しすぎない。エフェクトは次の分割先を使う：
  - `components/effects/FadeOverlay.tsx`
  - `components/effects/FocusLines.tsx`
  - `components/effects/RainEffect.tsx`
  - `components/PanelStrokes.tsx`
- 変更時は「分割ファイルを更新し、`PanelItem` は組み立て」に徹する。

## 吹き出しテキスト（フィルタ・掠れ・二重レイヤー）

- Konva の `filters` は **`cache()` が前提**。テキストに掠れ等のフィルタを入れるときは、描画後に `cache()` が走るようにする（`requestAnimationFrame` で 1 フレーム遅延する既存パターンに合わせる）。
- `react-konva` はカスタム props をノードに載せないため、フィルタ用のパラメータは **`setAttr` / `setAttrs`** でノードに渡す必要がある（例: `distressStrength`, `distressScale`）。
- 極太（擬似太字）の実装で `Text` を二重に重ねる場合、JSX の空白問題を避けるために **サブコンポーネント化**して `Group` の子を詰める（`BubbleHorizontalTextLayers` のように分離する）。

## 吹き出し：Shift+ドラッグのモード切り替え（テキストオフセット）

- 吹き出し選択中に `Shift` 押下でドラッグすると、**吹き出し自体は固定**し、`textOffsetX` / `textOffsetY` を更新するモードがある。
- 実装は親 `Group` にフラグ（例: `isTextOffsetMode`）と開始時のポインタ座標を `setAttr` で保持し、`dragBoundFunc` で位置固定、`onDragMove` で offset 更新、`onDragEnd` で確定更新（undoable）に分ける。

## コマのインタラクション描画順（オーバーレイ UI）

- パネル同士は **配列順＝描画順＝ヒットテスト順**（後勝ち）。コマの上に出す小さな UI（例: Shift 時の画像編集タブ）は、**選択中パネルだけ最後に描画**するなどして、下に重なるコマにイベントを奪われないようにする。

## グリッド・スナップ（ドラッグ/変形）

- 吸着対象が Konva のドラッグなら、`dragBoundFunc` で位置を丸めると **ドラッグ中プレビュー**でも吸着する。
- 変形中のライブ吸着は、`Transformer` の `boundBoxFunc` で `x/y/width/height` を丸める。最小サイズ判定は丸め前後で破綻しないよう `Math.max` を使う。
- 特殊モード（例: Shift 画像編集、テキストオフセット）では通常ドラッグを固定する既存分岐を優先し、吸着処理を混ぜない。
- **`snapToGrid` は `src/renderer/src/utils/gridUtils.ts` に一元化されている**。各コンポーネントはこれを import し、`const snap = (v) => snapToGrid(v, currentPage)` のラッパーを作って使う。ローカルに再実装しない。

## スナップガイド表示

- ガイド線は `listening={false}` にしてヒットテストに干渉させない。
- 選択中の対象（コマ/吹き出し/素材）から、左右・上下・中心のガイドを描くと吸着が視認しやすい。

## エクスポート時

- `isExporting` が true のときは **インタラクション層（Transformer 含む）を描画しない**。エクスポート用の変更ではこの分岐を壊さない
- **グリッド線・スナップガイドも `!isExporting` でガードすること**。ガードを外すとエクスポートした PNG にグリッドが焼き込まれる

## キャンバスへの HTML5 ドロップ（`Canvas.tsx`）

- `onDrop` は Konva の pointer イベントを通らない。**必ず** `stage.setPointersPositions(e.nativeEvent)` のあと `stage.getPointerPosition()` で論理座標を取る（`clientX - getBoundingClientRect().left` だけだと Stage の `scaleX/scaleY` とずれ、クリップ素材の位置・ヒットが壊れる）。
- ドロップ時の幅・高さは、EXIF 付き JPEG 対策で **`createImageBitmap(file, { imageOrientation: 'from-image' })`** のピクセル寸法から縦横比を決める（`Image.width` だけだと縦長が潰れて見えることがある）。失敗時は `URL.createObjectURL` + `naturalWidth` へフォールバック。
- Electron 旧挙動の `File.path` は `(file as File & { path?: string }).path` で型付けし、`any` を避ける。

## コマ内クリップ（isClipped）の座標変換

- クリップ座標の計算は **`components/utils/geometry.ts` の `getClippedPoints`** に一元化されている。
- 変換は 3 段階: ① パネルローカル → ステージ（パネル回転適用） → ② ステージ → アイテム相対（位置を引く） → ③ アイテム相対 → アイテムローカル（アイテム回転を逆適用）。
- `clipFunc` はノードのローカル座標系で動作するため、パネルとアイテムが**それぞれ回転していても**この変換で正しくクリップされる。
- **よくあるバグ**: `getVisualClusters`（`Canvas.tsx`）で `rotation: 0` をハードコードすると、吹き出しが回転しているときにクリップがズレる。**必ず `rotation: b.rotation || 0` を渡すこと**。

## グレースケールと明るさ（Brighten）

- グレースケール ON 時は **`filters={[Konva.Filters.Grayscale, Konva.Filters.Brighten]}`** の順（先に灰度化し、その後に加算の明るさ）。
- `brightness` は Konva の **Brighten** 用属性（負で暗く・正で明るい）。`isGrayscale` が false のときは Brighten を `filters` に入れない（`brightness` は 0 でよい）。
- `fillPatternImage` の `Line` や `Image` で `cache()` する場合、`grayscaleBrightness` 変更でもキャッシュが更新されるよう **`useEffect` の依存配列に含める**。

## 参照

- 仕様のキャンバス構成: `.spec/manga-editor.md` の「画面・操作」
