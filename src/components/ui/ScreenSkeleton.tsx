export function ScreenSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <div className="h-10 w-48 rounded-xl bg-surface-2" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 rounded-2xl bg-surface-2" />
        ))}
      </div>
      <div className="h-40 rounded-2xl bg-surface-2" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-44 rounded-2xl bg-surface-2" />
        <div className="h-44 rounded-2xl bg-surface-2" />
      </div>
    </div>
  );
}
