// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

async function post(form: FormData) {
  vi.resetModules();
  const { POST } = await import("@/app/api/ipfs/pin/route");
  const request = new Request("http://localhost/api/ipfs/pin", {
    method: "POST",
    body: form,
  });
  const response = await POST(request);
  return { response, body: await response.json() };
}

function imageForm(overrides: { type?: string; size?: number } = {}) {
  const form = new FormData();
  form.set("kind", "image");
  form.set("name", "logo.png");
  form.set(
    "file",
    new Blob([new Uint8Array(overrides.size ?? 16)], {
      type: overrides.type ?? "image/png",
    }),
    "logo.png",
  );
  return form;
}

describe("POST /api/ipfs/pin", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.PINATA_JWT;
    delete process.env.PINATA_API_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("fails closed with a config error when PINATA_JWT is missing", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { response, body } = await post(imageForm());

    expect(response.status).toBe(400);
    expect(body.error.kind).toBe("config");
    expect(body.error.code).toBe("pin_config_missing");
    expect(body.error.message).toMatch(/PINATA_JWT/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects disallowed MIME types and oversized uploads before contacting the provider", async () => {
    process.env.PINATA_JWT = "secret";
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const mime = await post(imageForm({ type: "application/pdf" }));
    expect(mime.response.status).toBe(400);
    expect(mime.body.error.kind).toBe("validation");

    const size = await post(imageForm({ size: 5 * 1024 * 1024 + 1 }));
    expect(size.response.status).toBe(400);
    expect(size.body.error.message).toMatch(/at most 5 MB/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("forwards the exact bytes with the bearer token and returns an ipfs:// URI", async () => {
    process.env.PINATA_JWT = "secret";
    process.env.PINATA_API_URL = "https://pinata.example/";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url, init) => {
        expect(String(url)).toBe("https://pinata.example/pinning/pinFileToIPFS");
        expect((init?.headers as Record<string, string>).Authorization).toBe(
          "Bearer secret",
        );
        const upstream = init?.body as FormData;
        const file = upstream.get("file") as File;
        expect(await file.text()).toBe('{"schemaVersion":1}');
        expect(file.type).toBe("application/json");
        expect(JSON.parse(String(upstream.get("pinataOptions")))).toEqual({
          cidVersion: 1,
        });
        return new Response(JSON.stringify({ IpfsHash: "bafyjson", PinSize: 19 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

    const form = new FormData();
    form.set("kind", "json");
    form.set("name", "community.json");
    form.set(
      "file",
      new Blob(['{"schemaVersion":1}'], { type: "application/json" }),
      "community.json",
    );
    const { response, body } = await post(form);

    expect(response.status).toBe(200);
    expect(body).toEqual({ cid: "bafyjson", uri: "ipfs://bafyjson", size: 19 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("reports provider failures as retryable 502 errors", async () => {
    process.env.PINATA_JWT = "secret";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 401 }),
    );
    const { response, body } = await post(imageForm());

    expect(response.status).toBe(502);
    expect(body.error.kind).toBe("provider");
  });
});
