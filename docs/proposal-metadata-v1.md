# Proposal Metadata v1

Stolla stores structured proposal presentation data inside the Governor's
existing `description: String`. No contract or proposal-ID change is required.
Legacy free-text descriptions remain valid and render as plain text.

## Canonical envelope

The exact v1 wire representation is the ASCII prefix
`STOLLA_PROPOSAL_METADATA_V1\n` followed immediately by compact UTF-8 JSON with
this fixed key order:

```text
STOLLA_PROPOSAL_METADATA_V1
{"version":1,"title":"...","summary":"...","body":"...","discussionUrl":null}
```

The keys are exactly `version`, `title`, `summary`, `body`, and
`discussionUrl`; unknown or missing keys invalidate the envelope. Invalid JSON,
unknown versions, invalid fields, and oversized envelopes fall back to legacy
plain-text rendering. Parsers must never partially trust a malformed envelope.

## Bounds and URL policy

Limits count Unicode code points: title 120, summary 280, body 4,000, and
discussion URL 2,048. The complete UTF-8 envelope is limited to 8,192 bytes.
Required text is trimmed only at its outer boundary during serialization;
internal Unicode is preserved exactly. Discussion URLs are optional, must be
absolute HTTPS URLs, and cannot contain embedded credentials.

External discussion links use a new tab, `rel="noopener noreferrer"`, and a
no-referrer policy. Proposal content is always rendered as text, never injected
as HTML.

## Compatibility contract

- Writers serialize only this canonical v1 format.
- Readers accept a valid v1 envelope or return the original string unchanged.
- Existing Governor methods, event payloads, and proposal IDs are unchanged.
- List cards use the structured title and summary; detail views add body and
  discussion link. Legacy descriptions remain readable on every surface.
