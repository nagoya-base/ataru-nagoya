#!/bin/bash
# delete-merged-branches.sh
#
# マージ済みリモートブランチを削除するスクリプト（issue #77）
# 実行前に必ず確認コマンドを実行してください。
#
# 使い方:
#   chmod +x .github/scripts/delete-merged-branches.sh
#   ./.github/scripts/delete-merged-branches.sh [--dry-run]
#
# --dry-run オプションを付けると削除せずに対象ブランチを表示のみします。

set -e

DRY_RUN=false
if [[ "${1}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "[DRY RUN] 削除はしません。対象ブランチを表示します。"
fi

# 最新状態を取得
echo "リモート情報を更新中..."
git fetch origin --prune

# origin/main にマージ済みのブランチを配列に格納（main・HEAD を除く）
mapfile -t MERGED < <(git branch -r --merged origin/main | grep -v 'origin/main\|HEAD' | sed 's|[[:space:]]*origin/||')

if [[ ${#MERGED[@]} -eq 0 ]]; then
  echo "削除対象のマージ済みブランチはありません。"
  exit 0
fi

echo ""
echo "削除対象のマージ済みリモートブランチ:"
for branch in "${MERGED[@]}"; do
  echo "  - ${branch}"
done

echo ""
if $DRY_RUN; then
  echo "[DRY RUN] 上記 ${#MERGED[@]} 本を削除予定（実際には削除しません）。"
  exit 0
fi

read -rp "上記ブランチをすべて削除しますか？ [y/N]: " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "キャンセルしました。"
  exit 0
fi

echo "削除中..."
git push origin --delete "${MERGED[@]}"
echo "完了しました。"
