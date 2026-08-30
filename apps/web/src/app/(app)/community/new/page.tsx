import { redirect } from "next/navigation";

/**
 * Legacy creation route. Canonical wizard lives at `/communities/create`.
 */
export default function CommunityNewRedirectPage() {
  redirect("/communities/create");
}
