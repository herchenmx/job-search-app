import { SkeletonLine, SkeletonCard, SkeletonPageHeader } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div className="max-w-4xl">
      <SkeletonPageHeader />
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 mb-6">
        <SkeletonLine className="w-20 h-3" />
        <SkeletonLine className="w-full h-3" />
        <SkeletonLine className="w-3/4 h-3" />
      </div>
      <SkeletonLine className="w-24 h-5 mb-3" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}
