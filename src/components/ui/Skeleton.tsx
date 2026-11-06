export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-white/[0.04] rounded-lg animate-pulse ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-2 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

export function SkeletonTrainerCard() {
  return (
    <div className="card p-5">
      <Skeleton className="aspect-square w-full mb-4 rounded-xl" />
      <Skeleton className="h-4 w-3/4 mb-2" />
      <Skeleton className="h-3 w-1/2 mb-3" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonLessonCard() {
  return (
    <div className="card overflow-hidden">
      <Skeleton className="aspect-video w-full" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="h-5 w-24 mt-2" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6, type = "trainer" }: { count?: number; type?: "trainer" | "lesson" | "card" }) {
  const Component = type === "trainer" ? SkeletonTrainerCard : type === "lesson" ? SkeletonLessonCard : SkeletonCard;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, i) => <Component key={i} />)}
    </div>
  );
}
