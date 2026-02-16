import { SkeletonLine, SkeletonToolbar, SkeletonPageHeader } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonToolbar />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <SkeletonLine className="w-32 h-5" />
              <SkeletonLine className="w-12 h-6 rounded" />
            </div>
            <SkeletonLine className="w-20 h-3" />
            <SkeletonLine className="w-24 h-3" />
          </div>
        ))}
      </div>
    </div>
  )
}
