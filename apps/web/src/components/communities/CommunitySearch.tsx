"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function CommunitySearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  function updateQuery(next: string) {
    setValue(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next.trim()) {
      params.set("q", next);
    } else {
      params.delete("q");
    }
    const qs = params.toString();
    router.replace(qs ? `/communities?${qs}` : "/communities");
  }

  return (
    <label className="block max-w-sm">
      <span className="sr-only">Search communities</span>
      <input
        type="search"
        value={value}
        onChange={(e) => updateQuery(e.target.value)}
        placeholder="Search communities by name..."
        data-testid="community-search-input"
        className="input-field w-full rounded-lg border bg-[#0b0f19] px-3 py-2 text-sm text-slate-100"
      />
    </label>
  );
}
