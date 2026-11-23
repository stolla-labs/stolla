import {
  communityActivityLabel,
  communityWriteBlockReason,
  type CommunityActivity,
} from "@/lib/community/communityActivity";

export function CommunityActivityBadge({
  activity,
}: {
  activity?: CommunityActivity;
}) {
  const label = communityActivityLabel(activity);
  if (!label) return null;
  return (
    <span className="inline-flex rounded-full border border-amber-800/80 bg-amber-950/50 px-2 py-0.5 text-xs font-medium text-amber-200">
      {label}
    </span>
  );
}

export function CommunityWriteBlockedNotice({
  activity,
}: {
  activity?: CommunityActivity;
}) {
  const reason = communityWriteBlockReason(activity);
  if (!reason) return null;
  return (
    <p role="status" className="mt-3 text-sm text-amber-200">
      {reason}
    </p>
  );
}
