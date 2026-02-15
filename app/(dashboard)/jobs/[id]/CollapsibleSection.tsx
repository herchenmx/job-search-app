'use client'

import { useState } from 'react'

export default function CollapsibleSection({
  title,
  text,
}: {
  title: string
  text: string | null
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
      {!text ? (
        <p className="text-sm text-gray-400 italic">Not generated yet</p>
      ) : (
        <>
          <p
            className={`text-sm text-gray-700 whitespace-pre-wrap leading-relaxed ${
              expanded ? '' : 'line-clamp-3'
            }`}
          >
            {text}
          </p>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 hover:underline mt-2"
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        </>
      )}
    </div>
  )
}
