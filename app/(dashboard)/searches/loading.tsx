import { SkeletonLine, SkeletonPageHeader } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
            <div className="space-y-2">
              <SkeletonLine className="w-40 h-4" />
              <SkeletonLine className="w-64 h-3" />
            </div>
            <SkeletonLine className="w-16 h-6 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
