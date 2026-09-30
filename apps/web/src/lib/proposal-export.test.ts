import { describe, expect, it, vi } from "vitest";
import {
  escapeCsvField,
  serializeProposalsToCsv,
  serializeProposalsToJson,
  downloadFile,
  type ExportableProposal,
} from "./proposal-export";

describe("proposal-export serializers", () => {
  describe("escapeCsvField", () => {
    it("handles null and undefined gracefully", () => {
      expect(escapeCsvField(null)).toBe("");
      expect(escapeCsvField(undefined)).toBe("");
    });

    it("returns plain strings unchanged when safe", () => {
      expect(escapeCsvField("01abcdef")).toBe("01abcdef");
      expect(escapeCsvField("Active")).toBe("Active");
      expect(escapeCsvField(12345)).toBe("12345");
    });

    it("escapes fields containing commas, quotes, and newlines per RFC 4180", () => {
      expect(escapeCsvField("Hello, world")).toBe('"Hello, world"');
      expect(escapeCsvField('Quotes "inside" text')).toBe('"Quotes ""inside"" text"');
      expect(escapeCsvField("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
      expect(escapeCsvField("Line 1\r\nLine 2")).toBe('"Line 1\r\nLine 2"');
    });
  });

  describe("serializeProposalsToCsv", () => {
    it("serializes an empty list with standard headers only", () => {
      const csv = serializeProposalsToCsv([]);
      expect(csv).toBe(
        "id,title,summary,state,proposer,voteSnapshot,voteEnd,totalVotes,discoveryStatus\r\n",
      );
    });

    it("serializes multiple proposals with proper columns and escaping", () => {
      const proposals: ExportableProposal[] = [
        {
          id: "01",
          title: "Upgrade treasury, and multisig",
          summary: 'Summary with "quotes" and, commas',
          state: "Active",
          proposer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
          voteSnapshot: 1000,
          voteEnd: 2000,
          totalVotes: 50,
          discoveryStatus: "ready",
        },
        {
          id: "02",
          title: null,
          summary: null,
          state: "Unavailable",
          discoveryStatus: "error",
        },
      ];

      const csv = serializeProposalsToCsv(proposals);
      const lines = csv.trim().split("\r\n");
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe(
        "id,title,summary,state,proposer,voteSnapshot,voteEnd,totalVotes,discoveryStatus",
      );
      expect(lines[1]).toBe(
        '01,"Upgrade treasury, and multisig","Summary with ""quotes"" and, commas",Active,GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5,1000,2000,50,ready',
      );
      expect(lines[2]).toBe("02,,,Unavailable,,,,,error");
    });
  });

  describe("serializeProposalsToJson", () => {
    it("serializes empty proposal list to documented JSON schema v1", () => {
      const jsonStr = serializeProposalsToJson([], {
        communityId: "comm-123",
        communityName: "Atlas DAO",
        exportedAt: "2026-09-30T10:00:00.000Z",
      });

      const parsed = JSON.parse(jsonStr);
      expect(parsed).toEqual({
        $schema: "https://stolla.io/schemas/proposals-export-v1.json",
        version: 1,
        communityId: "comm-123",
        communityName: "Atlas DAO",
        exportedAt: "2026-09-30T10:00:00.000Z",
        totalCount: 0,
        proposals: [],
      });
    });

    it("serializes populated proposals and preserves nulls cleanly", () => {
      const proposals: ExportableProposal[] = [
        {
          id: "a1b2",
          title: "Proposal A",
          summary: "A brief summary",
          state: "Succeeded",
          proposer: "GABC",
          voteSnapshot: 120,
          voteEnd: 150,
          totalVotes: "1000",
          discoveryStatus: "ready",
        },
      ];

      const jsonStr = serializeProposalsToJson(proposals, {
        exportedAt: "2026-09-30T10:00:00.000Z",
      });
      const parsed = JSON.parse(jsonStr);

      expect(parsed.totalCount).toBe(1);
      expect(parsed.proposals[0]).toEqual({
        id: "a1b2",
        title: "Proposal A",
        summary: "A brief summary",
        state: "Succeeded",
        proposer: "GABC",
        voteSnapshot: 120,
        voteEnd: 150,
        totalVotes: "1000",
        discoveryStatus: "ready",
      });
    });
  });

  describe("downloadFile", () => {
    it("creates an object URL, clicks a temporary link, and cleans up", () => {
      const createObjectURLMock = vi.fn().mockReturnValue("blob:mock-url");
      const revokeObjectURLMock = vi.fn();
      globalThis.URL.createObjectURL = createObjectURLMock;
      globalThis.URL.revokeObjectURL = revokeObjectURLMock;

      const clickMock = vi.fn();
      const appendChildSpy = vi.spyOn(document.body, "appendChild");
      const removeChildSpy = vi.spyOn(document.body, "removeChild");

      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        const el = origCreateElement(tag);
        if (tag === "a") {
          el.click = clickMock;
        }
        return el;
      });

      downloadFile("col1,col2\r\nval1,val2", "test.csv", "text/csv");

      expect(createObjectURLMock).toHaveBeenCalledTimes(1);
      expect(clickMock).toHaveBeenCalledTimes(1);
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-url");

      vi.restoreAllMocks();
    });
  });
});
