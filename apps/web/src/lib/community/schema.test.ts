import { describe, expect, it } from "vitest";
import {
  DEFAULT_GOVERNANCE_DRAFT,
  parseCommunityMetadata,
  validateAuthoringDraft,
  validateDeploymentPayload,
  validateGovernanceDraft,
  type CommunityDeploymentPayload,
  type CommunityMetadataDraft,
} from "./schema";

const VALID_DRAFT: CommunityMetadataDraft = {
  name: "Builders Guild",
  symbol: "BUILD",
  description: "A community for public-goods builders.",
  externalLinkLabel: "",
  externalLinkUrl: "",
};

const VALID_PAYLOAD: CommunityDeploymentPayload = {
  collectionUri: "ipfs://bafycollection",
  metadataUri: "ipfs://bafycommunity",
  metadataHash: "ab".repeat(32),
};

describe("community authoring draft (validateAuthoringDraft)", () => {
  it("accepts valid first-step input without any URI strings", () => {
    expect(validateAuthoringDraft(VALID_DRAFT)).toEqual({});
    expect(Object.keys(VALID_DRAFT)).not.toContain("collectionUri");
    expect(Object.keys(VALID_DRAFT)).not.toContain("metadataUri");
  });

  it("rejects values outside every documented length or format class", () => {
    expect(
      validateAuthoringDraft({
        ...VALID_DRAFT,
        name: "x".repeat(65),
        symbol: "lowercase",
        description: "x".repeat(2_001),
        externalLinkLabel: "x".repeat(33),
        externalLinkUrl: "ipfs://not-an-external-link",
      }),
    ).toEqual({
      name: "Use at most 64 UTF-8 bytes and no control characters.",
      symbol: "Use 1–12 uppercase letters or numbers.",
      description: "Use at most 2,000 UTF-8 bytes.",
      externalLinkLabel:
        "Use at most 32 UTF-8 bytes and no control characters.",
      externalLinkUrl: "Use a valid https:// URL of at most 256 bytes.",
    });
  });
});

describe("community deployment payload (validateDeploymentPayload)", () => {
  it("accepts a generated payload with ipfs URIs and a non-zero hash", () => {
    expect(validateDeploymentPayload(VALID_PAYLOAD)).toEqual({});
    expect(
      validateDeploymentPayload({ ...VALID_PAYLOAD, logoUri: "ipfs://bafylogo" }),
    ).toEqual({});
  });

  it("fails closed when the pin pipeline produced nothing", () => {
    const errors = validateDeploymentPayload(null);
    expect(Object.keys(errors)).toEqual([
      "collectionUri",
      "metadataUri",
      "metadataHash",
    ]);
  });

  it("rejects empty URIs, zero or malformed hashes, and bad logo URIs", () => {
    expect(
      validateDeploymentPayload({
        collectionUri: "",
        metadataUri: "ftp://nope",
        metadataHash: "0".repeat(64),
        logoUri: "http://insecure.example/logo.png",
      }),
    ).toEqual({
      collectionUri: "The generated collection URI is missing or invalid.",
      metadataUri: "The generated metadata URI is missing or invalid.",
      metadataHash: "The metadata hash must be a non-zero 32-byte SHA-256 digest.",
      logoUri: "The generated logo URI is invalid.",
    });
    expect(
      validateDeploymentPayload({ ...VALID_PAYLOAD, metadataHash: "AB".repeat(32) }),
    ).toHaveProperty("metadataHash");
    expect(
      validateDeploymentPayload({ ...VALID_PAYLOAD, metadataHash: "ab".repeat(31) }),
    ).toHaveProperty("metadataHash");
  });
});

describe("community metadata schema", () => {

  it("parses version-1 metadata and rejects unknown or mismatched fields", () => {
    const metadata = {
      schemaVersion: 1,
      name: "Builders Guild",
      description: "Build together.",
      externalLinks: [
        { label: "Website", url: "https://builders.example" },
      ],
      nftContract: "CNFT",
      governorContract: "CGOV",
    };

    expect(
      parseCommunityMetadata(metadata, {
        nftContract: "CNFT",
        governorContract: "CGOV",
      }),
    ).toEqual({
      schemaVersion: 1,
      name: "Builders Guild",
      description: "Build together.",
      externalLinks: [
        { label: "Website", url: "https://builders.example" },
      ],
    });
    expect(
      parseCommunityMetadata(
        { ...metadata, governorContract: "COTHER" },
        { nftContract: "CNFT", governorContract: "CGOV" },
      ),
    ).toBeNull();
    expect(
      parseCommunityMetadata(
        { ...metadata, unknown: true },
        { nftContract: "CNFT", governorContract: "CGOV" },
      ),
    ).toBeNull();
  });

  it("accepts explicit governance defaults, zero voting delay, and rejects schema boundaries", () => {
    expect(validateGovernanceDraft(DEFAULT_GOVERNANCE_DRAFT)).toEqual({});
    expect(
      validateGovernanceDraft({
        ...DEFAULT_GOVERNANCE_DRAFT,
        votingDelay: "0",
        votingPeriod: "1",
      }),
    ).toEqual({});
    expect(
      validateGovernanceDraft({
        proposalThreshold: "0",
        quorum: "4294967296",
        votingDelay: "120961",
        votingPeriod: "1555201",
      }),
    ).toEqual({
      proposalThreshold:
        "Enter a whole number from 1 through 4,294,967,295 NFT votes.",
      quorum: "Enter a whole number from 1 through 4,294,967,295 NFT votes.",
      votingDelay:
        "Enter a whole number from 0 through 120,960 ledgers (~7 days).",
      votingPeriod:
        "Enter a whole number from 1 through 1,555,200 ledgers (~90 days).",
    });
  });
});
