# ADR-003: IPFS Metadata

## Status

Accepted

## Context

SEP-0050 defines `token_uri` returning a URL to JSON metadata. Stolla NFTs need off-chain metadata for images and attributes.

## Decision

- Metadata follows [SEP-0050 Non-Fungible Metadata JSON Schema](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0050.md)
- MVP accepts a **manual IPFS URI** per mint (e.g. `ipfs://Qm...` or gateway URL)
- Custom URI stored in contract persistent storage keyed by `token_id`
- Frontend displays the URI; optional IPFS gateway link for preview
- Automated pin/upload helper is out of scope for v0.1

## URI format

```json
{
  "name": "Stolla Member #1",
  "description": "Community membership NFT",
  "image": "ipfs://QmImageHash",
  "attributes": []
}
```

## Consequences

- Creators are responsible for pinning metadata before mint
- Contract exposes `custom_token_uri(token_id)` for stored per-token URIs
- Standard `token_uri` from OZ Base remains available as fallback via collection base URI
