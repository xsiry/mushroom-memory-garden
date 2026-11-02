#!/bin/zsh
cd "${0:A:h}" || exit 1
game_node="$(command -v node)"
if [[ -z "$game_node" ]]; then
  game_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [[ ! -x "$game_node" ]]; then
  print "未找到 Node.js，请使用已安装 Node.js 22 或更高版本的终端执行 npm start。"
  exit 1
fi
"$game_node" scripts/serve.mjs
