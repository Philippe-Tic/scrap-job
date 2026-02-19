#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${SCRAPE_URL:-http://localhost:3000}"
ENDPOINT="$BASE_URL/api/scrape"

# Build JSON body from arguments
BODY='{}'

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      shift
      BODY=$(printf '{"sourceIds":["%s"]}' "$1")
      ;;
    --keywords)
      shift
      # Comma-separated list: "react,typescript"
      KW=$(echo "$1" | sed 's/,/","/g')
      BODY=$(printf '{"keywords":["%s"]}' "$KW")
      ;;
    *)
      echo "Usage: $0 [--source <id>] [--keywords <kw1,kw2>]"
      echo ""
      echo "Sources: emploi-territorial, hellowork, indeed, isarta, linkedin, welcometothejungle"
      exit 1
      ;;
  esac
  shift
done

echo "POST $ENDPOINT"
echo "Body: $BODY"
echo "---"

curl -sf -X POST "$ENDPOINT" \
  -H 'Content-Type: application/json' \
  -d "$BODY" | node -e "
    let data = '';
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => console.log(JSON.stringify(JSON.parse(data), null, 2)));
  "
