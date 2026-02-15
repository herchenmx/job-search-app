'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import MarkdownRenderer from '@/components/MarkdownRenderer'

type Mode = 'view' | 'edit' | 'choose' | 'paste' | 'chat'
type Message = { role: 'user' | 'assistant'; content: string }

export default function RoleRubricPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<Mode | null>(null)
  const [savedRubric, setSavedRubric] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [pasteValue, setPasteValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [rubricDraft, setRubricDraft] = useState('')
  const [origRubric, setOrigRubric] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const [showSaveWarning, setShowSaveWarning] = useState(false)
  const [pendingSaveContent, setPendingSaveContent] = useState('')
  const [showAiFlowWarning, setShowAiFlowWarning] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role_preferences_rubric')
        .eq('user_id', user.id)
        .single()

      const rubric = profile?.role_preferences_rubric ?? null
      setSavedRubric(rubric)
      setOrigRubric(rubric)

      const { data } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'role_rubric')
        .single()

      if (data) {
        setConversationId(data.id)
        setMessages(data.messages as Message[])
        if (data.status === 'completed') {
          setIsComplete(true)
          const lastAssistant = [...data.messages]
            .reverse()
            .find((m: Message) => m.role === 'assistant')
          if (lastAssistant) {
            const match = lastAssistant.content.match(/## YOUR ROLE PREFERENCES RUBRIC[\s\S]*/m)
            if (match) setRubricDraft(match[0])
          }
        }
      }

      setMode(rubric ? 'view' : 'choose')
    }
    load()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function handleStartChat() {
    if (origRubric && messages.length === 0) {
      setShowAiFlowWarning(true)
    } else {
      startChat()
    }
  }

  async function startChat() {
    setShowAiFlowWarning(false)
    setMode('chat')
    if (messages.length > 0) return
    setLoading(true)
    try {
      const res = await fetch('/api/chat/role-rubric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [], conversationId: null }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMessages([{ role: 'assistant', content: data.message }])
      setConversationId(data.conversationId)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input.trim() }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/chat/role-rubric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages, conversationId }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMessages([...updatedMessages, { role: 'assistant', content: data.message }])
      setConversationId(data.conversationId)
      if (data.isComplete) {
        setIsComplete(true)
        const match = data.message.match(/## YOUR ROLE PREFERENCES RUBRIC[\s\S]*/m)
        if (match) setRubricDraft(match[0])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function handleSaveClick(content: string) {
    if (content !== (origRubric ?? '')) {
      setPendingSaveContent(content)
      setShowSaveWarning(true)
    } else {
      saveRubric(content)
    }
  }

  async function saveRubric(content: string) {
    setShowSaveWarning(false)
    setSaving(true)
    setSaveMsg('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      const { data: existing } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (existing) {
        await supabase
          .from('user_profiles')
          .update({ role_preferences_rubric: content, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
      } else {
        await supabase
          .from('user_profiles')
          .insert({ user_id: user.id, role_preferences_rubric: content })
      }

      if (content !== (origRubric ?? '')) {
        await supabase
          .from('jobs')
          .update({ needs_role_match_reanalysis: false, job_match_rate: null, job_match_insights: null })
          .eq('user_id', user.id)
      }

      setSavedRubric(content)
      setOrigRubric(content)
      setSaveMsg('Saved!')
      setTimeout(() => { setMode('view'); setSaveMsg('') }, 1200)
    } catch {
      setSaveMsg('Error saving. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function resetConversation() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('ai_conversations').delete().eq('user_id', user.id).eq('type', 'role_rubric')
    setMessages([])
    setConversationId(null)
    setIsComplete(false)
    setRubricDraft('')
    setMode('choose')
  }

  if (mode === null) return null

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.push('/profile')} className="text-gray-400 hover:text-gray-600 text-sm">← Profile</button>
        <h1 className="text-2xl font-bold text-gray-900">Role Preferences Rubric</h1>
      </div>

      {/* View mode */}
      {mode === 'view' && savedRubric && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <MarkdownRenderer content={savedRubric} />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { setEditValue(savedRubric); setMode('edit') }} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              Edit rubric
            </button>
            <button onClick={() => setMode('choose')} className="text-sm text-blue-600 hover:underline">
              Rebuild with AI
            </button>
          </div>
        </div>
      )}

      {/* Edit mode */}
      {mode === 'edit' && (
        <div className="space-y-4">
          <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={20} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" />
          <div className="flex items-center gap-3">
            <button onClick={() => handleSaveClick(editValue)} disabled={!editValue.trim() || saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">{saving ? 'Saving…' : 'Save'}</button>
            <button onClick={() => setMode('view')} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
            {saveMsg && <span className="text-sm text-green-600">{saveMsg}</span>}
          </div>
        </div>
      )}

      {/* Choose mode */}
      {mode === 'choose' && (
        <div className="space-y-4">
          <p className="text-gray-600">How would you like to create your role preferences rubric?</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button onClick={() => setMode('paste')} className="flex flex-col items-start p-6 border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition text-left">
              <span className="text-2xl mb-2">📋</span>
              <span className="font-semibold text-gray-900 mb-1">Paste existing rubric</span>
              <span className="text-sm text-gray-500">You already have your preferences written — paste them in markdown format.</span>
            </button>
            <button onClick={handleStartChat} className="flex flex-col items-start p-6 border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition text-left">
              <span className="text-2xl mb-2">💬</span>
              <span className="font-semibold text-gray-900 mb-1">Discover with AI</span>
              <span className="text-sm text-gray-500">Have a guided conversation with a career coach to uncover your ideal role preferences.</span>
            </button>
          </div>
          {messages.length > 0 && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
              <span className="text-sm text-yellow-800">{isComplete ? '✅ You have a completed conversation.' : '⏸ You have an in-progress conversation.'}</span>
              <div className="flex gap-2">
                <button onClick={() => setMode('chat')} className="text-sm text-blue-600 hover:underline">{isComplete ? 'Review' : 'Resume'}</button>
                <button onClick={resetConversation} className="text-sm text-red-500 hover:underline">Start over</button>
              </div>
            </div>
          )}
          {savedRubric && (
            <button onClick={() => setMode('view')} className="text-sm text-gray-400 hover:text-gray-600">← Back to rubric</button>
          )}
        </div>
      )}

      {/* Paste mode */}
      {mode === 'paste' && (
        <div className="space-y-4">
          <button onClick={() => setMode(savedRubric ? 'view' : 'choose')} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
          <label className="block text-sm font-medium text-gray-700">Paste your role preferences rubric (markdown or table format)</label>
          <textarea value={pasteValue} onChange={e => setPasteValue(e.target.value)} rows={16} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Category | Preference&#10;---------|------------&#10;Work Structure | LIKE: High autonomy over how I solve problems" />
          <div className="flex items-center gap-3">
            <button onClick={() => handleSaveClick(pasteValue)} disabled={!pasteValue.trim() || saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save to Profile'}</button>
            {saveMsg && <span className="text-sm text-green-600">{saveMsg}</span>}
          </div>
        </div>
      )}

      {/* Chat mode */}
      {mode === 'chat' && (
        <div className="flex flex-col h-[calc(100vh-200px)]">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setMode(savedRubric ? 'view' : 'choose')} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
            <button onClick={resetConversation} className="text-sm text-red-400 hover:text-red-600">Start over</button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm'}`}>{msg.content}</div>
              </div>
            ))}
            {loading && <div className="flex justify-start"><div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-gray-500">Thinking…</div></div>}
            <div ref={chatEndRef} />
          </div>
          {isComplete && (
            <div className="mb-4 border border-green-200 rounded-xl bg-green-50 p-4 space-y-3">
              <p className="text-sm font-medium text-green-800">✅ Conversation complete — review and edit your rubric before saving:</p>
              <textarea value={rubricDraft} onChange={e => setRubricDraft(e.target.value)} rows={12} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="flex items-center gap-3">
                <button onClick={() => handleSaveClick(rubricDraft)} disabled={!rubricDraft.trim() || saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save to Profile'}</button>
                {saveMsg && <span className="text-sm text-green-700">{saveMsg}</span>}
              </div>
            </div>
          )}
          {!isComplete && (
            <div className="flex gap-2">
              <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()} disabled={loading} placeholder="Type your message…" className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" />
              <button onClick={sendMessage} disabled={!input.trim() || loading} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Send</button>
            </div>
          )}
        </div>
      )}

      {showSaveWarning && <CostWarningDialog onConfirm={() => saveRubric(pendingSaveContent)} onCancel={() => setShowSaveWarning(false)} />}
      {showAiFlowWarning && <AiFlowWarningDialog onConfirm={startChat} onCancel={() => setShowAiFlowWarning(false)} />}
    </div>
  )
}

function CostWarningDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Reset existing ratings?</h3>
        <p className="text-sm text-gray-600">Changing this rubric will reset all your existing role match ratings. Re-running these analyses will incur additional API costs.</p>
        <div className="flex flex-col gap-2 pt-2">
          <button onClick={onConfirm} className="w-full px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">I understand, save and reset ratings</button>
          <button onClick={onCancel} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">Cancel, don&apos;t change this</button>
        </div>
      </div>
    </div>
  )
}

function AiFlowWarningDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Start a new AI conversation?</h3>
        <p className="text-sm text-gray-600">You already have a saved rubric. Starting a new AI conversation will use API credits, and saving the result will reset all your existing ratings.</p>
        <div className="flex flex-col gap-2 pt-2">
          <button onClick={onConfirm} className="w-full px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">I understand, proceed anyway</button>
          <button onClick={onCancel} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">Cancel, keep my current rubric</button>
        </div>
      </div>
    </div>
  )
}
