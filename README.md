# 漫画野郎（mangas）

ローカルで動作するデスクトップ漫画エディタ。コマ割り・吹き出し・スクリーントーン・素材・AI 背景除去・AI 画像生成（NovelAI）まで、漫画ページ制作に必要な要素をひとつのアプリで完結させる。

- **対応 OS**: macOS（Apple Silicon / Intel）
- **保存形式**: フォルダ単位（`manga.json` ＋ `assets/`）。クラウド非依存
- **ライセンス**: ISC

> このリポジトリのトップドキュメントは本 `README.md` です。詳しい操作・開発者向け情報・rembg／NovelAI まわりは `docs/` 配下と `.spec/manga-editor.md` を参照してください。

---

## 目次

1. [何ができるか](#1-何ができるか)
2. [動作環境](#2-動作環境)
3. [配布版を使う（DMG）](#3-配布版を使うdmg)
4. [開発版のセットアップ](#4-開発版のセットアップ)
5. [クイックスタート](#5-クイックスタート)
6. [画面構成](#6-画面構成)
7. [キーボードショートカット](#7-キーボードショートカット)
8. [プロジェクトフォルダの構造](#8-プロジェクトフォルダの構造)
9. [ビルド・配布](#9-ビルド配布)
10. [テスト](#10-テスト)
11. [ドキュメント一覧](#11-ドキュメント一覧)
12. [AI/エージェント向け簡易ガイド](#12-aiエージェント向け簡易ガイド)
13. [FAQ／トラブルシューティング](#13-faqトラブルシューティング)

---

## 1. 何ができるか

### コマ割り（パネル）

- 7 形状: 矩形 / 斜め矩形 / 横向き台形 / 縦向き台形 / 五角形 / 六角形 / 円
- 形状調整パラメータ（斜め角、台形オフセット、回転）
- リサイズ・回転（コマは右サイドバーの回転スライダー）
- グリッド吸着、辺の自動整列ガイド、斜辺の平行ガイド
- 前後関係（最前面・最背面・前へ・後ろへ）
- コマ単位の背景色・グラデーション・背景画像

### コマの画像処理

- 画像ドロップで背景画像化（2 枚目以降は素材として追加）
- グレースケール（明るさ −0.5〜+0.5 調整）
- 左右反転、画像移動・拡大縮小・回転（Shift オーバーレイで直感操作）
- フェードアウト（8 方向の複数選択 + 強さ）
- 集中線、雨エフェクト、ぼかし
- **モザイク**（4 種類: 12px ピクセル / 摺りガラス / 白塗り / 透明）。楕円フェザリング、領域ごとに種類を保持

### 吹き出し

- 8 種類: 角丸 / ギザギザ / 矩形 / フラッシュ / シャウト / 角ギザ / メガホン / 二重矩形
- 縦書き／横書き、行間・字間、太さ 3 段階、縁取り、掠れ、回転、しっぽ操作
- **自動フィット**: 「文字を縮める（shrink-font）」「枠を広げる（expand-bubble）」「手動（off）」
  - 手動でリサイズすると自動で `off` に切替
- **コマ内クリップ表示**: 吹き出しをコマの形状でくり抜く
- 吹き出しタイプごとの最終スタイル記憶（次回作成時に自動適用）

### 素材

- 画像をコマ外に貼る／コマ内クリップして貼る
- グレースケール（明るさ調整）、白飛び除去（Alpha Threshold）

### スクリーントーン

- **内蔵トーン**カタログ
- **カスタムトーン**（アプリ全体共有・透過 PNG をドロップで登録）
- **マイ画像**（プロジェクト固有の背景画像ライブラリ）
- 適用先: ページ全体 / コマ背景（人物画像の下）/ コマ前面（人物画像の上）
- 不透明度・スケール・回転・ぼかし・XY 移動・フェード（8 方向 + 強さ）

### AI 連携

- **rembg（背景除去）** — `isnet-anime` モデル。アプリに Python ランタイムを同梱しているのでユーザー側で Python の追加インストール不要。詳細 → [docs/REMBG.md](docs/REMBG.md)
- **マジックワンド** — クリックで近似色領域を透過化（許容差調整可、フラッドフィル）
- **NovelAI 連携** — API トークンを暗号化保存し、コマ単位でプロンプト・参照キャラ・精密参照を設定して画像生成。詳細 → [docs/NOVELAI.md](docs/NOVELAI.md)

### 制作支援

- **原稿メモ**（manuscript）— プロジェクト全体の原稿を Markdown 風に書き、選択中の文字列を吹き出し追加と同時に転記
- **参照キャラクター**管理（名前・プロンプト・参照画像群）
- **背景ライブラリ**（自作背景画像の使い回し）
- **テンプレート**（ページレイアウトを保存・呼び出し）

### 入出力

- ページごとに PNG エクスポート、全ページ一括 PNG
- セリフを TXT で書き出し
- アセット整理（未使用ファイルを `assets/dust/` に退避、削除はしない）

### その他

- **自動保存**: 編集から 1 秒デバウンス、ページ切替時、終了直前の同期 flush
- **Undo/Redo**: 最大 100 件、選択 ID もクリアされる
- **コピー&ペースト**: 吹き出し・コマ単位
- **コマの 1px 移動**: Shift + 矢印キー（スナップ・自動フィット無し）

---

## 2. 動作環境

| 用途 | 必要なもの |
| --- | --- |
| 配布版 DMG を使う | macOS 12 以降（Apple Silicon / Intel）。Python のインストールは**不要**（同梱されています） |
| 開発・自前ビルド | Node.js 20.x 以上 / npm。`dist:with-rembg` を回すなら Python 3.11 と `python3 -m venv` が使える環境（ビルド機のみ。配布先には不要） |

### 依存ランタイム

- Electron 40
- React 19 + TypeScript 5.9
- Konva 10 / react-konva 19
- Zustand 5
- Tailwind CSS 4
- electron-vite 5 / electron-builder 26
- Vitest 4

詳細は `package.json` を参照。

---

## 3. 配布版を使う（DMG）

1. リリース DMG をマウントし、`漫画野郎.app` を `/Applications` にドラッグ
2. 初回起動時に Gatekeeper の警告が出たら、Finder で `.app` を右クリック → 「開く」（自家配布の場合）
3. 起動 → 左サイドバーの「新規プロジェクト」または「プロジェクトを開く」
4. 作成先フォルダを選ぶと、その下に `<プロジェクト名>/manga.json` と `assets/` が生成される

> **AI 機能を使うには:**
> - 背景除去（rembg）: 配布版 DMG なら追加設定不要（同梱済み）
> - NovelAI 画像生成: 起動後にメニューから NovelAI トークンを設定 → [docs/NOVELAI.md](docs/NOVELAI.md)

---

## 4. 開発版のセットアップ

```sh
git clone <repo-url> mangas
cd mangas
npm install

# 開発起動
npm run dev
```

### スクリプト一覧

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発モード起動（HMR） |
| `npm run build` | 型チェック＋ビルド（実行ファイルは作らない） |
| `npm run preview` / `start` | ビルド済みをプレビュー |
| `npm run pack` | `electron-builder --dir`。`.app` だけ作って DMG は作らない |
| `npm run dist` | DMG 配布物を作成（rembg 同梱**なし**） |
| `npm run bundle-rembg` | rembg 用 Python ランタイム（python-build-standalone）と rembg を `resources/bundled-rembg/<os>-<arch>/python/` に展開する |
| `npm run dist:with-rembg` | `bundle-rembg` → build → DMG。**配布する DMG はこちらを使う** |
| `npm run test` | Vitest 実行（80 件超） |

詳細は [docs/REMBG.md](docs/REMBG.md) と [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。

---

## 5. クイックスタート

### 5.1 新規プロジェクトを作る

1. 起動 → 左サイドバー「新規プロジェクト」
2. 作成先フォルダ＋プロジェクト名を入力
3. 生成された `<名前>/` フォルダが開かれ、空のページ 001 が現れる

### 5.2 コマを並べる

1. 上部ツールバーから「コマ追加」（矩形・斜め・台形・五角形・六角形・円）
2. ドラッグでサイズ調整、グリッド ON（右サイドバー）で吸着
3. 形状調整・回転は右サイドバー「コマ」プロパティ

### 5.3 画像を入れる

- 画像をコマの上にドロップ → そのコマの**背景画像**になる
- すでに画像があるコマや、別画像を重ねたい場合 → **素材**として追加
- コマ選択中に **Shift キーを押下** → コマ上に画像編集タブが出る（移動・拡大縮小・回転・グレースケール・反転）

### 5.4 吹き出しを追加する

1. 配置したいコマを選択
2. 上部ツールバーから吹き出し種類を選んでクリック → コマ中央に追加
3. ダブルクリックでテキスト編集
4. 右サイドバー「吹き出し」プロパティで自動フィット切替・縦横書き・縁取り・しっぽ操作

> **原稿メモ連携**: 下部の「原稿」パネルにあらかじめ書いた台詞を**選択した状態**で吹き出し追加すると、その文字列が初期テキストになり、原稿側からは削除される。

### 5.5 背景除去（AI）

1. 参照キャラクターモーダル等でキャラ画像を選択
2. **はさみアイコン** → マジックワンドエディタでクリック透過、または右クリック等のメニューから rembg 実行
3. 出力は元と同フォルダに `<元の名前>_nobg.png` として保存

### 5.6 ページを増やす・PNG で書き出す

- 左サイドバーの「ページ」リストから追加・並べ替え・削除
- 左サイドバー「ツール」展開 → 「現在のページを PNG」「全ページ一括 PNG」
- 書き出し先は `<プロジェクト>/exports/<ページ名>.png`（例 `001.png`）

詳細な操作は [docs/USAGE.md](docs/USAGE.md) を参照。

---

## 6. 画面構成

```
+--------------------------------------------------------------------------+
| 上部ツールバー: コマ形状追加 | 吹き出し種類追加（コマ選択時のみ有効）   |
+------------+-------------------------------------------+-----------------+
|            |                                           |                 |
| 左サイド    |   中央キャンバス（Konva Stage）           |   右サイド      |
| バー       |   （ページごとに 840×1188 など可変）      |   バー         |
|            |                                           |                 |
| - 新規/開く |                                           | - ページ        |
| - ツール   |                                           | - コマ          |
|   ▸ PNG   |                                           | - 吹き出し      |
|   ▸ TXT   |                                           | - 素材          |
|   ▸ 参照キャ|                                           |                 |
|     ラ     |                                           |  (選択対象で    |
|   ▸ 背景   |                                           |   切替)         |
|     ライブ |                                           |                 |
|     ラリ   |                                           |                 |
|   ▸ 合成   |                                           |                 |
| - モザイク |                                           |                 |
| - ページ一覧|                                           |                 |
| - Assets   |                                           |                 |
+------------+-------------------------------------------+-----------------+
|              原稿メモパネル（折りたたみ可）                              |
+--------------------------------------------------------------------------+
```

- **左サイドバー**: プロジェクト管理 + ツール群 + ページ一覧 + アセット整理
- **中央**: Konva キャンバス。グリッド ON でスナップ
- **右サイドバー**: 選択中オブジェクト（ページ / コマ / 吹き出し / 素材）のプロパティ
- **下部「原稿」パネル**: 開閉式、プロジェクト全体の原稿メモ

---

## 7. キーボードショートカット

> 入力欄（input / textarea / contentEditable）にフォーカスしている間は無効。

| キー | 動作 |
| --- | --- |
| `Cmd/Ctrl + S` | プロジェクト保存（通常は自動保存されるので明示する必要は少ない） |
| `Cmd/Ctrl + Z` | 元に戻す |
| `Cmd/Ctrl + Shift + Z` / `Cmd/Ctrl + Y` | やり直し |
| `Cmd/Ctrl + C` | 選択中の吹き出し or コマをコピー |
| `Cmd/Ctrl + V` | コピー済みを貼り付け（最後にコピーした方が貼られる） |
| `Backspace` / `Delete` | コマ選択時: 画像があれば画像クリア／なければコマ削除。吹き出し・素材は削除 |
| `Shift + ←↑→↓` | 選択中のコマを **1px 単位**で移動（スナップ・自動フィット無し） |
| `Shift + ドラッグ`（吹き出し選択時） | 吹き出し本体は動かさず、テキストの相対オフセット（`textOffsetX / Y`）を更新 |
| `Shift` 押下（コマ選択時） | コマ上に画像編集タブを表示（移動・拡大縮小・回転モード切替） |

---

## 8. プロジェクトフォルダの構造

新規プロジェクト作成で以下が生成されます。

```
<プロジェクト名>/
├─ manga.json                 ← ページ・コマ・吹き出し・素材・参照キャラ・原稿メモ
├─ assets/
│  ├─ images/                 ← コマ背景・素材・D&D で取り込んだ画像、合成出力（composites/）
│  ├─ dust/                   ← 「未使用」と判定されたアセットの退避先（削除はしない）
│  ├─ references/             ← 参照キャラ・背景ライブラリ画像
│  │  ├─ characters/<charId>/
│  │  └─ backgrounds/
│  └─ composites/             ← 合成ツール出力
└─ exports/                   ← PNG / TXT エクスポート出力
```

- **`manga.json` 内の画像パスはすべてプロジェクトルートからの相対パス**（別フォルダにコピーしても開ける）
- 旧形式（絶対パスや `assets/workspace/...`）も読み込み時に自動正規化される
- 旧データを手作業で変換する場合は `scripts/convert-manga-json-to-relative-assets.mjs` と `scripts/migrate-assets-layout.mjs` を参照

データモデルの完全な型定義は [`src/renderer/src/store/types.ts`](src/renderer/src/store/types.ts) を見ること。

---

## 9. ビルド・配布

### 9.1 通常配布（rembg 同梱なし）

```sh
npm run dist
```

`dist/` に DMG が生成されます。AI 背景除去は使えませんが、それ以外の機能は動きます。

### 9.2 rembg 同梱版（推奨）

```sh
npm run dist:with-rembg
```

このスクリプトは以下を順に実行します:

1. `scripts/bundle-rembg.mjs`
   - [astral-sh/python-build-standalone](https://github.com/astral-sh/python-build-standalone) から CPython 3.11 の **relocatable** な install_only tarball を DL
   - `resources/bundled-rembg/<os>-<arch>/python/` に展開
   - その Python に `pip install rembg[cpu]`
2. `electron-vite build`
3. `electron-builder`（`extraResources` で `Contents/Resources/rembg/` に同梱）

> **注意**: 以前は `python3 -m venv --copies` で venv を作成していましたが、venv の Python は**ビルド機の `/Library/Frameworks/Python.framework/...` に dyld リンクされる**ため、配布先 Mac で起動できないという既知バグがありました。**現在は python-build-standalone に移行済み**で、配布先に Python のインストールは不要です。詳しい経緯と再発防止は [docs/REMBG.md](docs/REMBG.md) を参照してください。

### 9.3 配布物のチェック

```sh
# 別 Mac に渡す前に、自分の環境のキャッシュなしで動くか確認
cd /tmp
"/Applications/漫画野郎.app/Contents/Resources/rembg/python/bin/python3" \
  /Applications/漫画野郎.app/Contents/Resources/rembg/invoke-rembg.py \
  i -m isnet-anime /path/to/test.png /tmp/out.png
```

エラーが出る場合は [docs/REMBG.md](docs/REMBG.md) のトラブルシューティングを参照。

---

## 10. テスト

```sh
npm run test                 # 全テスト（80 件超）
npx vitest run path/to/file  # 個別ファイル
npx tsc --noEmit             # 型チェック
```

主なテスト対象:
- `store/__tests__/useMangaStore.test.ts` — ストアの基本動作
- `store/__tests__/manuscriptSlice.test.ts` — 原稿メモ
- `utils/panelInsertion.test.ts` — コマ追加位置のロジック（過去の回帰防止）
- `utils/edgeAlignment.test.ts` — コマ整列ガイド
- `utils/panelAlignment.test.ts` — コマ整列
- `utils/gridUtils.test.ts` — グリッド吸着
- `utils/referenceCharacters.test.ts` — 参照キャラ
- `main/ipcGuards.test.ts` — IPC payload バリデーション

---

## 11. ドキュメント一覧

| ドキュメント | 内容 |
| --- | --- |
| **[README.md](README.md)** | このファイル。トップエントリ |
| [docs/USAGE.md](docs/USAGE.md) | 操作ガイドの詳細版（モーダル・ツール毎の使い方） |
| [docs/REMBG.md](docs/REMBG.md) | rembg 同梱の仕組み・配布上の注意・過去のバグ |
| [docs/NOVELAI.md](docs/NOVELAI.md) | NovelAI 連携の設定・コスト・参照画像の扱い |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | 開発者向け（コード規約・スライス追加方法・AI コーディング向けの注意点） |
| [.spec/manga-editor.md](.spec/manga-editor.md) | コードから抽出した**現状の技術仕様書**（型・IPC・描画順・吹き出しクラスター等） |

---

## 12. AI/エージェント向け簡易ガイド

このリポジトリで作業する AI エージェント（Claude Code 等）向けの最短手順。

### 12.1 まず読むファイル

1. このファイル（README.md）
2. [.spec/manga-editor.md](.spec/manga-editor.md) — 現状の完全な技術仕様
3. [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — 規約と落とし穴

### 12.2 アーキテクチャの 1 分要約

- **プロセス分担**: main（ファイル I/O・IPC・rembg/NovelAI サブプロセス） / preload（`contextBridge` で `window.electron` 公開） / renderer（React + Konva + Zustand）
- **ストアはスライス**で分割（`src/renderer/src/store/slices/*.ts`）。`useMangaStore.ts` は単に結合するだけで**ロジックを書かない**
- **画像参照は `local-file://` カスタムプロトコル**。`window.electron.pathToUrl(path)` で生成
- **画像パスは相対**で `manga.json` に保存。表示時に `window.electron.resolveAssetPath` で絶対化
- **自動保存**は 1 秒デバウンス + 終了前 sync flush

### 12.3 よくある追加・変更パターン

| やりたいこと | 触る場所 |
| --- | --- |
| 新しいコマ形状を追加 | `store/types.ts` の `PanelType`、`components/PanelItem.tsx`、`components/PanelStrokes.tsx`、テンプレ UI |
| 新しい吹き出し形状 | `store/types.ts` の `BubbleType`、`components/BubbleItem.tsx`、`BUBBLE_TYPE_LABELS` |
| 新しいエフェクト | `components/effects/` に新ファイル、`PanelItem` から描画呼び出し |
| 新しい IPC | `src/main/ipc/<area>.ts` にハンドラ追加 → `src/preload/index.ts` で `contextBridge` 公開 → `src/renderer/src/env.d.ts` で型追加 |
| 新しいストア状態 | `store/slices/<name>Slice.ts` を作る → `useMangaStore.ts` の union と spread に追加 |
| 新しいモザイク種類 | `MosaicType` union 拡張、`MosaicItem.sceneFunc` 分岐追加、`SidebarLeft` ラベル追加 |

### 12.4 やってはいけないこと（過去のバグから）

- **rembg を venv で同梱**（ビルド機の Python に dyld リンクされ別 Mac で起動不可）→ 必ず python-build-standalone を使う
- **rembg 起動時の `cwd` をプロジェクトルートにする**（CWD の `coverage/` を Python が namespace package として誤 import → numba クラッシュ）→ `os.tmpdir()` を渡す
- **`useMangaStore.ts` 本体にロジックを書く** → スライスに書く
- **コンポーネントにグリッドスナップをローカル実装** → `utils/gridUtils.ts` の `snapToGrid` を使う
- **`!isExporting` ガードなしでグリッド線を描画** → エクスポート PNG にグリッドが焼き込まれる
- **クリップ吹き出しの座標計算で `rotation: 0` ハードコード** → 回転中の吹き出しのクリップがズレる。必ず `rotation: b.rotation || 0`
- **トーンを `fillPattern` + Konva Blur で描画** → 白化バグ。事前に CSS filter `blur()` を canvas で焼く（`hooks/useTonePattern.ts`）
- **テンプレ保存時に画像フィールドを含める** → テンプレが画像パス依存になる。`isGrayscale` 等とともに除外
- **`build.publish` を未設定** → CI が暗黙の GitHub publish を試して `GH_TOKEN` 不在で失敗。`null` を明示済み

詳しくは `.spec/manga-editor.md` §9〜§10 と [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) を参照。

---

## 13. FAQ／トラブルシューティング

### Q. 配布した DMG を他の Mac で開いたら「背景除去」がエラーになる

A. 古い venv 同梱版でビルドされている可能性があります。最新コードに更新し、`npm run dist:with-rembg` で再ビルドしてください。詳細 → [docs/REMBG.md](docs/REMBG.md)

### Q. ページを開いたら画像が表示されない

A. プロジェクトフォルダを別の場所にコピーしたが、`manga.json` 内のパスが古い絶対パスのまま残っている可能性があります。`scripts/convert-manga-json-to-relative-assets.mjs` で正規化できます。

### Q. NovelAI 機能が使えない

A. NovelAI のサブスクリプションと API トークンが必要です。トークン設定とコスト目安は [docs/NOVELAI.md](docs/NOVELAI.md)。

### Q. PNG にグリッド線が写り込んでいる

A. グリッド線描画箇所で `!isExporting` ガードが抜けています（既知の落とし穴）。該当コンポーネントにガードを追加してください。

### Q. テンプレを呼び出したら画像も復元されない

A. 仕様です。テンプレートは画像パスを保存しません（プロジェクト間の再利用性のため）。

### Q. ページサイズを変えたい

A. 右サイドバーのページプロパティから `pageWidth` / `pageHeight` を変更可能。デフォルトは 840×1188。

### Q. ショートカットがどれも効かない

A. 入力欄にフォーカスが残っている可能性があります。一度キャンバスをクリックしてフォーカスを外してください。

---

*この README は `package.json`、`src/`、`.spec/manga-editor.md` の現状から書き起こしたものです。コードと食い違いがあれば実装が正です。*
