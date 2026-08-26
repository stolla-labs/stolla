import { beforeEach, describe, expect, it } from "vitest";
import { Networks } from "@stellar/stellar-sdk";
import {
  INITIAL_CREATION_STATE,
  creationReducer,
  deploymentBlocker,
  deploymentStage,
  isDraftComplete,
  simulationBlocker,
  type CommunityDraft,
  type CommunitySimulation,
  type CreationContext,
  type CreationState,
} from "./community-creation";
import { NETWORKS, compareNetworks, describeNetwork } from "./network";

const DRAFT: CommunityDraft = {
  name: "Stolla Builders",
  symbol: "STBL",
  description: "A community for builders",
  collectionUri: "ipfs://QmCollection",
  metadataUri: "ipfs://QmCollection",
  logo: "",
  externalLinkLabel: "",
  externalLinkUrl: "",
  votingDelay: "1",
  votingPeriod: "10000",
  proposalThreshold: "1",
  quorum: "1",
};

function simulationOn(passphrase: string): CommunitySimulation {
  return {
    networkPassphrase: passphrase,
    factoryAddress: "CFACTORY",
    transactionXdr: "AAAA",
    minResourceFee: "1000",
  };
}

function contextFor(walletPassphrase: string | null): CreationContext {
  return {
    walletConnected: true,
    comparison: compareNetworks(
      NETWORKS.testnet,
      walletPassphrase ? describeNetwork(walletPassphrase) : null,
    ),
    factoryConfigured: true,
  };
}

function apply(
  state: CreationState,
  ...actions: Parameters<typeof creationReducer>[1][]
) {
  return actions.reduce(creationReducer, state);
}

let onTestnet: CreationState;

beforeEach(() => {
  onTestnet = apply(
    INITIAL_CREATION_STATE,
    { type: "draft-changed", changes: DRAFT },
    { type: "network-detected", passphrase: Networks.TESTNET },
    { type: "simulation-succeeded", simulation: simulationOn(Networks.TESTNET) },
  );
});

describe("draft validation", () => {
  it("requires every text field and positive integer parameters", () => {
    expect(isDraftComplete(DRAFT)).toBe(true);
    expect(isDraftComplete({ ...DRAFT, name: "  " })).toBe(false);
    expect(isDraftComplete({ ...DRAFT, quorum: "-1" })).toBe(false);
    expect(isDraftComplete({ ...DRAFT, votingPeriod: "10.5" })).toBe(false);
  });
});

describe("initial mismatch", () => {
  it("blocks simulation and deployment before anything is built", () => {
    const state = apply(INITIAL_CREATION_STATE, {
      type: "draft-changed",
      changes: DRAFT,
    });
    const context = contextFor(Networks.PUBLIC);

    expect(simulationBlocker(state, context)).toBe("network-mismatch");
    expect(deploymentBlocker(state, context)).toBe("network-mismatch");
  });

  it("blocks while the wallet network is still unknown", () => {
    const state = apply(INITIAL_CREATION_STATE, {
      type: "draft-changed",
      changes: DRAFT,
    });
    expect(simulationBlocker(state, contextFor(null))).toBe("network-unknown");
  });
});

describe("mid-flow network switch", () => {
  it("discards the simulation and keeps draft values", () => {
    const switched = creationReducer(onTestnet, {
      type: "network-detected",
      passphrase: Networks.PUBLIC,
    });

    expect(switched.simulation).toBeNull();
    expect(switched.draft).toEqual(DRAFT);
  });

  it("clears a pending signature so no stale approval can land", () => {
    const signing = creationReducer(onTestnet, { type: "signing-started" });
    const switched = creationReducer(signing, {
      type: "network-detected",
      passphrase: Networks.PUBLIC,
    });

    expect(switched.signing).toBe(false);
  });

  it("blocks deployment once the wallet has moved", () => {
    const switched = creationReducer(onTestnet, {
      type: "network-detected",
      passphrase: Networks.PUBLIC,
    });

    expect(deploymentBlocker(switched, contextFor(Networks.PUBLIC))).toBe(
      "network-mismatch",
    );
  });

  it("ignores a repeated report of the same network", () => {
    const same = creationReducer(onTestnet, {
      type: "network-detected",
      passphrase: Networks.TESTNET,
    });

    expect(same).toBe(onTestnet);
    expect(same.simulation).not.toBeNull();
  });

  it("drops a simulation that resolves after the wallet moved", () => {
    const switched = creationReducer(onTestnet, {
      type: "network-detected",
      passphrase: Networks.PUBLIC,
    });
    const late = creationReducer(switched, {
      type: "simulation-succeeded",
      simulation: simulationOn(Networks.TESTNET),
    });

    expect(late.simulation).toBeNull();
  });
});

describe("recovery to the expected network", () => {
  it("requires a fresh simulation and preserves governance values", () => {
    const recovered = apply(
      onTestnet,
      { type: "network-detected", passphrase: Networks.PUBLIC },
      { type: "network-detected", passphrase: Networks.TESTNET },
    );
    const context = contextFor(Networks.TESTNET);

    expect(recovered.simulation).toBeNull();
    expect(recovered.draft).toEqual(DRAFT);
    expect(deploymentBlocker(recovered, context)).toBe("simulation-required");
    expect(simulationBlocker(recovered, context)).toBeNull();
  });

  it("allows deployment again once a new simulation exists", () => {
    const resimulated = apply(
      onTestnet,
      { type: "network-detected", passphrase: Networks.PUBLIC },
      { type: "network-detected", passphrase: Networks.TESTNET },
      {
        type: "simulation-succeeded",
        simulation: simulationOn(Networks.TESTNET),
      },
    );

    expect(
      deploymentBlocker(resimulated, contextFor(Networks.TESTNET)),
    ).toBeNull();
  });
});

describe("stale simulation", () => {
  it("is rejected even when the wallet is back on the expected network", () => {
    const stale: CreationState = {
      ...onTestnet,
      simulation: simulationOn(Networks.PUBLIC),
    };

    expect(deploymentBlocker(stale, contextFor(Networks.TESTNET))).toBe(
      "simulation-stale",
    );
  });
});

describe("post-submission network changes", () => {
  const submitted = () =>
    creationReducer(onTestnet, {
      type: "submission-recorded",
      submission: {
        networkPassphrase: Networks.TESTNET,
        transactionHash: "hash-1",
        status: "pending",
        registry: null,
      },
    });

  it("keeps the transaction and the network it was submitted to", () => {
    const switched = creationReducer(submitted(), {
      type: "network-detected",
      passphrase: Networks.PUBLIC,
    });

    expect(switched.submission).toEqual({
      networkPassphrase: Networks.TESTNET,
      transactionHash: "hash-1",
      status: "pending",
      registry: null,
    });
  });

  it("does not allow a second submission after switching back", () => {
    const returned = apply(
      submitted(),
      { type: "network-detected", passphrase: Networks.PUBLIC },
      { type: "network-detected", passphrase: Networks.TESTNET },
    );

    expect(deploymentBlocker(returned, contextFor(Networks.TESTNET))).toBe(
      "already-submitted",
    );
    expect(simulationBlocker(returned, contextFor(Networks.TESTNET))).toBe(
      "already-submitted",
    );
  });

  it("still records confirmation after a switch", () => {
    const confirmed = apply(
      submitted(),
      { type: "network-detected", passphrase: Networks.PUBLIC },
      { type: "submission-settled", status: "confirmed" },
    );

    expect(confirmed.submission?.status).toBe("confirmed");
  });
});

describe("deployment stage", () => {
  const REGISTRY = { nftContractId: "CNFT", governorContractId: "CGOV" };

  const submittedState = () =>
    creationReducer(onTestnet, {
      type: "submission-recorded",
      submission: {
        networkPassphrase: Networks.TESTNET,
        transactionHash: "hash-1",
        status: "pending",
        registry: null,
      },
    });

  it("advances through the flow", () => {
    expect(deploymentStage(INITIAL_CREATION_STATE)).toBe("draft");
    expect(deploymentStage(onTestnet)).toBe("simulated");
    expect(
      deploymentStage(creationReducer(onTestnet, { type: "signing-started" })),
    ).toBe("awaiting-approval");
    expect(deploymentStage(submittedState())).toBe("submitted");
  });

  it("only reports verified once the registry has answered", () => {
    const confirmed = creationReducer(submittedState(), {
      type: "submission-settled",
      status: "confirmed",
    });
    expect(deploymentStage(confirmed)).toBe("confirmed");

    const verified = creationReducer(confirmed, {
      type: "registry-verified",
      registry: REGISTRY,
    });
    expect(deploymentStage(verified)).toBe("verified");
    expect(verified.submission?.registry).toEqual(REGISTRY);
  });

  it("reports failure regardless of registry state", () => {
    const failed = creationReducer(submittedState(), {
      type: "submission-settled",
      status: "failed",
      message: "on chain failure",
    });
    expect(deploymentStage(failed)).toBe("failed");
  });

  it("ignores a registry result with no submission to attach it to", () => {
    const orphan = creationReducer(onTestnet, {
      type: "registry-verified",
      registry: REGISTRY,
    });
    expect(orphan).toBe(onTestnet);
  });
});

describe("blocker precedence", () => {
  it("reports the mismatch before missing configuration or draft gaps", () => {
    const context: CreationContext = {
      ...contextFor(Networks.PUBLIC),
      factoryConfigured: false,
    };
    const empty = apply(INITIAL_CREATION_STATE, {
      type: "network-detected",
      passphrase: Networks.PUBLIC,
    });

    expect(simulationBlocker(empty, context)).toBe("network-mismatch");
  });

  it("blocks a disconnected wallet first", () => {
    expect(
      simulationBlocker(onTestnet, {
        ...contextFor(Networks.TESTNET),
        walletConnected: false,
      }),
    ).toBe("wallet-disconnected");
  });

  it("blocks concurrent submissions while a signature is pending", () => {
    const signing = creationReducer(onTestnet, { type: "signing-started" });
    expect(deploymentBlocker(signing, contextFor(Networks.TESTNET))).toBe(
      "submission-in-progress",
    );
  });
});
