// Instant skeleton for /admin/my-work — shown before JS hydrates on hard refresh.
export default function MyWorkLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page heading */}
      <div className="h-7 w-40 rounded bg-gray-200" />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
            <div className="h-3 w-16 rounded bg-gray-200" />
            <div className="h-7 w-10 rounded bg-gray-200" />
          </div>
        ))}
      </div>

      {/* Active jobs list */}
      <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="h-4 w-28 rounded bg-gray-200" />
        </div>
        <div className="divide-y divide-gray-50">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-gray-200 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-3/4 rounded bg-gray-200" />
                <div className="h-3 w-1/2 rounded bg-gray-100" />
              </div>
              <div className="h-5 w-16 rounded-full bg-gray-100" />
            </div>
          ))}
        </div>
      </div>

      {/* Second section */}
      <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="h-4 w-24 rounded bg-gray-200" />
        </div>
        <div className="divide-y divide-gray-50">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-2/3 rounded bg-gray-200" />
                <div className="h-3 w-1/3 rounded bg-gray-100" />
              </div>
              <div className="h-5 w-20 rounded-full bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
