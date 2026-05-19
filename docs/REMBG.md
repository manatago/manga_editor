# rembg 同梱の仕組み

漫画野郎は AI 背景除去 (rembg) を**配布版に同梱**しているため、ユーザー側で Python のインストールは不要です。このドキュメントはその同梱の仕組み・過去のバグ・配布前のチェックリスト・トラブルシューティングを扱います。

---

## 1. 基本構成

- **AI ライブラリ**: [rembg](https://github.com/danielgatis/rembg) (`pip install rembg[cpu]`)
- **モデル**: `isnet-anime`（アニメ調イラスト向け、初回実行時に HuggingFace から自動 DL）
- **Python ランタイム**: [astral-sh/python-build-standalone](https://github.com/astral-sh/python-build-standalone) の **install_only** ビルド（CPython 3.11、relocatable）
- **呼び出し方法**: メインプロセスから `child_process.spawn` で同梱 Python に `invoke-rembg.py` を渡して実行

## 2. ファイル構成

```
mangas/
├─ scripts/
│  └─ bundle-rembg.mjs                ← python-build-standalone を DL・展開し rembg を pip install
├─ resources/
│  └─ bundled-rembg/
│     ├─ invoke-rembg.py              ← Python 側エントリ（rembg.new_session + rembg.remove を直接呼ぶ）
│     └─ <os>-<arch>/
│        ├─ python/                   ← bundle-rembg が生成（.gitignore）
│        │  ├─ bin/python3            ← 自己完結バイナリ
│        │  ├─ lib/libpython3.11.dylib
│        │  ├─ lib/python3.11/site-packages/{rembg, onnxruntime, ...}
│        │  └─ ...
│        ├─ invoke-rembg.py           ← bundle-rembg がコピー（.gitignore）
│        └─ rembg                     ← シェルラッパー（任意・互換のため残す）
└─ src/main/
   └─ rembgRunner.ts                  ← Electron main から spawn する候補を組み立てて実行
```

電子バンドラー設定（`package.json`）:

```json
"extraResources": [
  {
    "from": "resources/bundled-rembg/${os}-${arch}",
    "to": "rembg",
    "filter": ["**/*"]
  }
]
```

→ `Contents/Resources/rembg/python/...` に同梱される。

## 3. ビルド〜配布のフロー

```sh
npm run dist:with-rembg
```

これは次の 3 段階を順に実行します:

1. **`npm run bundle-rembg`**
   - `scripts/bundle-rembg.mjs` を実行
   - GitHub Releases から `cpython-3.11.15+20260510-<triple>-install_only.tar.gz` を DL
   - `resources/bundled-rembg/<os>-<arch>/python/` に展開
   - その `python/bin/python3` に対し `pip install --upgrade pip wheel` と `pip install rembg[cpu]`
   - `resources/bundled-rembg/invoke-rembg.py` を `<os>-<arch>/` にコピー
2. **`electron-vite build`**
3. **`electron-builder`** が `extraResources` で同梱した DMG を作る

完成物は `dist/` 配下に出ます。

### Python バージョン / リリース固定

`scripts/bundle-rembg.mjs` 内で:

```js
const PBS_RELEASE = process.env.PBS_RELEASE || '20260510'
const PBS_PY_VERSION = process.env.PBS_PY_VERSION || '3.11.15'
```

CI で固定したい場合は環境変数で上書きできます。新しい Python バージョンに上げるときは:

1. `PBS_RELEASE` を新しい日付タグに変更
2. `PBS_PY_VERSION` を 3.11.x の最新に変更
3. ローカルで `npm run bundle-rembg` → スモークテスト（[§6](#6-スモークテスト)）

---

## 4. なぜ python-build-standalone を使うのか（過去のバグ）

### ❌ 旧方式: `python3 -m venv --copies`

- ビルド機のシステム Python に依存して venv を作っていた
- venv の `bin/python3` は `--copies` でも**ビルド機の libpython を絶対パスでリンク**:
  - `otool -L` で `/Library/Frameworks/Python.framework/Versions/3.11/Python` に依存
  - 標準ライブラリも `home` 設定で `/Library/Frameworks/...` を参照
- 配布先 Mac に python.org の Python 3.11 が**入っていないと dyld エラーで起動不可**

### ✅ 現方式: python-build-standalone

- Astral が配布している relocatable な CPython ビルドを丸ごと同梱
- `bin/python3` は `@rpath/libpython3.11.dylib` 参照（自己完結）
- システム dylib（`/usr/lib/libSystem.B.dylib` 等）以外への外部依存なし
- どの Mac でも展開すればそのまま動く

### ❌ 旧方式の遺物

- `resources/bundled-rembg/<os>-<arch>/venv/` ディレクトリが残っていたらゴミ。`bundle-rembg` 実行時に自動削除される
- `src/main/rembgRunner.ts` は旧 venv 構造も fallback で見るが、新ビルドでは使われない

---

## 5. ハマりやすい注意点

### 5.1 `rembg[cli]` は入れない

- `typer` / `click` / `gradio` などの巨大 CLI 依存が引き込まれる
- 同梱漏れで起動時にエラー
- **正しい**: `pip install rembg[cpu]`（onnxruntime も入る）

### 5.2 `rembg.cli` 経由禁止

- `invoke-rembg.py` は `from rembg import remove, new_session` を**直接呼ぶ**
- CLI extras 無しで動く最小経路

### 5.3 `spawn` の `cwd` は必ず `os.tmpdir()`

`src/main/rembgRunner.ts` 参照:

```ts
const child = spawn(command, args, {
    cwd: os.tmpdir(),  // ← プロジェクトルート禁止
    ...
})
```

理由: プロジェクトルートには `coverage/` ディレクトリ（vitest coverage 出力）がある場合があり、Python は CWD を sys.path 先頭に置く。結果 `coverage/` が PEP 420 namespace package として `coverage` モジュールとして拾われ、`numba.misc.coverage_support` が `coverage.types.Tracer` を import しようとして `AttributeError` でクラッシュする。

### 5.4 venv の `bin/rembg` shebang は壊れる

- shebang `#!/path/to/python` がビルド機の絶対パスになる
- .app に同梱しても、Mac に同じパスが無ければ動かない
- **対策**: `python3 invoke-rembg.py` 経由で呼ぶ（shebang を経由しない）
- `rembgRunner.ts` の `bundledRembgCandidates` はこの方式を優先

### 5.5 candidate チェーンのエラーメッセージは紛らわしい

`runRembgToFile` は複数候補を順に試し、**最後のエラーで上書き**するため、`コマンドが見つかりません: python` と出ても本当の原因が前の候補にあることが多い。

**デバッグ手順**: `runSpawn` の `stderr` をログに残すか、後述のスモークテストで個別の候補を試す。

---

## 6. スモークテスト

### 6.1 開発環境

```sh
# bundle-rembg 実行後
cd /tmp
/Users/<you>/mangas/resources/bundled-rembg/mac-arm64/python/bin/python3 \
  /Users/<you>/mangas/resources/bundled-rembg/mac-arm64/invoke-rembg.py \
  i -m isnet-anime /path/to/test.png /tmp/out.png

ls -la /tmp/out.png   # 生成されていれば OK
```

### 6.2 配布版 .app

```sh
cd /tmp
APP="/Applications/漫画野郎.app/Contents/Resources/rembg"
"$APP/python/bin/python3" "$APP/invoke-rembg.py" \
  i -m isnet-anime /path/to/test.png /tmp/out.png
```

### 6.3 依存だけ確認

```sh
cd /tmp
"$APP/python/bin/python3" -c "
from rembg import remove, new_session
import numpy, onnxruntime
print('rembg OK')
print('numpy:', numpy.__version__)
print('onnxruntime:', onnxruntime.__version__)
"
```

---

## 7. 別 Mac での動作確認

新しい DMG をビルドしたら、開発機**以外**の Mac で次を確認:

1. DMG を開いて `/Applications` にコピー
2. `漫画野郎.app` を起動
3. 簡単なプロジェクトを作り、参照キャラ画像を 1 枚登録
4. 「背景除去」ボタン → `<元>_nobg.png` が生成されることを確認

うまく動かない場合は配布先 Mac のターミナルで [§6.2](#62-配布版-app) のコマンドを実行 → stderr で原因特定。

---

## 8. 環境変数（実行時）

`src/main/rembgRunner.ts` が見る環境変数:

| 変数 | 用途 |
| --- | --- |
| `MANGAS_REMBG` | rembg 実行ファイルの絶対パスを明示（最優先） |
| `MANGAS_SKIP_BUNDLED_REMBG=1` | 同梱版を使わず PATH の rembg を使う |
| `MANGAS_USE_BUNDLED_REMBG=1` | 開発時も同梱ディレクトリを使う |
| `MANGAS_REMBG_MODEL` | モデル名（既定 `isnet-anime`） |

---

## 9. コード署名 / Notarize（未対応）

現状の DMG ビルドは ad-hoc 署名のみ。本格的に Apple 公証 (notarize) を通す場合は、同梱した `python/bin/*` や `lib/*.dylib` も含めて hardened runtime + Developer ID で再署名する必要があります。`afterPack` フックで再帰的に `codesign --deep` をかけるのが定番ですが、本リポジトリではまだ未対応です。

---

## 10. トラブルシューティング

| 症状 | 原因 / 対処 |
| --- | --- |
| `dyld[xxx]: Library not loaded: /Library/Frameworks/Python.framework/...` | 旧 venv 同梱版でビルドされている。最新コードで `npm run dist:with-rembg` し直す |
| `No onnxruntime backend found` | `rembg[cpu]` ではなく `rembg` 単体を入れた。`bundle-rembg` を再実行 |
| `ModuleNotFoundError: No module named 'typer'` | 旧 `rembg[cli]` 経由で起動している。`invoke-rembg.py` 経由になっているか rembgRunner を確認 |
| `AttributeError: module 'coverage' has no attribute 'types'` | CWD がプロジェクトルートになっている。`spawn` の `cwd` を `os.tmpdir()` に |
| `rembg が 600 秒以内に終了しませんでした` | 初回モデル DL が遅い or ネットワーク不調。手動で `~/.u2net/` 配下のキャッシュを確認 |
| 配布先 Mac で「開けません」(Gatekeeper) | 未公証配布のため。Finder で右クリック →「開く」、または System Settings → Privacy & Security から許可 |

---

## 11. 参考リンク

- rembg: https://github.com/danielgatis/rembg
- isnet-anime モデル: https://huggingface.co/danielgatis/rembg
- python-build-standalone: https://github.com/astral-sh/python-build-standalone
- electron-builder extraResources: https://www.electron.build/configuration/contents#extraresources

---

*このドキュメントは過去のバグから得た知見を保存することが主目的です。rembg まわりに触る前に必ず一読してください。*
