"use client";

import { useEffect } from "react";
import { CommunityCreationWizard } from "@/components/community/CommunityCreationWizard";
import { emitAnalytics } from "@/lib/analytics";

/**
 * Canonical community creation route. The wizard component is the single
 * implementation; this page only mounts it.
 */
export default function CreateCommunityPage() {
  useEffect(() => {
    emitAnalytics("create_start", { source: "create_route" }, { onceKey: "create-route" });
  }, []);
  return <CommunityCreationWizard />;
}
