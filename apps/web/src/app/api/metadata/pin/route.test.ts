import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { buildMemberDocument, metadataSha256 } from "@/lib/metadata/publish";

const cid = "bafkreid7qoywk77r7rj3slobqfekdvs57qwuwh5d2z3sqsw52iabe3mqne";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.PINATA_JWT;
});

describe("metadata pin API", () => {
  it("pins the exact UTF-8 preview bytes on public IPFS", async () => {
    process.env.PINATA_JWT = "test-token";
    const document = buildMemberDocument({ name: "Mémber", description: "A vote", image: "" });
    const provider = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { cid, size: new TextEncoder().encode(document.json).length } }), { status: 200 }),
    );
    const request = new NextRequest("https://example.org/api/metadata/pin", {
      method: "POST", headers: { origin: "https://example.org" }, body: JSON.stringify(document),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ uri: `ipfs://${cid}`, sha256: await metadataSha256(document.json) });
    const options = provider.mock.calls[0][1];
    expect(options?.headers).toEqual({ Authorization: "Bearer test-token" });
    const form = options?.body as FormData;
    expect(form.get("network")).toBe("public");
    expect(await (form.get("file") as File).text()).toBe(document.json);
  });

  it("rejects invalid documents before contacting the provider", async () => {
    process.env.PINATA_JWT = "test-token";
    const provider = vi.spyOn(globalThis, "fetch");
    provider.mockClear();
    const response = await POST(new NextRequest("https://example.org/api/metadata/pin", {
      method: "POST", body: JSON.stringify({ kind: "member", json: '{"name":"X"}' }),
    }));
    expect(response.status).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });

  it("rejects oversized requests without pinning", async () => {
    process.env.PINATA_JWT = "test-token";
    const provider = vi.spyOn(globalThis, "fetch");
    const response = await POST(new NextRequest("https://example.org/api/metadata/pin", {
      method: "POST", body: "x".repeat(16_384 + 257),
    }));
    expect(response.status).toBe(413);
    expect(provider).not.toHaveBeenCalled();
  });

  it("rejects a mismatched provider size and allows a later retry", async () => {
    process.env.PINATA_JWT = "test-token";
    const document = buildMemberDocument({ name: "Member", description: "Voting", image: "" });
    const provider = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { cid, size: 1 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { cid, size: new TextEncoder().encode(document.json).length } }), { status: 200 }));
    const request = () => new NextRequest("https://example.org/api/metadata/pin", {
      method: "POST", body: JSON.stringify(document),
    });
    expect((await POST(request())).status).toBe(502);
    expect((await POST(request())).status).toBe(200);
    expect(provider).toHaveBeenCalledTimes(2);
  });
});
