import { describe, it, expect, vi } from "vitest";
import type { rpc } from "@stellar/stellar-sdk";
import { fetchGovernorEvents } from "./paginate";

const CONTRACT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";
const START_LEDGER = 1000;

function makeEvent(id: string): rpc.Api.EventResponse {
  return { id } as rpc.Api.EventResponse;
}

function makeServer(
  pages: Array<{ events: rpc.Api.EventResponse[]; cursor: string }>,
) {
  const getEvents = vi.fn();
  for (const page of pages) {
    getEvents.mockResolvedValueOnce(page);
  }
  return { getEvents } as unknown as rpc.Server;
}

async function collect(gen: AsyncGenerator<{ events: rpc.Api.EventResponse[]; cursor: string }>) {
  const results = [];
  for await (const page of gen) results.push(page);
  return results;
}

describe("fetchGovernorEvents", () => {
  it("uses startLedger on first request and cursor on subsequent ones", async () => {
    const server = makeServer([
      { events: [makeEvent("a")], cursor: "cursor-1" },
      { events: [makeEvent("b")], cursor: "cursor-2" },
      { events: [], cursor: "cursor-2" },
    ]);

    const pages = await collect(
      fetchGovernorEvents({ server, contractId: CONTRACT, startLedger: START_LEDGER }),
    );

    expect(pages).toHaveLength(3);
    expect(server.getEvents).toHaveBeenNthCalledWith(1, {
      filters: [{ type: "contract", contractIds: [CONTRACT] }],
      startLedger: START_LEDGER,
    });
    expect(server.getEvents).toHaveBeenNthCalledWith(2, {
      filters: [{ type: "contract", contractIds: [CONTRACT] }],
      cursor: "cursor-1",
    });
    expect(server.getEvents).toHaveBeenNthCalledWith(3, {
      filters: [{ type: "contract", contractIds: [CONTRACT] }],
      cursor: "cursor-2",
    });
  });

  it("stops after a single page when events are empty", async () => {
    const server = makeServer([{ events: [], cursor: "c0" }]);

    const pages = await collect(
      fetchGovernorEvents({ server, contractId: CONTRACT, startLedger: START_LEDGER }),
    );

    expect(pages).toHaveLength(1);
    expect(pages[0].events).toHaveLength(0);
    expect(server.getEvents).toHaveBeenCalledTimes(1);
  });

  it("collects multiple pages and yields them in order", async () => {
    const server = makeServer([
      { events: [makeEvent("1"), makeEvent("2")], cursor: "c1" },
      { events: [makeEvent("3")], cursor: "c2" },
      { events: [], cursor: "c3" },
    ]);

    const pages = await collect(
      fetchGovernorEvents({ server, contractId: CONTRACT, startLedger: START_LEDGER }),
    );

    expect(pages[0].events.map((e) => e.id)).toEqual(["1", "2"]);
    expect(pages[1].events.map((e) => e.id)).toEqual(["3"]);
    expect(pages[2].events).toHaveLength(0);
  });

  it("stops when the response cursor does not advance", async () => {
    const server = makeServer([
      { events: [makeEvent("x")], cursor: "same-cursor" },
      { events: [makeEvent("y")], cursor: "same-cursor" },
      // A third call would indicate the guard failed.
    ]);

    const pages = await collect(
      fetchGovernorEvents({ server, contractId: CONTRACT, startLedger: START_LEDGER }),
    );

    // Page 1 is yielded normally. Page 2 detects the repeated cursor and
    // stops before a third (infinite-loop) request.
    expect(pages).toHaveLength(2);
    expect(server.getEvents).toHaveBeenCalledTimes(2);
  });

  it("respects maxPages limit", async () => {
    const server = makeServer([
      { events: [makeEvent("1")], cursor: "c1" },
      { events: [makeEvent("2")], cursor: "c2" },
      { events: [makeEvent("3")], cursor: "c3" },
    ]);

    const pages = await collect(
      fetchGovernorEvents({
        server,
        contractId: CONTRACT,
        startLedger: START_LEDGER,
        maxPages: 2,
      }),
    );

    expect(pages).toHaveLength(2);
    expect(server.getEvents).toHaveBeenCalledTimes(2);
  });

  it("re-throws RPC errors", async () => {
    const server = { getEvents: vi.fn().mockRejectedValue(new Error("network error")) } as unknown as rpc.Server;

    await expect(
      collect(fetchGovernorEvents({ server, contractId: CONTRACT, startLedger: START_LEDGER })),
    ).rejects.toThrow("network error");
  });
});
