#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
IDENTITY="${1:-deployer}"
NETWORK="testnet"

cd "$ROOT_DIR/contracts"
CARGO_TARGET_DIR=target stellar contract build

DEPLOYER="$(stellar keys address "$IDENTITY" --network "$NETWORK")"
echo "Deployer: $DEPLOYER"

echo "Deploying community-nft..."
NFT_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/community_nft.wasm \
  --source-account "$IDENTITY" \
  --network "$NETWORK" \
  -- \
  --uri "ipfs://stolla-collection/" \
  --name "Stolla Community" \
  --symbol "STOLLA" \
  --owner "$DEPLOYER")

echo "NFT contract: $NFT_ID"

echo "Deploying community-governor..."
GOV_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/community_governor.wasm \
  --source-account "$IDENTITY" \
  --network "$NETWORK" \
  -- \
  --token_contract "$NFT_ID" \
  --voting_delay 1 \
  --voting_period 10000 \
  --proposal_threshold 1 \
  --quorum 1)

echo "Governor contract: $GOV_ID"

ENV_FILE="$ROOT_DIR/apps/web/.env.local"
cat > "$ENV_FILE" <<EOF
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NFT_CONTRACT_ID=$NFT_ID
NEXT_PUBLIC_GOVERNOR_CONTRACT_ID=$GOV_ID
EOF

echo ""
echo "Wrote $ENV_FILE"
echo "Run: npm run dev"
