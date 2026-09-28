# ADR-003: IPFS Metadata

## Status

Accepted

## Context

SEP-0050 defines `token_uri` returning a URL to JSON metadata. Stolla NFTs need off-chain metadata for images and attributes.

## Decision

- Metadata follows [SEP-0050 Non-Fungible Metadata JSON Schema](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0050.md)
- The create wizard builds canonical community and collection JSON from its fields. The mint form builds SEP-0050 member JSON. Users preview the exact JSON bytes and SHA-256 digest, then pin through the configured Pinata API route.
- The route uploads a public IPFS file and returns an `ipfs://` CID URI. The client compares the route's SHA-256 digest with the preview before filling the existing URI fields.
- Manual `ipfs://` or HTTPS URI paste remains available for already hosted content or when Pinata is not configured.
- Custom URI stored in contract persistent storage keyed by `token_id`
- Frontend displays the URI; optional IPFS gateway link for preview
- Pinata is an optional external pin provider; Stolla does not operate permanent IPFS hosting. Configure a server-only `PINATA_JWT` with file upload permission. Never expose this token through `NEXT_PUBLIC_*` values.

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

- Creators can prepare and pin metadata in the app; uploaded documents remain public on IPFS. A failed upload leaves the preview and draft available for retry.
- Community deployment fetches the pinned document and commits its exact bytes with SHA-256. Gateway availability is required for that verification.
- Contract exposes `custom_token_uri(token_id)` for stored per-token URIs
- Standard `token_uri` from OZ Base remains available as fallback via collection base URI
