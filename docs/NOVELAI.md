# NovelAI 画像生成

漫画野郎は NovelAI Image Generation API を呼び出して、各コマに対して人物・シーン画像を生成できます。

---

## 1. 前提条件

- **NovelAI のサブスクリプション**: 画像生成には Opus / Scroll / Tablet いずれかのプランが必要（Opus 推奨）
- **API トークン (Bearer)**: NovelAI ウェブの「Account」→「Get Persistent API Token」から取得
- 公式 API ドキュメント: https://docs.novelai.net/image/

> このアプリは NovelAI 公式の API を呼び出すサードパーティクライアントです。利用は NovelAI の利用規約に従ってください。

---

## 2. トークンの設定

1. NovelAI ウェブでトークンを取得
2. 漫画野郎のメニュー or 設定モーダルから NovelAI Settings を開く
3. トークンを貼り付けて「保存」
4. 「接続テスト」を押すと残 Anlas や契約状態が表示される

### トークンの保存場所

- `app.getPath('userData')/novelai-token.enc`
- **Electron `safeStorage` で暗号化保存**（macOS は Keychain ベース）
- 暗号化ストレージが使えない環境では保存できずエラー（OS の暗号化サポートが必須）

### IPC

- `novelai:save-token`（空文字列で削除）
- `novelai:load-token`
- `novelai:clear-token`
- `novelai:test-connection`（残 Anlas / fixed / purchased / tier / active を返す）

---

## 3. 生成モーダル

コマを選択した状態でツールバーから「NovelAI 生成」を開く。

### モーダル構成

| セクション | 内容 |
| --- | --- |
| **アスペクト** | portrait (832×1216) / square (1024×1024) / landscape (1216×832) |
| **シチュエーション** | メインプロンプト |
| **補足** | 追加プロンプト（タグや表現の補足） |
| **ネガティブ上書き** | デフォルトのネガティブを上書きしたい場合のみ |
| **参照キャラ** | 最大 6 体、左→右の順に並ぶ |
| **精密参照 (vibe transfer)** | 最大 2 件、参照キャラ画像 or 合成画像 |
| **シード** | 固定 or ランダム |
| **履歴ギャラリー** | このコマで過去に生成した画像（ズーム可・1 件削除可） |
| **生成ボタン** | 推定 Anlas を表示。生成後は履歴に追加され、コマ背景画像に自動セット |

### デフォルトプロンプト

```
クオリティプレフィックス: best quality, amazing quality, very aesthetic,
ネガティブ既定: nsfw, lowres, {bad}, error, fewer, extra, missing, worst quality,
              jpeg artifacts, bad quality, watermark, unfinished, displeasing,
              chromatic aberration, signature, extra digits, artistic error,
              username, scan, [abstract]
```

参照キャラ・精密参照を組み合わせるとプロンプトの実体は内部で組み立てられ、NovelAI に投げる JSON が決まる。

---

## 4. 参照キャラクター（character_prompts）

NovelAI v4 の **キャラクター別プロンプト**機能を活用。

- 「参照キャラ管理」モーダルで事前に登録したキャラクターを、生成時に**最大 6 体**選択
- 各キャラクターの positivePrompt / negativePrompt が NovelAI の `characterPrompts` 配列に渡される
- 並び順がそのまま左→右の配置順になる（NovelAI v4 のキャラ配置仕様に従う）

### キャラ登録手順

1. 左サイドバー「ツール」→「参照キャラクター」
2. 「＋」で新規追加
3. 名前 / ポジティブプロンプト / ネガティブプロンプトを入力
4. 参照画像をドロップ（rembg や マジックワンドで透過 PNG にしておくとなお良い）

---

## 5. 精密参照（vibe transfer）

- 最大 **2 件**
- 出典は次の 2 種類:
  - **`character-image`**: 参照キャラに紐づく画像から選ぶ（`${charId}/${imageId}` 形式）
  - **`composite`**: 合成ツールで作った合成画像（`assets/composites/...`）
- 各精密参照は **strength**（影響度）と **fidelity**（忠実度）を 0..1 で個別調整
- type: `character` / `style` / `character&style` の 3 種

---

## 6. シードと履歴

- `lastSeed`: 直近で使ったシード。固定/再現時に使う
- `history`: コマごとに保持される生成履歴の配列
  - 各エントリ: `{ relativePath, seed, createdAt, situationPrompt, supplementaryPrompt, aspect, width, height }`
- ギャラリーから 1 件削除可能（実ファイルは `assets/dust/` へ物理移動 / `manga.json` から履歴削除）

---

## 7. 画像保存先

- デフォルト: `assets/images/novelai/<panelId>/<timestamp>_<seed>.png`
- 参照キャラ用に生成する場合: `outputSubPath` を指定して `assets/<指定パス>/` に保存
- 生成成功後はコマの背景画像として自動セット

---

## 8. コスト（Anlas）

NovelAI は生成 1 枚ごとに **Anlas** を消費します。Opus サブスクの上限を超えた分が課金対象。

おおまかな目安（v4 系・1024×1024 相当・標準ステップ数の場合）:

| 項目 | おおよその追加 Anlas |
| --- | --- |
| 基本生成 | ~30 前後 |
| 参照キャラ 1 体 | +X |
| 精密参照 1 件 | +Y |

> 正確な値は NovelAI 側で都度更新されるので、生成モーダルの「推定 Anlas」表示と公式ドキュメントを参照してください。

接続テストの結果に `fixedAnlas`（サブスク上限内）と `purchasedAnlas`（追加購入分）が個別に表示されます。

---

## 9. エラーパターン

| `error` 値 | 意味 / 対処 |
| --- | --- |
| `token-missing` | トークン未保存 or 復号失敗。Settings から再保存 |
| `network` | サーバ到達不可・タイムアウト。回線確認 |
| `http-401` | トークン無効 or 期限切れ |
| `http-402` | Anlas 不足。サブスク or 追加購入 |
| `http-429` | レート制限。少し待ってリトライ |
| `http-5xx` | NovelAI 側のサーバエラー |

---

## 10. IPC まとめ

| IPC 名 | 用途 |
| --- | --- |
| `novelai:save-token` | トークン保存（空で削除） |
| `novelai:load-token` | トークン取得 |
| `novelai:clear-token` | トークン削除 |
| `novelai:test-connection` | 接続テスト + 残 Anlas |
| `novelai:generate` | 生成リクエスト |
| `novelai:delete-generation` | 履歴 1 件を assets/dust/ へ移動 |

シグネチャは [`src/renderer/src/env.d.ts`](../src/renderer/src/env.d.ts) を参照。

---

## 11. プライバシー

- トークンは OS の暗号化ストレージ (macOS Keychain) を介して保存
- 生成プロンプトと結果画像はローカルプロジェクトフォルダ内にのみ保存
- アプリから外部サーバへ送信されるのは NovelAI API リクエストのみ
- 生成画像は NovelAI 側のサーバにも一時的に保管される（NovelAI 側のプライバシーポリシー参照）

---

## 12. 参考リンク

- NovelAI 公式 API ドキュメント: https://docs.novelai.net/image/
- NovelAI 価格ページ: https://novelai.net/
- 関連実装ファイル:
  - メイン: [`src/main/ipc/novelai.ts`](../src/main/ipc/novelai.ts)
  - レンダラーモーダル: [`src/renderer/src/components/NovelAIGenerationModal.tsx`](../src/renderer/src/components/NovelAIGenerationModal.tsx)
  - サブ部品: [`src/renderer/src/components/NovelAIGeneration/`](../src/renderer/src/components/NovelAIGeneration/)
  - 状態: [`src/renderer/src/store/slices/novelaiSlice.ts`](../src/renderer/src/store/slices/novelaiSlice.ts)
