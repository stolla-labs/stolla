for community treasuries.",
  discussionUrl: "https://forum.example.org/t/alpha-observability",
})}`;

const BETA_PROPOSAL_DESCRIPTION = `STOLLA_PROPOSAL_METADATA_V1
${JSON.stringify({
  version: 1,
  title: "Beta grants proposal",
  summary: "Publish public dashboards for community grants.",
  body: "Fund shared reporting for community grants.",
  discussionUrl: null,
})}`;

function community(
  id: string,
  name: string,
  nftContract: string,
  governorContract: string,
  index: number,
) {
  return {
    record: {
      id,
      nftContract,
      governorContract,
      creator: WALLET_ADDRESS,
      communityOwner: WALLET_ADDRESS,
      createdAtLedger: 100 + index,
      creationIndex: index,
      metadataUri: `https://fixtures.stolla.test/${id}.json`,
      metadataHash: "12".repeat(32),
      metadataSchemaVersion: 1 as const,
    },
    metadata: {
      schemaVersion: 1 as const,
      name,
      description: `${name} deterministic browser fixture.`,
      externalLinks: [],
    },
    metadataError: null,
    governance: {
      votingDelay: 1,
      votingPeriod: 100,
      proposalThreshold: "1",
      quorum: "1",
      unavailableFields: [],
    },
  };
}

export async function installPublicFixtures(page: Page) {
  await page.addInitScript(
    ({ communities, proposals }) => {
      window.__STOLLA_E2E__ = {
        communities,
        proposals,
        diagnostics: { submissions: 0, invocations: [] },
      };
    },
    {
      communities: [
        community(ALPHA_ID, "Alpha Builders", ALPHA_NFT, ALPHA_GOVERNOR, 0),
        community(BETA_ID, "Beta Citizens", BETA_NFT, BETA_GOVERNOR, 1),
      ],
      proposals: {
        [ALPHA_GOVERNOR]: [
          { id: PROPOSAL_ID, description: ALPHA_PROPOSAL_DESCRIPTION, state: 1 },
        ],
        [BETA_GOVERNOR]: [
          { id: PROPOSAL_ID, description: BETA_PROPOSAL_DESCRIPTION, state: 1 },
        ],
      },
    },
  );
}