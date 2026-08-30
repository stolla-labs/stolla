#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"
WASM_DIR="$CONTRACTS_DIR/target/wasm32v1-none/release"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/apps/web/.env.local}"

IDENTITY=""
DRY_RUN=false
NETWORK="testnet"
RPC_URL="https://soroban-testnet.stellar.org"

show_help() {
  cat <<EOF
Usage: $(basename "$0") [IDENTITY] [OPTIONS]

Deploy Stolla contracts to Stellar testnet and configure the web application.

Arguments:
  IDENTITY          Stellar identity name (default: deployer)

Options:
  --dry-run         Simulate deployment and command construction without broadcasting transactions
  --network NET     Target Stellar network (default: testnet)
  --rpc-url URL     Soroban RPC endpoint URL (default: https://soroban-testnet.stellar.org)
  -h, --help        Show this help message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --network)
      NETWORK="$2"
      shift 2
      ;;
    --rpc-url)
      RPC_URL="$2"
      shift 2
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    -*)
      echo "Error: Unknown option '$1'" >&2
      show_help >&2
      exit 1
      ;;
    *)
      if [[ -z "$IDENTITY" ]]; then
        IDENTITY="$1"
      else
        echo "Error: Unexpected argument '$1'" >&2
        exit 1
      fi
      shift
      ;;
  esac
done

IDENTITY="${IDENTITY:-deployer}"

NFT_WASM="$WASM_DIR/community_nft.wasm"
GOV_WASM="$WASM_DIR/community_governor.wasm"
FACTORY_WASM="$WASM_DIR/community_factory.wasm"

# 1. Identity validation
if [[ "$DRY_RUN" == "true" ]]; then
  DEPLOYER="${MOCK_DEPLOYER:-GBDRYRUNCOMMUNITYDEPLOYERPUBLICKEY00000000000000000000000000}"
  echo "[dry-run] Using deployer identity '$IDENTITY' ($DEPLOYER)"
else
  if ! stellar keys public-key "$IDENTITY" >/dev/null 2>&1; then
    echo "Error: Identity '$IDENTITY' not found or invalid in Stellar CLI." >&2
    echo "Generate and fund one with:" >&2
    echo "  stellar keys generate $IDENTITY --network $NETWORK" >&2
    echo "  ./scripts/fund-testnet.sh $IDENTITY" >&2
    exit 1
  fi
  DEPLOYER="$(stellar keys public-key "$IDENTITY")"
  echo "Deployer: $DEPLOYER"
fi

# 2. Build contracts
echo "Building contracts..."
if [[ "$DRY_RUN" == "true" ]]; then
  echo "[dry-run] Executing: (cd contracts && CARGO_TARGET_DIR=target stellar contract build)"
else
  (cd "$CONTRACTS_DIR" && CARGO_TARGET_DIR=target stellar contract build)
fi

# 3. Upload approved NFT and Governor WASMs
echo "Uploading community-nft WASM..."
if [[ "$DRY_RUN" == "true" ]]; then
  echo "[dry-run] Executing: stellar contract upload --wasm $NFT_WASM --source-account $IDENTITY --network $NETWORK"
  NFT_WASM_HASH="${MOCK_NFT_WASM_HASH:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
else
  NFT_WASM_HASH="$(stellar contract upload \
    --wasm "$NFT_WASM" \
    --source-account "$IDENTITY" \
    --network "$NETWORK")"
fi
echo "NFT WASM Hash: $NFT_WASM_HASH"

echo "Uploading community-governor WASM..."
if [[ "$DRY_RUN" == "true" ]]; then
  echo "[dry-run] Executing: stellar contract upload --wasm $GOV_WASM --source-account $IDENTITY --network $NETWORK"
  GOV_WASM_HASH="${MOCK_GOV_WASM_HASH:-fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210}"
else
  GOV_WASM_HASH="$(stellar contract upload \
    --wasm "$GOV_WASM" \
    --source-account "$IDENTITY" \
    --network "$NETWORK")"
fi
echo "Governor WASM Hash: $GOV_WASM_HASH"

# 4. Deploy CommunityFactory with approved WASM hashes
echo "Deploying CommunityFactory..."
if [[ "$DRY_RUN" == "true" ]]; then
  echo "[dry-run] Executing: stellar contract deploy --wasm $FACTORY_WASM --source-account $IDENTITY --network $NETWORK -- --owner $DEPLOYER --nft_wasm_hash $NFT_WASM_HASH --governor_wasm_hash $GOV_WASM_HASH"
  FACTORY_ID="${MOCK_FACTORY_ID:-CFACTORY000000000000000000000000000000000000000000000000000000}"
else
  FACTORY_ID="$(stellar contract deploy \
    --wasm "$FACTORY_WASM" \
    --source-account "$IDENTITY" \
    --network "$NETWORK" \
    -- \
    --owner "$DEPLOYER" \
    --nft_wasm_hash "$NFT_WASM_HASH" \
    --governor_wasm_hash "$GOV_WASM_HASH")"
fi
echo "CommunityFactory contract: $FACTORY_ID"

# 5. Deploy default community-nft and community-governor (for fallback routes)
echo "Deploying default community-nft..."
if [[ "$DRY_RUN" == "true" ]]; then
  echo "[dry-run] Executing: stellar contract deploy --wasm $NFT_WASM --source-account $IDENTITY --network $NETWORK -- --uri ipfs://stolla-collection/ --name 'Stolla Community' --symbol STOLLA --owner $DEPLOYER"
  NFT_ID="${MOCK_NFT_ID:-CNFT0000000000000000000000000000000000000000000000000000000000}"
else
  NFT_ID="$(stellar contract deploy \
    --wasm "$NFT_WASM" \
    --source-account "$IDENTITY" \
    --network "$NETWORK" \
    -- \
    --uri "ipfs://stolla-collection/" \
    --name "Stolla Community" \
    --symbol "STOLLA" \
    --owner "$DEPLOYER")"
fi
echo "NFT contract: $NFT_ID"

echo "Deploying default community-governor..."
if [[ "$DRY_RUN" == "true" ]]; then
  echo "[dry-run] Executing: stellar contract deploy --wasm $GOV_WASM --source-account $IDENTITY --network $NETWORK -- --token_contract $NFT_ID --voting_delay 1 --voting_period 10000 --proposal_threshold 1 --quorum 1"
  GOV_ID="${MOCK_GOV_ID:-CGOV0000000000000000000000000000000000000000000000000000000000}"
else
  GOV_ID="$(stellar contract deploy \
    --wasm "$GOV_WASM" \
    --source-account "$IDENTITY" \
    --network "$NETWORK" \
    -- \
    --token_contract "$NFT_ID" \
    --voting_delay 1 \
    --voting_period 10000 \
    --proposal_threshold 1 \
    --quorum 1)"
fi
echo "Governor contract: $GOV_ID"

# 6. Capture deployment ledger sequence
echo "Capturing deployment ledger..."
if [[ "$DRY_RUN" == "true" ]]; then
  DEPLOY_LEDGER="${MOCK_DEPLOY_LEDGER:-1500000}"
  echo "[dry-run] Deployment ledger: $DEPLOY_LEDGER"
else
  DEPLOY_LEDGER=""
  if command -v curl >/dev/null 2>&1; then
    RPC_RESP="$(curl -s -X POST "$RPC_URL" \
      -H "Content-Type: application/json" \
      -d '{"jsonrpc":"2.0","id":1,"method":"getLatestLedger"}' 2>/dev/null || true)"
    if [[ -n "$RPC_RESP" ]]; then
      DEPLOY_LEDGER="$(echo "$RPC_RESP" | grep -o '"sequence":[0-9]*' | head -n1 | cut -d':' -f2 || true)"
    fi
  fi
  if [[ -z "$DEPLOY_LEDGER" || "$DEPLOY_LEDGER" -le 0 ]] 2>/dev/null; then
    DEPLOY_LEDGER=1
  fi
  echo "Deployment ledger: $DEPLOY_LEDGER"
fi

# 7. Update .env.local while preserving existing unrelated variables
mkdir -p "$(dirname "$ENV_FILE")"

UPDATES_JSON="$(node -e '
console.log(JSON.stringify({
  NEXT_PUBLIC_STELLAR_NETWORK: process.argv[1],
  NEXT_PUBLIC_STELLAR_RPC_URL: process.argv[2],
  NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID: process.argv[3],
  NEXT_PUBLIC_NFT_CONTRACT_ID: process.argv[4],
  NEXT_PUBLIC_GOVERNOR_CONTRACT_ID: process.argv[5],
  NEXT_PUBLIC_GOVERNOR_START_LEDGER: process.argv[6]
}));
' "$NETWORK" "$RPC_URL" "$FACTORY_ID" "$NFT_ID" "$GOV_ID" "$DEPLOY_LEDGER")"

node -e '
const fs = require("node:fs");
const envFile = process.argv[1];
const updates = JSON.parse(process.argv[2]);

let content = "";
if (fs.existsSync(envFile)) {
  content = fs.readFileSync(envFile, "utf8");
}

const lines = content.length > 0 ? content.split(/\r?\n/) : [];
const hadTrailingNewline = lines.length > 0 && lines[lines.length - 1] === "";
if (hadTrailingNewline) {
  lines.pop();
}

const seenKeys = new Set();
const updatedLines = lines.map((line) => {
  const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=/);
  if (match && Object.prototype.hasOwnProperty.call(updates, match[1])) {
    const key = match[1];
    seenKeys.add(key);
    return `${key}=${updates[key]}`;
  }
  return line;
});

for (const [key, value] of Object.entries(updates)) {
  if (!seenKeys.has(key)) {
    updatedLines.push(`${key}=${value}`);
  }
}

fs.writeFileSync(envFile, updatedLines.join("\n") + "\n", "utf8");
' "$ENV_FILE" "$UPDATES_JSON"

# 8. Output summary and explorer links
EXPLORER_BASE="https://stellar.expert/explorer/$NETWORK"

echo ""
echo "============================================================"
echo "              Stolla Testnet Deployment Complete            "
echo "============================================================"
echo "Deployer Identity:   $IDENTITY ($DEPLOYER)"
echo "Network:             $NETWORK"
echo "Soroban RPC:         $RPC_URL"
echo "Deploy Ledger:       $DEPLOY_LEDGER"
echo ""
echo "--- WASM Hashes ---"
echo "NFT WASM Hash:       $NFT_WASM_HASH"
echo "Governor WASM Hash:  $GOV_WASM_HASH"
echo ""
echo "--- Contract Addresses ---"
echo "CommunityFactory:    $FACTORY_ID"
echo "Community NFT:       $NFT_ID"
echo "Community Governor:  $GOV_ID"
echo ""
echo "--- Explorer Links ---"
echo "Factory:             $EXPLORER_BASE/contract/$FACTORY_ID"
echo "NFT:                 $EXPLORER_BASE/contract/$NFT_ID"
echo "Governor:            $EXPLORER_BASE/contract/$GOV_ID"
echo "Deployer Account:    $EXPLORER_BASE/account/$DEPLOYER"
echo "============================================================"
echo ""
echo "Updated $ENV_FILE"
echo "Run: npm run dev"
