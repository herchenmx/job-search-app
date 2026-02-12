'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Mode = 'choose' | 'paste' | 'chat'
type Message = { role: 'user' | 'assistant'; content: string }

export default function CultureRubricPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<Mode>('choose')
  const [pasteValue, setPasteValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [rubricDraft, setRubricDraft] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Load existing conversation on mount
  useEffect(() => {
    async function loadConversation() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'culture_rubric')
        .single()

      if (data) {
        setConversationId(data.id)
        setMessages(data.messages as Message[])
        if (data.status === 'completed') {
          setIsComplete(true)
          // Extract the rubric summary from the last assistant message
          const lastAssistant = [...data.messages]
            .reverse()
            .find((m: Message) => m.role === 'assistant')
          if (lastAssistant) {
            const match = lastAssistant.content.match(/## YOUR WORKPLACE FIT PROFILE[\s\S]*/m)
            if (match) setRubricDraft(match[0])
          }
        }
      }
    }
    loadConversation()
  }, [])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Start chat — send empty message to get first AI message
  async function startChat() {
    setMode('chat')
    if (messages.length > 0) return // already have a conversation
    setLoading(true)
    try {
      const res = await fetch('/api/chat/culture-rubric', {
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
      const res = await fetch('/api/chat/culture-rubric', {
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
        const match = data.message.match(/## YOUR WORKPLACE FIT PROFILE[\s\S]*/m)
        if (match) setRubricDraft(match[0])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function saveRubric(content: string) {
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
          .update({ culture_preferences_rubric: content, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
      } else {
        await supabase
          .from('user_profiles')
          .insert({ user_id: user.id, culture_preferences_rubric: content })
      }

      // Reset reanalysis flag on all user's companies so cron picks them up again
      await supabase
        .from('companies')
        .update({ needs_culture_reanalysis: false, cultural_match_rate: null, cultural_match_insights: null })
        .eq('user_id', user.id)
        .eq('needs_culture_reanalysis', true)

      setSaveMsg('Saved!')
      setTimeout(() => router.push('/profile'), 1200)
    } catch (e) {
      setSaveMsg('Error saving. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function resetConversation() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from('ai_conversations')
      .delete()
      .eq('user_id', user.id)
      .eq('type', 'culture_rubric')
    setMessages([])
    setConversationId(null)
    setIsComplete(false)
    setRubricDraft('')
    setMode('choose')
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.push('/profile')}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ← Profile
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Culture Preferences Rubric</h1>
      </div>

      {/* Mode: Choose */}
      {mode === 'choose' && (
        <div className="space-y-4">
          <p className="text-gray-600">How would you like to create your culture preferences rubric?</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              onClick={() => setMode('paste')}
              className="flex flex-col items-start p-6 border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition text-left"
            >
              <span className="text-2xl mb-2">📋</span>
              <span className="font-semibold text-gray-900 mb-1">Paste existing rubric</span>
              <span className="text-sm text-gray-500">You already have your preferences written — paste them in markdown format.</span>
            </button>
            <button
              onClick={startChat}
              className="flex flex-col items-start p-6 border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition text-left"
            >
              <span className="text-2xl mb-2">💬</span>
              <span className="font-semibold text-gray-900 mb-1">Discover with AI</span>
              <span className="text-sm text-gray-500">Have a guided conversation to uncover what you really need in a workplace.</span>
            </button>
          </div>
          {/* Resume banner if conversation exists */}
          {messages.length > 0 && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
              <span className="text-sm text-yellow-800">
                {isComplete ? '✅ You have a completed conversation.' : '⏸ You have an in-progress conversation.'}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('chat')}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {isComplete ? 'Review' : 'Resume'}
                </button>
                <button
                  onClick={resetConversation}
                  className="text-sm text-red-500 hover:underline"
                >
                  Start over
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode: Paste */}
      {mode === 'paste' && (
        <div className="space-y-4">
          <button onClick={() => setMode('choose')} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
          <label className="block text-sm font-medium text-gray-700">
            Paste your culture preferences rubric (markdown)
          </label>
          <textarea
            value={pasteValue}
            onChange={e => setPasteValue(e.target.value)}
            rows={16}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="## Culture Preferences&#10;&#10;### Must-Haves&#10;- ..."
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => saveRubric(pasteValue)}
              disabled={!pasteValue.trim() || saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save to Profile'}
            </button>
            {saveMsg && <span className="text-sm text-green-600">{saveMsg}</span>}
          </div>
        </div>
      )}

      {/* Mode: Chat */}
      {mode === 'chat' && (
        <div className="flex flex-col h-[calc(100vh-200px)]">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setMode('choose')} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
            <button onClick={resetConversation} className="text-sm text-red-400 hover:text-red-600">Start over</button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-gray-500">
                  Thinking…
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Save rubric section — shown when complete */}
          {isComplete && (
            <div className="mb-4 border border-green-200 rounded-xl bg-green-50 p-4 space-y-3">
              <p className="text-sm font-medium text-green-800">✅ Conversation complete — review and edit your rubric before saving:</p>
              <textarea
                value={rubricDraft}
                onChange={e => setRubricDraft(e.target.value)}
                rows={12}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={() => saveRubric(rubricDraft)}
                  disabled={!rubricDraft.trim() || saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save to Profile'}
                </button>
                {saveMsg && <span className="text-sm text-green-700">{saveMsg}</span>}
              </div>
            </div>
          )}

          {/* Input */}
          {!isComplete && (
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                disabled={loading}
                placeholder="Type your message…"
                className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}