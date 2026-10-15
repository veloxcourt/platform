export default function TurnosLoading() {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-4">
      <div>
        <div className="h-7 w-52 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-10 w-full max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="h-[28rem] animate-pulse rounded-lg border bg-muted/40" />
    </div>
  );
}
