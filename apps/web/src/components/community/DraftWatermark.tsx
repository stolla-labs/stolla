/**
 * The mark that keeps a preview from reading as a live community page.
 *
 * Two separate things, on purpose:
 *
 * - the **watermark** is decorative and `aria-hidden`: it is repeated text a
 *   screen reader would otherwise announce several times for no information;
 * - the **banner** is the accessible statement, and it is a real element in
 *   the flow rather than an overlay, so it is present however the page is read
 *   and cannot be scrolled away from.
 *
 * It is sized in viewport units so the same component is unmistakable on a
 * phone and on a desktop without a breakpoint deciding which gets a warning,
 * and it never intercepts clicks — a creator previewing their page still has
 * to be able to use it.
 */
export function DraftWatermark() {
  return (
    <div
      aria-hidden="true"
      data-testid="draft-watermark"
      className="pointer-events-none fixed inset-0 z-40 flex select-none flex-col items-center justify-center gap-[12vh] overflow-hidden"
    >
      {[0, 1, 2].map((row) => (
        <span
          key={row}
          className="-rotate-[24deg] whitespace-nowrap text-[18vw] font-black leading-none tracking-[0.2em] text-slate-100/[0.06] sm:text-[14vw]"
        >
          DRAFT
        </span>
      ))}
    </div>
  );
}

/** The sentence a reader of the preview must not be able to miss. */
export function DraftPreviewBanner({ children }: { children?: React.ReactNode }) {
  return (
    <div
      role="note"
      data-testid="draft-preview-banner"
      className="rounded-xl border border-amber-700/70 bg-amber-950/50 p-4 text-sm text-amber-100"
    >
      <p>
        <strong className="font-semibold">This is an unpublished draft.</strong>{" "}
        Nothing here exists on chain yet: it is stored in this browser only, no
        contracts have been deployed, and it is not listed anywhere other people
        can reach.
      </p>
      {children}
    </div>
  );
}
