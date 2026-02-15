'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-xl font-bold text-gray-900 mt-6 mb-3">{children}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-bold text-gray-900 mt-5 mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-semibold text-gray-900 mt-4 mb-2">{children}</h3>,
        h4: ({ children }) => <h4 className="text-sm font-semibold text-gray-900 mt-3 mb-1">{children}</h4>,
        p: ({ children }) => <p className="text-sm text-gray-700 mb-3 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-outside ml-5 mb-3 space-y-1 text-sm text-gray-700">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-outside ml-5 mb-3 space-y-1 text-sm text-gray-700">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-gray-300 pl-4 my-3 text-sm text-gray-600 italic">{children}</blockquote>
        ),
        hr: () => <hr className="my-4 border-gray-200" />,
        table: ({ children }) => (
          <div className="overflow-x-auto mb-4">
            <table className="min-w-full text-sm border border-gray-200 rounded-lg">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
        th: ({ children }) => <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-gray-200">{children}</th>,
        td: ({ children }) => <td className="px-3 py-2 text-sm text-gray-700 border-b border-gray-100">{children}</td>,
        code: ({ children, className }) => {
          const isBlock = className?.includes('language-')
          if (isBlock) {
            return <code className="block bg-gray-50 rounded-lg p-3 text-xs font-mono text-gray-800 overflow-x-auto my-3">{children}</code>
          }
          return <code className="bg-gray-100 rounded px-1.5 py-0.5 text-xs font-mono text-gray-800">{children}</code>
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
