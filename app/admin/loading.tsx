// Shown instantly by Next.js (server-side) while any admin page loads.
// Replaces the blank white screen during JS download + auth check on hard refresh.
export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Fake header bar */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 flex items-center px-4 gap-3">
        <div className="w-8 h-8 rounded bg-gray-200 animate-pulse" />
        <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
        <div className="ml-auto flex gap-2">
          <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
          <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
        </div>
      </div>

      {/* Fake sidebar */}
      <div className="hidden lg:flex fixed left-0 top-16 bottom-0 w-64 bg-white border-r border-gray-200 flex-col gap-2 p-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-9 rounded-md bg-gray-100 animate-pulse" style={{ opacity: 1 - i * 0.08 }} />
        ))}
      </div>

      {/* Page content skeleton */}
      <div className="lg:ml-64 pt-20 px-4 md:px-6 lg:px-8 py-6">
        {/* Page title */}
        <div className="h-7 w-48 rounded bg-gray-200 animate-pulse mb-6" />

        {/* Cards row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>

        {/* Content blocks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-64 rounded-xl bg-gray-100 animate-pulse" />
          <div className="h-64 rounded-xl bg-gray-100 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
