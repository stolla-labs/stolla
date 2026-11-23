import { afterEach, describe, expect, it } from "vitest";
import { communityLogoUrls, ipfsGatewayList } from "./ipfsGateways";

const ENV = {
  NEXT_PUBLIC_IPFS_GATEWAY_URL: "https://ipfs.io/ipfs/",
  NEXT_PUBLIC_IPFS_GATEWAY_URLS:
    "https://gateway.pinata.cloud/ipfs/,https://cloudflare-ipfs.com/ipfs/",
};

describe("ipfs gateways", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_IPFS_GATEWAY_URLS;
  });

  it("tries the configured list before the primary and the public fallback", () => {
    expect(ipfsGatewayList(ENV)).toEqual([
      "https://gateway.pinata.cloud/ipfs/",
      "https://cloudflare-ipfs.com/ipfs/",
      "https://ipfs.io/ipfs/",
    ]);
    expect(communityLogoUrls("ipfs://bafy-logo/logo.png", ENV)).toEqual([
      "https://gateway.pinata.cloud/ipfs/bafy-logo/logo.png",
      "https://cloudflare-ipfs.com/ipfs/bafy-logo/logo.png",
      "https://ipfs.io/ipfs/bafy-logo/logo.png",
    ]);
  });

  it("keeps an https logo on a single URL and drops an unsupported URI", () => {
    expect(communityLogoUrls("https://example.test/logo.png", ENV)).toEqual([
      "https://example.test/logo.png",
    ]);
    expect(communityLogoUrls("http://example.test/logo.png", ENV)).toEqual([]);
    expect(communityLogoUrls(undefined, ENV)).toEqual([]);
  });
});
