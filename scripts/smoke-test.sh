#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
ORIGIN="${ORIGIN:-Ho Chi Minh City}"
DESTINATION="${DESTINATION:-Vung Tau}"

echo "Running smoke test against ${BASE_URL}"
echo "Route: ${ORIGIN} -> ${DESTINATION}"

TMP_JSON="$(mktemp)"

curl -sS "${BASE_URL}/api/generate" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "{\"origin\":\"${ORIGIN}\",\"destination\":\"${DESTINATION}\"}" \
  > "${TMP_JSON}"

node -e '
const fs = require("fs");
const file = process.argv[1];
const raw = fs.readFileSync(file, "utf8");
const data = JSON.parse(raw);

if (data.error) {
  console.error("Smoke test failed with API error:", data.error);
  process.exit(1);
}

if (!Array.isArray(data.routes) || data.routes.length === 0) {
  console.error("Smoke test failed: no routes returned");
  process.exit(1);
}

const scenic = data.routes.filter((r) => !r.isBaseline).length;
console.log(`Smoke test passed: ${data.routes.length} routes (${scenic} scenic)`);
' "${TMP_JSON}"

rm -f "${TMP_JSON}"
