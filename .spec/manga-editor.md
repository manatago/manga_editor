# 漫画野郎（mangas）— プロダクト仕様書

このドキュメントはリポジトリのコード（Electron + React + Konva + Zustand）から読み取った**現状の仕様**をまとめたものです。設計意図や将来ロードマップは含みません。

---

## 1. 概要

- **種類**: デスクトップ向け漫画編集アプリ（コマ割り・背景画像・吹き出し・貼り素材）
- **製品名**: `package.json` の `productName` は「漫画野郎」
- **パッケージ名**: `mangas`
- **保存形式**: ローカルフォルダに `manga.json`（JSON）＋ `assets/`（画像の3サブフォルダ構成、下記）＋ `exports/`（PNG 出力）

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
| `utils/projectAssets.ts` | アセットパスの相対化・整理対象外（dust 等）の判定 |
| `utils/assetsLayout.ts` | `images` / `dust` / `references` のセグメント名・`copyFileToProject` 用サブパス |

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
- **トーン**: `isGrayscale`、**`grayscaleBrightness`**（-0.5〜0.5、Konva **Brighten**。右パネル「画面効果」でグレースケール中のみスライダー。Shift オーバーレイのグレートグルと併用）
- **効果**: フェードアウト（8方向 + クリア）、集中線、ぼかし、雨エフェクト（密度・不透明度）など
- **パネル背景**: 単色・グラデーション（ページと同様の概念がパネルにも存在）

### 4.4 吹き出し (`Bubble`)

- **種類**: `rounded` | `jagged` | `rect` | `flash` | `shout` | `square-jagged` | `megaphone` | `rect-double`
- テキスト、フォント（サイズ・ファミリー・色・太さ）、縦書き/横書き、行間
- 背景・枠・不透明度、変形・しっぽ・回転など多数のプロパティ
- **`flash`（ウニ）の背景色**: `drawFlashPath` は `moveTo/lineTo` のみで閉じたパスを持たないため通常の `fill` は使えない。代わりに楕円 Shape をラジアルグラジエントで描画し、中心から外縁へ `backgroundColor → transparent` にフェードアウト（全方位）させる。クラスター描画の mask パスでは黒一色の楕円を描く。
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
- `isGrayscale`、**`grayscaleBrightness`**（-0.5〜0.5、素材設定でグレー中のみスライダー）、白飛び除去（Alpha Threshold）など UI あり

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
- テンプレート保存時は **画像関連フィールドを除いた**パネル情報のみ保存（`isGrayscale` / `grayscaleBrightness` 等も除外）

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
- 画面効果として、ぼかし・**グレースケール中の明るさスライダー**・フェードアウト・集中線・雨を1セクションに統合

### 5.2 キャンバス描画順（概要）

1. ページ背景
2. 各コマごとに: パネル内容 → エフェクト → **コマ内クリップ**の吹き出し（クラスター描画）→ コマ内クリップ素材 → ストローク
3. 孤立したクリップ吹き出し/素材
4. **コマ外**の吹き出し・素材
5. エクスポート時は非表示の **インタラクション層**（選択・Transformer）

**吹き出しクラスター**: 同種・同色など近い条件でグループ化し、フォント等をマスターに合わせる（重なり判定あり）。

### 5.2.1 コマ内クリップ（`isClipped`）の座標変換

`isClipped: true` の吹き出し・素材は **`clipFunc`** によってコマ形状に切り取られる。クリップ座標の計算は `components/utils/geometry.ts` の `getClippedPoints` に一元化されている。

変換ステップ（3 段階）:
1. **パネルローカル → ステージ**: パネルの回転を適用（`panel.rotation`）
2. **ステージ → アイテム相対**: アイテムの位置 `(item.x, item.y)` を引く
3. **アイテム相対 → アイテムローカル**: アイテムの回転を逆適用（`-item.rotation`）

Konva の `clipFunc` はそのノードのローカル座標系で動作するため、上記の変換でパネルとアイテムが**それぞれ回転していても**正しくクリップされる。

#### やりがちなバグ

- `getVisualClusters`（`Canvas.tsx`）でクリップ座標を計算するとき、`rotation` を `0` にハードコードすると吹き出しが回転している場合にクリップがズレる。**必ず `rotation: b.rotation || 0` を渡すこと**。
- 素材（`MaterialItem`）も同様に `getClippedPoints` を使う。`ClipItem` 型は `{ isClipped, panelId, x, y, rotation? }` で統一されている。

### 5.3 ドラッグ＆ドロップ

- 画像をドロップするとプロジェクト **`assets/images/`** にコピー（ファイル名はサニタイズ＋タイムスタンプ）。ネイティブパスは **`getPathForFile`** を優先し、無い場合のみ `File & { path?: string }` の `path` を参照
- **座標**: HTML5 の `drop` は Konva の pointer 更新を通らないため、**`stage.setPointersPositions(e.nativeEvent)`** のあと **`getPointerPosition()`** でドロップ位置とパネル命中を決める（手計算の `clientX - rect` だけだと表示スケールとずれる）
- **縦横比**: 取り込み前のサイズは **`createImageBitmap(file, { imageOrientation: 'from-image' })`** の幅・高さから `maxDim` に収める（EXIF 縦持ち JPEG のピクセルが横長でも見た目の縦横比を維持）。失敗時は `Image` + `naturalWidth` / `naturalHeight` にフォールバック
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

- `Backspace` / `Delete`: 選択中コマに画像があれば画像クリア（`isGrayscale` / `grayscaleBrightness` もリセット）、なければコマ削除；吹き出し・素材は削除
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
- `assets/`（**直下にファイルを置かず**、次の3ディレクトリのみ）
  - **`images/`** … コマ・素材・D&D 取り込み画像、**合成ツール出力**（`images/composite/`）
  - **`dust/`** … アセット整理で「未使用」と判定されたファイルの**退避先**（削除しない）
  - **`references/`** … 参照キャラ（`references/characters/…`）、背景ライブラリ（`references/backgrounds/…`）
- `exports/`

### 6.1.1 画像パス（manga.json）

- コマ・素材の `imagePath` などは **`assets/images/...` のようにプロジェクトルートからの相対パス**で保存する（別 Mac やフォルダ移動後も開けるようにするため）。
- 参照・背景ライブラリは **`assets/references/...`**。
- 表示時はプリロードの `resolveAssetPath(projectRoot, imagePath)` で実ファイルの絶対パスに解決してから `local-file` で読み込む。`resolveAssetPath` は **旧レイアウト**（`assets/workspace/...`、直下 PNG、旧 `_trash` など）も存在すればフォールバックで解決する。
- 旧データの絶対パスは、プロジェクトを開いたとき `setProjectData` 内で相対パスに正規化される。手元の JSON だけ直す場合は `scripts/convert-manga-json-to-relative-assets.mjs` を使える。
- フォルダ構成を新形式へ揃える場合は **`scripts/migrate-assets-layout.mjs`**（`assets/workspace` の解体やパス書き換え）。

### 6.2 メイン IPC（プリロード経由）

- フォルダ選択、プロジェクト作成/読込/保存
- テンプレート get/save/delete
- 画像選択、プロジェクトへファイルコピー、PNG 書き出し（base64）
- アセット一覧、ファイル削除、**未使用アセットを `assets/dust/` へ移動**（`move-asset-to-trash` IPC 名は互換のためそのまま）
- 合成 PNG 保存（`assets/images/composite/`）、rembg など
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
- **一括**: 全ページを順に `selectPage` するが、**`use-image` の非同期読み込み待ち**のため `react-dom` の `flushSync` でページ切替を同期的にコミットし、複数フレーム＋短い `setTimeout` のあと `toDataURL` する。ループ中は **`selectPage(..., { skipAutosave: true })`** で毎ページの `saveProject` を省略し、完了後に元のページへ戻して保存する

---

## 7. 互換性・読み込み

- `setProjectData` で旧データ（`points` 由来の width/height など）を補完
- **`grayscaleBrightness`** は読み込み時 **±0.5 にクランプ**（UI スライダーと一致）
- ページ名は読み込み後に **連番で正規化**

---

## 8. ビルド・配布

- `electron-builder` で macOS は **dmg** ターゲット（`appId`: `com.electron.manga` など）
- **`build.publish`: `null`** … CI 検出時の暗黙 GitHub publish を止め、`GH_TOKEN` 未設定でのビルド失敗を防ぐ（リリース公開時は別途 `publish` やトークンを明示）

### 8.1 rembg 同梱（`dist:with-rembg`）

`scripts/bundle-rembg.mjs` が `resources/bundled-rembg/<platform>-<arch>/venv/` を生成し、**`invoke-rembg.py`** を各アーキフォルダにコピーしたうえで、`electron-builder` の `extraResources` で `Resources/rembg/` に同梱する。

**重要な制約（過去のバグから）**

| 禁止 / 注意 | 理由 |
|------------|------|
| `pip install rembg[cli]` は**不要** | `typer`/`click`/`gradio` など巨大な CLI 依存が引き込まれ、同梱 venv に含まれない場合にエラー |
| `pip install` は **`rembg[cpu]`** | onnxruntime（推論エンジン）が入らず `No onnxruntime backend found` で落ちる |
| macOS/Linux の venv は **`--copies`** | 既定の symlink が bundle 外の Python を指し、`codesign --verify --strict` が「bundle 外への symlink」で失敗することがある |
| `rembg.cli` 経由**禁止** | CLI extras なしでは失敗しうる |
| `invoke-rembg.py` は `rembg.remove()` / `new_session()` を**直接呼ぶ** | `rembg[cpu]` のみで動かす |
| メインの `rembgRunner` は **`venv/bin/python` + `invoke-rembg.py`** を優先 | `venv/bin/rembg` の shebang はビルド機の絶対パスになり、.app 同梱後に壊れやすい |
| `spawn` の `cwd` は必ず **`os.tmpdir()`** | プロジェクトルートの `coverage/`（vitest）を Python が誤 import し numba が壊れるのを防ぐ |

**エラーメッセージの読み方**

`runRembgToFile` は全候補を試して最後のエラーで上書きするため、実際の原因が隠れやすい。
`コマンドが見つかりません: python` というエラーが出ても、本当の原因は手前の候補の stderr にある場合が多い（onnxruntime 不在、CLI 依存不足、numba クラッシュなど）。

**確認手順**

```sh
# インストール済み .app の venv から直接テスト（cwd は /tmp など、プロジェクトルート以外で実行）
cd /tmp
VENV="/Applications/漫画野郎.app/Contents/Resources/rembg/venv"
"$VENV/bin/python3" /Applications/漫画野郎.app/Contents/Resources/rembg/invoke-rembg.py \
  i -m isnet-anime /path/to/test.png /tmp/out.png
```

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

*最終更新: リポジトリの現行コードに基づく（素材 D&D 座標・EXIF、グレー明るさ、rembg 同梱・publish 方針を反映）*
