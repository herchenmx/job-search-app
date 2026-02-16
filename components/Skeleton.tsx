export function SkeletonLine({ className = '' }: { className?: string }) {
  return (
    <div className={`h-4 bg-gray-200 rounded animate-pulse ${className}`} />
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonLine className="w-48 h-4" />
        <SkeletonLine className="w-16 h-6 rounded-full" />
      </div>
      <SkeletonLine className="w-36 h-3" />
      <div className="flex gap-3">
        <SkeletonLine className="w-14 h-3" />
        <SkeletonLine className="w-14 h-3" />
        <SkeletonLine className="w-14 h-3" />
      </div>
    </div>
  )
}

export function SkeletonToolbar() {
  return (
    <div className="flex items-center gap-3 mb-4">
      <SkeletonLine className="w-48 h-9 rounded-lg" />
      <SkeletonLine className="w-32 h-9 rounded-lg" />
      <SkeletonLine className="w-32 h-9 rounded-lg" />
    </div>
  )
}

export function SkeletonPageHeader() {
  return (
    <div className="mb-6 space-y-1">
      <SkeletonLine className="w-40 h-7" />
      <SkeletonLine className="w-64 h-4" />
    </div>
  )
}
