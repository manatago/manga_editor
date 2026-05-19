# 開発ガイド

漫画野郎のコードに変更を加える人（人間 / AI エージェント）向けのガイド。

> このドキュメントは「どう書くか」の規約と落とし穴に焦点を当てます。
> **データモデルや IPC の網羅的な仕様**は [../.spec/manga-editor.md](../.spec/manga-editor.md) を、画面操作は [USAGE.md](USAGE.md) を参照してください。

---

## 1. 開発開始

```sh
npm install
npm run dev          # HMR で起動
```

別ターミナルで:

```sh
npx tsc --noEmit     # 型チェック
npm run test         # vitest 全実行
npx vitest --watch   # 編集対象だけ watch
```

---

## 2. プロセスとレイヤー

```
+----------------------+      +----------------------+      +----------------------+
| main (Node)          | IPC  | preload              | DOM  | renderer (React)     |
| - ファイル I/O       |<---->| contextBridge        |----->| - UI                 |
| - rembg / NovelAI    |      | window.electron.*    |      | - Zustand            |
| - local-file protocol|      |                      |      | - Konva 描画          |
+----------------------+      +----------------------+      +----------------------+
```

- **main**: `src/main/`
  - `index.ts`: ウィンドウ作成、IPC ハンドラ登録、protocol 登録
  - `ipc/*.ts`: 機能別 IPC ハンドラ（`dialogs`, `files`, `project`, `templates`, `export`, `customTones`, `rembg`, `novelai`）
  - `ipcGuards.ts`: 入力 payload バリデーション
  - `rembgRunner.ts`: rembg サブプロセス起動ラッパー
  - `assetsLayoutRoot.ts`: アセットフォルダ名の定数
- **preload**: `src/preload/index.ts`
  - `contextBridge.exposeInMainWorld('electron', { ... })`
  - 型は `src/renderer/src/env.d.ts` に `declare global` で
- **renderer**: `src/renderer/src/`
  - `App.tsx`: 画面骨格
  - `components/`: UI コンポーネント
  - `store/`: Zustand（スライスパターン）
  - `hooks/`: 共有 hook
  - `utils/`: 純粋関数ユーティリティ

---

## 3. ストア（Zustand スライスパターン）

### 3.1 構成

`useMangaStore.ts` は **結合だけ**:

```ts
export type MangaState =
    HistorySlice & PageSlice & PanelSlice & BubbleSlice &
    MaterialSlice & ProjectSlice & ReferenceSlice &
    BackgroundLibrarySlice & MosaicSlice & CustomTonesSlice &
    NovelAISlice & AlignmentSlice & ManuscriptSlice

export const useMangaStore = create<MangaState>()((...a) => ({
    ...createHistorySlice(...a),
    ...createPageSlice(...a),
    ...
}))
```

**ロジックは絶対にここに書かない**。各スライス（`store/slices/*.ts`）に書く。

### 3.2 新しいスライスを追加する手順

1. `store/slices/<name>Slice.ts` を作成

   ```ts
   import type { StateCreator } from 'zustand'
   import type { MangaState } from '../useMangaStore'

   export interface FooSlice {
       fooValue: number
       setFooValue: (n: number) => void
   }

   export const createFooSlice: StateCreator<MangaState, [], [], FooSlice> = (set) => ({
       fooValue: 0,
       setFooValue: (n) => set({ fooValue: n })
   })
   ```

2. `useMangaStore.ts` の union と spread に追加
3. 永続化が必要なら `store/types.ts` の `MangaProjectData` にフィールドを足し、`projectSlice` の `getProjectData` / `setProjectData` で読み書き
4. テストを `store/__tests__/` に追加

### 3.3 履歴対応

`saveHistory(state)` を呼んでから `set` する。詳細は `store/helpers.ts`。
**`updatePanel(id, updates, undoable?)` のように `undoable` フラグを持つアクション**もあり、ドラッグ中は `false`、確定時は `true` にする運用。

---

## 4. IPC を追加する

### 4.1 main 側

`src/main/ipc/<area>.ts` を新規 or 既存ファイルに追加:

```ts
import { ipcMain } from 'electron'
import { parseFooPayload } from '../ipcGuards'

export function registerFooHandlers(): void {
    ipcMain.handle('foo:do-thing', async (_e, payload) => {
        const { x, y } = parseFooPayload(payload)
        // ...
        return { ok: true }
    })
}
```

`src/main/index.ts` で `registerFooHandlers()` を呼ぶ。

### 4.2 入力検証（必須）

`src/main/ipcGuards.ts` に検証関数を書く。受け取った任意の JSON を信用しない。

### 4.3 preload 側

```ts
contextBridge.exposeInMainWorld('electron', {
    // ...既存
    fooDoThing: (x: number, y: number) => ipcRenderer.invoke('foo:do-thing', { x, y })
})
```

### 4.4 型

`src/renderer/src/env.d.ts` の `Window.electron` 型に追加:

```ts
fooDoThing: (x: number, y: number) => Promise<{ ok: boolean }>
```

### 4.5 セキュリティ

- 受け取ったパスは `path.resolve` でからプロジェクトフォルダ配下チェック
- `src/main/rembgRunner.ts` の `isResolvedPathInsideDir` を参考に
- 拡張子・MIME チェック（`save-composite-png` 等）

---

## 5. 画像の扱い

### 5.1 パス保存

- `manga.json` に保存する画像パスは**プロジェクトルートからの相対パス**（例: `assets/images/foo.png`）
- 別フォルダにコピー / Mac 間で受け渡しできるようにするため
- 表示時は `window.electron.resolveAssetPath(projectRoot, stored)` で絶対パスに解決し、`window.electron.pathToUrl(absPath)` で `local-file://...` URL に

### 5.2 旧データ互換

- `resolveAssetPath` は旧レイアウト（絶対パス / `assets/workspace/...` / 直下 PNG / 旧 `_trash`）も fallback で解決
- 旧データを読み込んだ時は `setProjectData` 内で相対パスに正規化される
- 手動変換: `scripts/convert-manga-json-to-relative-assets.mjs`
- フォルダ構成移行: `scripts/migrate-assets-layout.mjs`

### 5.3 ドロップ取り込み

- `getPathForFile`（Electron `webUtils`）を**優先**して取得（フォーマット間で安定）
- `createImageBitmap(file, { imageOrientation: 'from-image' })` で EXIF 回転を考慮した縦横比
- Konva の `setPointersPositions(e.nativeEvent)` + `getPointerPosition()` でドロップ位置を確定（手計算 `clientX - rect` は表示スケールでズレる）

---

## 6. Konva 描画の落とし穴

### 6.1 描画順

```
1. ページ背景
2. 各コマ:
   パネル内容 → エフェクト → コマ内クリップの吹き出し（クラスター描画） →
   コマ内クリップ素材 → ストローク
3. 孤立クリップ吹き出し / 素材
4. コマ外の吹き出し・素材
5. インタラクション層（Transformer 等、エクスポート時は隠す）
```

### 6.2 `isExporting` ガード

エクスポート中はグリッド線・整列ガイド・Transformer などを**非表示**にする。

```tsx
{!isExporting && <GridLines ... />}
```

これを忘れると PNG にグリッドが焼き込まれる（既知バグ）。

### 6.3 クリップ座標は `getClippedPoints` に一元化

`components/utils/geometry.ts` の `getClippedPoints` を使う。
変換ステップ:
1. パネルローカル → ステージ（`panel.rotation` を適用）
2. ステージ → アイテム相対（`(item.x, item.y)` を引く）
3. アイテム相対 → アイテムローカル（`-item.rotation` を逆適用）

`getVisualClusters` 等で `rotation: 0` をハードコードすると回転中のクリップがズレる。**必ず `rotation: b.rotation || 0`** を渡す。

### 6.4 トーン描画はぼかしを先に焼く

- `fillPattern` + Konva Blur は**白化バグ**を起こす
- 代わりに canvas に `ctx.filter = 'blur(Xpx)'` で**事前にぼかして**焼き、その canvas をパターンとして使う
- 実装は `hooks/useTonePattern.ts` に一元化されているので、各コンポーネントにローカル実装しない

### 6.5 フラッシュ吹き出しの背景色

- `drawFlashPath` は `moveTo / lineTo` のみで閉じパスを持たないため通常の `fill` は使えない
- 代わりに楕円 Shape にラジアルグラジエントで `backgroundColor → transparent` を全方位に塗る

### 6.6 グリッドスナップは `snapToGrid`

`utils/gridUtils.ts` の `snapToGrid(value, page)` を必ず使う。各コンポーネントにローカルで実装しない。

### 6.7 モザイクレイヤーは最上位

`sceneFunc` で `getImageData` してコマピクセルを読み取るため、interaction layer より**後**に描画。順序を変えるとモザイクが消える既知バグの原因になる。

---

## 7. 自動保存

- `useMangaStore` の `pages` / `currentProjectPath` 変更を監視
- 1 秒デバウンスで `saveProject` を呼ぶ
- ページ切替時にも保存
- 終了直前 (`beforeunload`) は同期 IPC `save-project-sync` で flush

新しい永続化フィールドを追加した場合は **`autosave` の依存配列に追加**（`App.tsx`）。

---

## 8. テスト

### 8.1 既存テスト

| ファイル | 内容 |
| --- | --- |
| `store/__tests__/useMangaStore.test.ts` | ストアの基本動作 |
| `store/__tests__/manuscriptSlice.test.ts` | 原稿メモ |
| `utils/panelInsertion.test.ts` | コマ追加位置（回帰防止） |
| `utils/edgeAlignment.test.ts` | 整列ガイド |
| `utils/panelAlignment.test.ts` | 整列 |
| `utils/gridUtils.test.ts` | グリッド吸着 |
| `utils/referenceCharacters.test.ts` | 参照キャラ |
| `main/ipcGuards.test.ts` | IPC payload バリデーション |

### 8.2 新テスト追加の方針

- バグ修正したら**回帰テスト**を 1 つ書く（過去の値や挙動を expect で固定）
- 純粋関数は `utils/` に切り出してテスト可能にする（例: `panelInsertion` は元 `App.tsx` から切り出して 7 テスト追加した実績）
- React コンポーネントの結合テストは現状ほぼ無し。必要なら `@testing-library/react` + jsdom で追加

### 8.3 vitest の落とし穴

- `coverage` モジュールがプロジェクトルートに残ったままだと、外部 Python の import が壊れる（rembg 関連、[REMBG.md §5.3](REMBG.md#53-spawn-の-cwd-は必ず-ostmpdir)）

---

## 9. ビルドの注意

### 9.1 `build.publish: null` を維持

`package.json` の `build.publish` は **明示的に `null`** にしてある。
これを消すと CI 環境では `electron-builder` が暗黙的に GitHub publish を試み、`GH_TOKEN` 未設定でビルド失敗する。リリース公開する時は明示的に publish と token を設定する。

### 9.2 配布前チェックリスト

- [ ] `npx tsc --noEmit` で型エラーなし
- [ ] `npm run test` 全件 pass
- [ ] `npm run dist:with-rembg` 成功
- [ ] 別 Mac での起動 + 背景除去動作（[REMBG.md §7](REMBG.md#7-別-mac-での動作確認)）
- [ ] サンプルプロジェクトで PNG エクスポート確認

---

## 10. AI エージェント向け追加ガイド

このリポジトリで作業する Claude Code 等の AI エージェント向けの追加メモ。

### 10.1 最短キャッチアップ

1. README.md → このファイル → `.spec/manga-editor.md` の順に読む
2. 機能名でしか聞かれていない場合（「モザイク」「フェード」など）は `.spec/manga-editor.md` でキーワード grep
3. 新規追加なら本ファイル §3〜§4 のパターンに従う

### 10.2 触ってはいけない / 注意するファイル

- `store/useMangaStore.ts` ← ロジックを書き足さない（スライスへ）
- `package.json` の `build.publish: null` ← 消さない
- `scripts/bundle-rembg.mjs` ← rembg の同梱方式に戻したり venv 化したりしない（[REMBG.md §4](REMBG.md#4-なぜ-python-build-standalone-を使うのか過去のバグ)）
- `src/main/rembgRunner.ts` の `cwd: os.tmpdir()` ← 変えない（namba クラッシュ）

### 10.3 デバッグ tips

- console.error / console.warn は IPC でメインに転送されターミナルに色付き表示される（`src/main/index.ts` の `renderer-log` ハンドラ）。renderer で `console.error` するとそのまま開発ターミナルで読める
- ストアの中身を見たければ `useMangaStore.getState()` を DevTools で叩く
- 自動保存が走っているかは上部の保存ステータス表示で確認

### 10.4 既知の落とし穴（要約）

| 領域 | 落とし穴 | 対処 |
| --- | --- | --- |
| rembg | venv 同梱で他 Mac 起動不可 | python-build-standalone を使う |
| rembg | CWD がプロジェクトルートで numba クラッシュ | `cwd: os.tmpdir()` |
| エクスポート | グリッド線が PNG に焼ける | `!isExporting` ガード |
| トーン | `fillPattern` + Konva Blur で白化 | 事前 canvas に CSS filter blur で焼く |
| クリップ吹き出し | `rotation: 0` ハードコード | `b.rotation || 0` |
| フラッシュ吹き出し | 通常の `fill` で塗れない | 楕円 + ラジアルグラジエント |
| 描画順 | モザイクが消える | モザイクレイヤーは interaction layer より後 |
| build | CI で publish 失敗 | `build.publish: null` を維持 |
| グリッド吸着 | 各所に重複実装 | `utils/gridUtils.ts` の `snapToGrid` を使う |

### 10.5 メモ作成ルール（auto memory）

Claude Code の auto memory を使う場合:

- リポジトリ内のコードから読み取れる情報（パス・関数名・スライス構成）は memory に**保存しない**
- 過去のバグの**理由**や**ユーザー固有の好み**は保存する（例: 「テストを追加する判断基準」「rembg の同梱は venv 不可」）
- 詳細ルールは `~/.claude/projects/-Users-satoshi-mangas/memory/` 配下を参照

---

## 11. リポジトリ内の参考スクリプト

| スクリプト | 用途 |
| --- | --- |
| `scripts/bundle-rembg.mjs` | rembg 同梱（python-build-standalone を DL） |
| `scripts/convert-manga-json-to-relative-assets.mjs` | 旧データの絶対パス → 相対パス変換 |
| `scripts/migrate-assets-layout.mjs` | 旧 `assets/workspace/...` レイアウトを新形式に移行 |

---

## 12. 関連ドキュメント

- 完全な技術仕様 → [../.spec/manga-editor.md](../.spec/manga-editor.md)
- 操作ガイド → [USAGE.md](USAGE.md)
- rembg 詳細 → [REMBG.md](REMBG.md)
- NovelAI 詳細 → [NOVELAI.md](NOVELAI.md)
