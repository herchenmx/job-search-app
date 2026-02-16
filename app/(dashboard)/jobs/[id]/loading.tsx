import { SkeletonLine, SkeletonPageHeader } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div className="max-w-4xl">
      <SkeletonPageHeader />
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 mb-4">
        <div className="flex items-center gap-3">
          <SkeletonLine className="w-32 h-9 rounded-lg" />
          <SkeletonLine className="flex-1 h-9 rounded-lg" />
          <SkeletonLine className="w-20 h-9 rounded-lg" />
        </div>
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 mb-4">
          <SkeletonLine className="w-32 h-4" />
          <SkeletonLine className="w-full h-3" />
          <SkeletonLine className="w-3/4 h-3" />
          <SkeletonLine className="w-1/2 h-3" />
        </div>
      ))}
    </div>
  )
}
