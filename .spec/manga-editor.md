# 漫画野郎（mangas）— プロダクト仕様書

このドキュメントはリポジトリのコード（Electron + React + Konva + Zustand）から読み取った**現状の仕様**をまとめたものです。設計意図や将来ロードマップは含みません。

---

## 1. 概要

- **種類**: デスクトップ向け漫画編集アプリ（コマ割り・背景画像・吹き出し・貼り素材）
- **製品名**: `package.json` の `productName` は「漫画野郎」
- **パッケージ名**: `mangas`
- **保存形式**: ローカルフォルダに `manga.json`（JSON）＋ `assets/`（画像）＋ `exports/`（PNG 出力）

---

## 2. 技術スタック

| 領域 | 技術 |
|------|------|
| デスクトップ | Electron 40.x、`electron-vite` 5 |
| UI | React 19、Tailwind CSS 4、Lucide React、Framer Motion（一部アニメーション） |
| キャンバス | Konva / react-konva |
| 状態 | Zustand（スライスパターン、`useMangaStore` で結合） |
| 画像 | `use-image`、カスタムプロトコル `local-file://` でローカルファイルを表示 |
| フォント | `@fontsource/*`（日本語向け複数フォントを依存に含む） |
| テスト | Vitest |

---

## 3. アーキテクチャ

### 3.1 プロセス

- **メイン** (`src/main/index.ts`): `BrowserWindow`、IPC、`local-file` プロトコル、ファイル I/O
- **プリロード** (`src/preload/index.ts`): `contextBridge` で `window.electron` を公開
- **レンダラー** (`src/renderer/`): React アプリ

### 3.4 ストア構成（Zustand スライスパターン）

`useMangaStore` はスライスを結合するだけの薄いファイル。ロジックは各スライスに分割されている。

| ファイル | 責務 |
|---------|------|
| `store/types.ts` | 全ドメイン型定義（Panel / Bubble / Material / Page 等） |
| `store/helpers.ts` | `deepClone` / `limitHistory` / `saveHistory` / `HISTORY_LIMIT` |
| `store/slices/historySlice.ts` | past / future / undo / redo |
| `store/slices/pageSlice.ts` | pages / currentPageId / ページ CRUD / movePage |
| `store/slices/panelSlice.ts` | selectedPanelId / clipboard / パネル CRUD / reorderPanel |
| `store/slices/bubbleSlice.ts` | selectedBubbleId / clipboard / bubbleLastStyleByType / 吹き出し CRUD |
| `store/slices/materialSlice.ts` | selectedMaterialId / 素材 CRUD |
| `store/slices/projectSlice.ts` | 保存・読込・テンプレート・アセット整理・エクスポート状態 |

### 3.5 共有ユーティリティ

| ファイル | 内容 |
|---------|------|
| `utils/gridUtils.ts` | `snapToGrid(value, page)` — グリッド吸着の単一実装。各コンポーネントはここから import する |
| `utils/dialogs.ts` | `showError` / `showInfo` / `confirmMessage` — Electron ネイティブダイアログのラッパー |
| `utils/projectAssets.ts` | アセットパスの相対化・解決ロジック |

### 3.2 カスタムプロトコル `local-file`

- ローカル画像パスを `local-file://...` として `net.fetch` で配信
- プリロードの `pathToUrl` がファイルパスを `local-file://` に変換

### 3.3 レンダラーログ

- `console.error` / `console.warn` を IPC でメインに転送し、ターミナルに色付き出力
- `error` / `unhandledrejection` もログ

---

## 4. データモデル（Zustand）

### 4.1 プロジェクト

- `MangaProjectData`: `{ pages: Page[], lastPageId: string | null }`
- ストアは `currentProjectPath` を保持し、**保存先**として使う

### 4.2 ページ (`Page`)

- `id`, `name`（001 形式の連番に正規化される）
- `pageWidth`, `pageHeight`（ページごとのキャンバスサイズ）
- `gridEnabled`, `gridSize`（グリッド表示・スナップ設定）
- `panels`, `bubbles`, `materials`
- ページ背景: `backgroundColor`, `backgroundOpacity`, `bgGradientType`（none | linear | radial）, グラデーション色・線形時の回転

### 4.3 コマ (`Panel`)

- **形状**: `PanelType` = `rect` | `slanted` | `trapezoid-h` | `trapezoid-v` | `pentagon` | `hexagon` | `circle`
- 位置・サイズ: `x`, `y`, `width`, `height`, `rotation`, `strokeWidth`, `strokeColor`
- 斜め・台形用: `slant`, `offsetB`, `offsetC`, `offsetD`
- **背景画像**: `imagePath`, `imageX`, `imageY`, `imageScale`, `imageRotation`, `imageFlipX`
- **効果**: フェードアウト（8方向 + クリア）、集中線、ぼかし、雨エフェクト（密度・不透明度）など
- **パネル背景**: 単色・グラデーション（ページと同様の概念がパネルにも存在）

### 4.4 吹き出し (`Bubble`)

- **種類**: `rounded` | `jagged` | `rect` | `flash` | `shout` | `square-jagged` | `megaphone` | `rect-double`
- テキスト、フォント（サイズ・ファミリー・色・太さ）、縦書き/横書き、行間
- 背景・枠・不透明度、変形・しっぽ・回転など多数のプロパティ
- **`isClipped` + `panelId`**: コマ内にクリップして表示するか／フレーム外に重ねるか
- **テキスト描画（追加仕様）**:
  - **文字の相対オフセット**: `textOffsetX` / `textOffsetY` で、吹き出し内のテキスト位置を微調整できる
  - **太さ（3段階）**: `textWeightLevel`（0|1|2）で太さ段階を制御（既存 `fontWeight` と共存）
    - 2（極太）は通常の `stroke` とは別に、同系色の太い stroke を重ねる疑似太字レイヤーを使用する
  - **縁取り**: `textStrokeColor` / `textStrokeWidth`（0 のとき無効）
  - **掠れ**: `textRoughness`（0..1）で粒状の掠れを適用（Konva の filter を使うため内部で `cache()` が必要）
  - **縦書きの字形**: 縦書き時は一部記号・小書き・句読点で回転／位置調整を行う

### 4.5 素材 (`Material`)

- 画像パス、位置・サイズ、回転、不透明度
- **`isClipped` + `panelId`**: コマ内クリップ
- `isGrayscale`、白飛び除去（Alpha Threshold）など UI あり

### 4.6 選択状態

- `selectedPanelId` | `selectedBubbleId` | `selectedMaterialId` は互いに排他（片方を選ぶと他はクリア）

### 4.7 履歴

- `past` / `future` に `pages` と `currentPageId` のスナップショットを保持
- 履歴は上限あり（`past` / `future` ともに 100 件まで）
- **Undo**: `Cmd/Ctrl+Z`、**Redo**: `Cmd/Ctrl+Shift+Z` または `Cmd/Ctrl+Y`
- Undo/Redo 時は選択 ID はクリアされる（パネル・吹き出しは null、Redo 時はマテリアルも null）

### 4.8 クリップボード（吹き出し・コマ）

- `copyBubble` / `pasteBubble` は `id` を除いた `clipboardBubble` を保持
- 貼り付け時は位置を少しオフセット
- `copyPanel` / `pastePanel` は `id` を除いた `clipboardPanel` を保持
- 貼り付け時は位置を少しオフセットし、選択対象を貼り付けたコマに移す

### 4.9 吹き出しタイプごとの「最後のスタイル」

- `bubbleLastStyleByType`: 各 `BubbleType` について、**直近で編集した吹き出し**のスタイル（フォント・色・枠・しっぽの太さなど、位置・テキスト内容・しっぽ先端座標は除く）を保持
- **永続化**: `localStorage` キー `manga-yarou-bubble-last-style-v1`（アプリ再起動後も継続）
- **更新タイミング**: `updateBubble` が成功するたび、その吹き出しの `type` キーにスナップショットを保存
- **適用タイミング**: `addBubble` で新規作成するとき、デフォルト値のあとに **そのタイプ**の保存スタイルをマージし、最後に呼び出し元の `props`（位置・`panelId`・`type` など）で上書き

### 4.10 ページテンプレート

- `PageTemplate`: `{ id, name, panels: Omit<Panel,'id'>[] }`
- **保存場所**: `app.getPath('userData')/templates.json`（プロジェクト外）
- テンプレート保存時は **画像関連フィールドを除いた**パネル情報のみ保存

---

## 5. 画面・操作

### 5.1 レイアウト

- **左サイドバー**: プロジェクト新規/開く、**現在ページの PNG 出力**、**全ページ一括 PNG**、ページ一覧（追加・並べ替え・削除）、Assets 整理
- **中央**: ページ設定で変更可能な Konva `Stage`（初期値 840×1188）
- **上部ツールバー**: コマ形状の追加（矩形・斜め・台形2種・正五角形・正六角形・円）、選択中コマ向け吹き出し種類の追加（コマ未選択時は無効）
- **右サイドバー**: プロパティ（ページ / コマ / 吹き出し / 素材のいずれか）

### 5.1.1 右サイドバー（コマ）主な項目

- コマ形状（アイコン + 日本語ラベル）、形状調整（斜め/台形時のみ）
- コマ回転（スライダー）、前後関係（最前面/最背面/前へ/後ろへ）
- 枠線（色・太さ）、サイズ（幅・高さ）、画像アップロード、背景（色/不透明度/グラデーション）
- 画面効果として、ぼかし・フェードアウト・集中線・雨を1セクションに統合

### 5.2 キャンバス描画順（概要）

1. ページ背景
2. 各コマごとに: パネル内容 → エフェクト → **コマ内クリップ**の吹き出し（クラスター描画）→ コマ内クリップ素材 → ストローク
3. 孤立したクリップ吹き出し/素材
4. **コマ外**の吹き出し・素材
5. エクスポート時は非表示の **インタラクション層**（選択・Transformer）

**吹き出しクラスター**: 同種・同色など近い条件でグループ化し、フォント等をマスターに合わせる（重なり判定あり）。

### 5.3 ドラッグ＆ドロップ

- 画像をドロップするとプロジェクト `assets/` にコピー（ファイル名はサニタイズ＋タイムスタンプ）
- ドロップ先が **画像のないコマ** → 背景画像として設定
- **既に画像があるコマ** または **2枚目以降** → `Material` として追加（多くは `isClipped: true` + `panelId`）
- コマ外 → クリップなし素材

### 5.3.1 背景画像の Shift オーバーレイ編集

- コマ選択中に `Shift` 押下で、コマ上に画像編集タブを表示
- モード: `移動`（既存挙動）, `拡大縮小`（上ドラッグで拡大/下で縮小）, `回転`（右ドラッグで右回転/左で左回転）
- 追加トグル: `グレースケール`, `左右反転`
- 上端でタブが画面外に出る場合はコマ下に表示
- スクロール可能な編集エリアの**見えている範囲**に収まるよう、タブ位置を上下・左右に自動調整する（他コマより手前に描画し、下のコマにクリックが奪われないようにする）

### 5.4 キーボードショートカット（入力欄フォーカス時は無効）

- `Backspace` / `Delete`: 選択中コマに画像があれば画像クリア、なければコマ削除；吹き出し・素材は削除
- `Cmd/Ctrl+S`: 保存
- `Cmd/Ctrl+C` / `V`: 吹き出しのコピー/ペースト
- `Shift` + ドラッグ（吹き出し選択中）: **吹き出し自体は動かさず**、テキストのオフセット（`textOffsetX` / `textOffsetY`）を更新する（ドラッグ中は `undoable: false`、確定時のみ `undoable: true`）

### 5.5 Transformer

- **コマ**: リサイズのみ（回転ハンドルなし）、最小サイズあり  
  ※回転は右サイドバーの「コマ回転」スライダーで行う
- **吹き出し**: リサイズ＋回転、カスタム回転ハンドル
- **素材**: リサイズ（アスペクト比維持）＋回転
- グリッド ON 時は、ドラッグ中・リサイズ中・確定時の座標/サイズがグリッド間隔に吸着する

---

## 6. ファイル・IPC

### 6.1 プロジェクトフォルダ構成（作成時）

- `manga.json`
- `assets/`
- `exports/`

### 6.1.1 画像パス（manga.json）

- コマ・素材の `imagePath` は **`assets/ファイル名` のようにプロジェクトルートからの相対パス**で保存する（別 Mac やフォルダ移動後も開けるようにするため）。
- 表示時はプリロードの `resolveAssetPath(projectRoot, imagePath)` で実ファイルの絶対パスに解決してから `local-file` で読み込む。
- 旧データの絶対パスは、プロジェクトを開いたとき `setProjectData` 内で相対パスに正規化される。手元の JSON だけ直す場合は `scripts/convert-manga-json-to-relative-assets.mjs` を使える。

### 6.2 メイン IPC（プリロード経由）

- フォルダ選択、プロジェクト作成/読込/保存
- テンプレート get/save/delete
- 画像選択、プロジェクトへファイルコピー、PNG 書き出し（base64）
- アセット一覧、ファイル削除
- `getPathForFile`（Electron `webUtils`）
- `showMessage` / `confirmMessage`（Electron ダイアログ）
- `saveProjectSync`（終了直前の同期 flush 用）

### 6.3 自動保存

- `pages` またはプロジェクトパス変更から **1 秒デバウンス**で `saveProject`
- ページ切り替え時も `saveProject`（`lastPageId` 永続化）
- 終了直前（`beforeunload`）は pending なデバウンス保存を同期 IPC で flush する

### 6.4 PNG エクスポート

- `Stage.toDataURL({ pixelRatio: 2 })`
- 一時的に `isExporting` で Transformer を隠す
- `exports/<ページ名>.png` に保存（ページの `name`、例 `001.png`）
- **一括**: 全ページを順に `selectPage` してキャンバス更新後に同様に書き出し、完了後に元の `currentPageId` に戻す
- 固定 `setTimeout` ではなく、描画フレーム待機（`requestAnimationFrame`）でキャプチャタイミングを安定化している

---

## 7. 互換性・読み込み

- `setProjectData` で旧データ（`points` 由来の width/height など）を補完
- ページ名は読み込み後に **連番で正規化**

---

## 8. ビルド・配布

- `electron-builder` で macOS は **dmg** ターゲット（`appId`: `com.electron.manga` など）

---

## 9. コード上の注意（開発時）

- Zustand でスプレッド更新する際、**キーの重複**に注意（`.cursorrules` の記載）
- レンダラー変更後はインポート・型を確認し、**白画面**を避ける
- `PanelItem` のエフェクト系実装は分割済み（`components/effects/FadeOverlay.tsx`、`components/effects/FocusLines.tsx`、`components/effects/RainEffect.tsx`、`components/PanelStrokes.tsx`）
- グリッド吸着ロジックは `utils/gridUtils.ts` の `snapToGrid` を共通利用する
- `npx tsc --noEmit` で型エラーゼロを維持し、`vitest` で `gridUtils` / `useMangaStore` の基本テストを回す
- **グリッドスナップは `utils/gridUtils.ts` の `snapToGrid` を使う**。各コンポーネントにローカル実装しない
- **ストアのロジックを追加・変更するときは `store/slices/` の対応スライスを編集する**。`useMangaStore.ts` 本体にはロジックを書かない
- **グリッド線・スナップガイドは `!isExporting` でガードすること**（ガードがないと PNG にグリッドが焼き込まれる）

---

## 10. 仕様から読み取れないこと（要確認になりうる点）

以下はコードだけでは確定できないため、必要ならプロダクトオーナーに確認してください。

1. **ターゲット OS**: Windows/Linux 向けの動作確認・ビルド設定は `package.json` の mac 記述が主
2. **協業・クラウド**: 同期、クラウド保存、複数ユーザー編集は未実装
3. **印刷・原稿サイズ**: キャンバスは 840×1188 固定で、解像度・印刷規格は UI 上明示なし
4. **著作権・フォント**: 同梱フォントの商用利用条件は各 `@fontsource` ライセンスに依存

---

*最終更新: リポジトリの現行コードに基づく*
