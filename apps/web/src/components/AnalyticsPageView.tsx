"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { emitAnalytics } from "@/lib/analytics";

export function AnalyticsPageView() {
  const pathname = usePathname();
  useEffect(() => {
    emitAnalytics("page_view", { path: pathname });
  }, [pathname]);
  return null;
}

