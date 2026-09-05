export function PlaceholderPage({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <main className="min-h-screen bg-dashboard-surface px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-dashboard-muted">{description}</p>
        <div className="mt-6 flex flex-col items-start gap-2 rounded-lg border border-dashed border-dashboard-line bg-white p-6">
          <span className="rounded bg-dashboard-blue-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-dashboard-navy">
            {phase}
          </span>
          <p className="text-sm text-dashboard-muted">
            This section&apos;s data depends on backend work not built yet. The navigation and layout are in place so
            it can be wired up without reshaping the dashboard once that phase lands.
          </p>
        </div>
      </div>
    </main>
  );
}
