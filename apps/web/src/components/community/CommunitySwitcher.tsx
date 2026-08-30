import Link from "next/link";
import type { Community } from "@/lib/community/types";

export type CommunitySwitcherProps = {
  communities: Community[];
  activeCommunityId?: string;
};

export function CommunitySwitcher({
  communities,
  activeCommunityId,
}: CommunitySwitcherProps) {
  if (communities.length === 0) return null;

  return (
    <nav aria-label="Switch community">
      <ul className="flex flex-wrap gap-1">
        {communities.map((community) => {
          const isActive = community.record.id === activeCommunityId;
          return (
            <li key={community.record.id}>
              <Link
                href={`/community/${community.record.id}`}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-indigo-950 font-medium text-indigo-300"
                    : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-100"
                }`}
              >
                {community.metadata?.name ?? community.record.id}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
