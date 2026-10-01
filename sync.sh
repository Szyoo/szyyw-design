#!/bin/sh
# @szyyw/design · sync.sh — 把设计包按 tag 同步到一个无构建步骤项目的 vendor 目录。
# 这是 vendoring 的唯一来源；各项目不要再各写一份。
#
#   sh sync.sh <dest-dir>              拉 GitHub 最新 tag
#   sh sync.sh <dest-dir> v0.8.0       拉指定 tag
#   sh sync.sh <dest-dir> --local      从本机 clone 的工作区同步（调试未发版改动用）
#
# 一行引用（项目里不必保存脚本）：
#   curl -fsSL https://raw.githubusercontent.com/Szyoo/szyyw-design/main/sync.sh | sh -s -- ./static/vendor/szyyw-design v0.8.0
#
# 同步后会写/更新 <dest>/VENDORED.md 记录版本；本脚本之外不要手改 vendor 目录。
set -eu

DEST=${1:?usage: sync.sh <dest-dir> [tag|--local]}
REF=${2:-latest}
REPO=Szyoo/szyyw-design
FILES="tokens.css components.css dotfield.js scheme.js corner.js settings.js switcher.js account.js version.js"

if [ "$REF" = "--local" ]; then
  SRC=${DESIGN_UPSTREAM:-$HOME/Documents/GitHub/szyyw-design}
  [ -f "$SRC/version.js" ] || { echo "local upstream not found: $SRC" >&2; exit 1; }
  if [ -n "$(git -C "$SRC" status --porcelain 2>/dev/null)" ]; then
    echo "note: local upstream has uncommitted changes; copying the working tree as-is" >&2
  fi
else
  if [ "$REF" = "latest" ]; then
    REF=$(curl -fsSL "https://api.github.com/repos/$REPO/tags?per_page=1" \
      | sed -n 's/.*"name": *"\([^"]*\)".*/\1/p' | head -n1)
    [ -n "$REF" ] || { echo "could not resolve latest tag" >&2; exit 1; }
  fi
  TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
  echo "fetching $REPO@$REF …"
  curl -fsSL "https://codeload.github.com/$REPO/tar.gz/refs/tags/$REF" | tar xz -C "$TMP" --strip-components=1
  SRC=$TMP
fi

VERSION=$(sed -n 's/.*VERSION = "\([^"]*\)".*/\1/p' "$SRC/version.js")
[ -n "$VERSION" ] || { echo "could not read VERSION from upstream version.js" >&2; exit 1; }

mkdir -p "$DEST"
for f in $FILES; do
  cp "$SRC/$f" "$DEST/$f"
done

MD="$DEST/VENDORED.md"
if [ -f "$MD" ] && grep -q '当前版本：' "$MD"; then
  # 只刷新版本行，保留项目自己写的说明
  tmpmd=$(mktemp)
  sed "s/当前版本：\*\*v[0-9.][^*]*\*\*/当前版本：**v$VERSION**/" "$MD" > "$tmpmd" && mv "$tmpmd" "$MD"
else
  cat > "$MD" <<MDEOF
# @szyyw/design（vendored）

- 上游：https://github.com/$REPO
- 当前版本：**v$VERSION**
- 同步方式：上游 \`sync.sh\`（见其头部注释）；本目录文件**禁止手改**，要改先改上游、升 tag、再同步。

同步到此目录的文件：$FILES
MDEOF
fi

echo "synced @szyyw/design v$VERSION → $DEST"
