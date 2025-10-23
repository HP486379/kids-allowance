# ブランチと最新コミットの確認方法

このリポジトリの Firebase 同期まわりの修正は公開リポジトリの `main` ブランチにプッシュされています。`work` というブランチは存在しないため、手元で確認する際は `main` をチェックアウトしてください。

```bash
git switch main
git pull --ff-only
git log --oneline --decorate -5
```

2025 年 10 月 23 日時点では、以下のコミットで「もくひょう」「ちょきん」タブ同期の改善が行われています。

- `ef55345` — fix(sync): keep goals list and events consistent across devices

もし `git log` に上記メッセージが表示されない場合は、リモートの最新履歴を取得するために次のコマンドを実行してください。

```bash
git fetch origin main:refs/remotes/origin/main
```

それでもコミットが見つからない場合は、GitHub 上の pull request やコミット履歴（https://github.com/HP486379/kids-allowance/commits/main ）を直接確認して最新の変更がマージ済みかどうかを確認してください。
