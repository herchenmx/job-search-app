import { SkeletonLine, SkeletonPageHeader } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
            <SkeletonLine className="w-16 h-3" />
            <SkeletonLine className="w-12 h-8" />
          </div>
        ))}
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <SkeletonLine className="w-32 h-4" />
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonLine key={i} className="w-full h-3" />
        ))}
      </div>
    </div>
  )
}
