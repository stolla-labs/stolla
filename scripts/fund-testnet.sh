#!/usr/bin/env bash
set -euo pipefail

IDENTITY="${1:-deployer}"
PUBLIC_KEY="$(stellar keys address "$IDENTITY" --network testnet)"

echo "Funding $IDENTITY ($PUBLIC_KEY) via Friendbot..."
curl -s "https://friendbot.stellar.org?addr=$PUBLIC_KEY" | head -c 200
echo ""
echo "Done."
