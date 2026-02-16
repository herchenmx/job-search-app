import { SkeletonLine, SkeletonPageHeader } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto">
      <SkeletonPageHeader />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
            <SkeletonLine className="w-24 h-3" />
            <SkeletonLine className="w-full h-9 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
