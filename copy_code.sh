find . \( -name "*.js" -o -name "*.json" -o -name "*.html" -o -name "*.mjs" \) \
  -not -path "*/node_modules/*" \
  -not -name "package-lock.json" \
  -exec sh -c 'echo "\n\n===== FILE: $1 ====="; cat "$1"' _ {} \; | xclip -selection clipboard
