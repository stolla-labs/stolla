export function DashboardPreview() {
  return (
    <div
      className="overflow-hidden rounded-xl bg-white"
      aria-hidden
    >
      <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
        <span className="ml-2 h-2 w-24 rounded-full bg-zinc-200" />
      </div>

      <div className="flex min-h-[260px] sm:min-h-[300px]">
        <div className="hidden w-14 shrink-0 border-r border-zinc-100 bg-zinc-50 p-3 sm:block">
          <div className="mb-4 h-6 w-6 rounded-md bg-indigo-600" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="mb-2 h-2 w-full rounded bg-zinc-200" />
          ))}
        </div>

        <div className="flex-1 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="h-3 w-28 rounded-full bg-zinc-200" />
            <div className="h-7 w-24 rounded-lg bg-indigo-600" />
          </div>

          <div className="space-y-3">
            {[72, 55, 88].map((width, i) => (
              <div
                key={i}
                className="rounded-lg border border-zinc-100 bg-zinc-50 p-3"
              >
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 shrink-0 rounded-lg bg-indigo-100" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div
                      className="h-2 rounded-full bg-zinc-200"
                      style={{ width: `${width}%` }}
                    />
                    <div className="h-1.5 w-full rounded-full bg-zinc-100" />
                    <div className="flex gap-2 pt-1">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${40 + i * 15}%` }}
                        />
                      </div>
                      <div className="h-3 w-8 rounded bg-zinc-200" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
