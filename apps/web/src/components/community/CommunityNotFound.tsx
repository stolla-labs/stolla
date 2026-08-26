import Link from "next/link";
import { AppLinkButton } from "@/components/ui/AppLinkButton";

export function CommunityNotFound({ communityId }: { communityId: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-400">
          <li>
            <Link href="/" className="hover:text-slate-100 hover:underline">
              Home
            </Link>
          </li>
          <li className="flex items-center gap-1">
            <span aria-hidden="true">/</span>
            <Link href="/community" className="hover:text-slate-100 hover:underline">
              Communities
            </Link>
          </li>
        </ol>
      </nav>
      <h1 className="mt-6 text-2xl font-bold text-slate-100">Community not found</h1>
      <p className="mt-2 text-slate-400">
        No community is registered for{" "}
        <code className="font-mono text-slate-300">{communityId}</code>.
      </p>
      <AppLinkButton
        href="/community"
        tone="secondary"
        className="mt-6"
      >
        Back to communities
      </AppLinkButton>
    </div>
  );
}
