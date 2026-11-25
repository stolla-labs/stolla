import type { Metadata } from "next";
import { DraftPreviewRoute } from "./draft-preview-route";

/**
 * `noindex, nofollow` on the route itself, which is the only place it can be
 * declared for a page whose content is client-side.
 *
 * A draft community is not meant to be discoverable, and the registry already
 * guarantees most of that: Explore and any future sitemap list communities the
 * factory deployed, and a draft was never deployed, so there is nothing for
 * either to enumerate. This covers the remaining case — a preview URL that
 * reached a crawler some other way, through a pasted link or a browser
 * extension — by refusing to be indexed even though the crawler would find
 * only the refusal, since it holds no token for this device.
 */
export const metadata: Metadata = {
  title: "Draft preview | Stolla",
  robots: { index: false, follow: false, nocache: true },
};

export default function CommunityDraftPreviewPage() {
  return <DraftPreviewRoute />;
}
