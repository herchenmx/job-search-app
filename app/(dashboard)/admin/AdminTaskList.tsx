'use client'

import { useState, useMemo } from 'react'
import { AdminTask, AdminTaskStatus, AdminTaskPriority, AdminTaskCategory } from '@/types'

export interface Commit {
  sha: string
  shortSha: string
  message: string
  date: string
  url: string
  branch: string | null
}

const STATUS_OPTIONS: AdminTaskStatus[] = ['backlog', 'in-progress', 'done', 'archived']
const PRIORITY_OPTIONS: AdminTaskPriority[] = ['high', 'medium', 'low']
const CATEGORY_OPTIONS: AdminTaskCategory[] = ['feature', 'bug', 'improvement', 'debt']

const STATUS_COLOURS: Record<AdminTaskStatus, string> = {
  'backlog': 'bg-gray-100 text-gray-600',
  'in-progress': 'bg-blue-100 text-blue-700',
  'done': 'bg-green-100 text-green-700',
  'archived': 'bg-amber-100 text-amber-700',
}

const PRIORITY_COLOURS: Record<AdminTaskPriority, string> = {
  'high': 'bg-red-100 text-red-700',
  'medium': 'bg-yellow-100 text-yellow-700',
  'low': 'bg-gray-100 text-gray-500',
}

const CATEGORY_ICONS: Record<AdminTaskCategory, string> = {
  'feature': '✨',
  'bug': '🐛',
  'improvement': '📈',
  'debt': '🔧',
}

const STATUS_LABELS: Record<AdminTaskStatus, string> = {
  'backlog': 'Backlog',
  'in-progress': 'In Progress',
  'done': 'Done',
  'archived': 'Archived',
}

const NEXT_STATUS: Record<AdminTaskStatus, AdminTaskStatus> = {
  'backlog': 'in-progress',
  'in-progress': 'done',
  'done': 'archived',
  'archived': 'backlog',
}

const GITHUB_REPO = 'https://github.com/herchenmx/job-search-app'

// Sections that are collapsible
const COLLAPSIBLE_SECTIONS: AdminTaskStatus[] = ['backlog', 'done']

export default function AdminTaskList({
  initialTasks,
  commits,
}: {
  initialTasks: AdminTask[]
  commits: Commit[]
}) {
  const [tasks, setTasks] = useState<AdminTask[]>(initialTasks)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [search, setSearch] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState(false)

  // Collapsible sections state
  const [collapsedSections, setCollapsedSections] = useState<Set<AdminTaskStatus>>(new Set())

  // Add form state
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newStatus, setNewStatus] = useState<AdminTaskStatus>('backlog')
  const [newPriority, setNewPriority] = useState<AdminTaskPriority>('medium')
  const [newCategory, setNewCategory] = useState<AdminTaskCategory>('feature')
  const [newCommitShas, setNewCommitShas] = useState<string[]>([])

  // Edit form state
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editStatus, setEditStatus] = useState<AdminTaskStatus>('backlog')
  const [editPriority, setEditPriority] = useState<AdminTaskPriority>('medium')
  const [editCategory, setEditCategory] = useState<AdminTaskCategory>('feature')
  const [editCommitShas, setEditCommitShas] = useState<string[]>([])

  // Build commit lookup for display
  const commitMap = useMemo(() => {
    const map = new Map<string, Commit>()
    for (const c of commits) {
      map.set(c.shortSha, c)
      map.set(c.sha, c)
    }
    return map
  }, [commits])

  // Build reverse lookup: sha -> task id
  const shaToTaskId = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of tasks) {
      for (const sha of (t.commit_shas || [])) {
        map.set(sha, t.id)
      }
    }
    return map
  }, [tasks])

  // Commits not yet linked to any task (for dropdown)
  const unlinkedCommits = useMemo(() => {
    return commits.filter(c => !shaToTaskId.has(c.shortSha))
  }, [commits, shaToTaskId])

  // Filter pipeline
  const filteredTasks = useMemo(() => {
    let result = [...tasks]
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      )
    }
    if (filterStatus) result = result.filter(t => t.status === filterStatus)
    if (filterCategory) result = result.filter(t => t.category === filterCategory)
    return result
  }, [tasks, search, filterStatus, filterCategory])

  // Group by status
  const grouped = useMemo(() => {
    const groups: Record<string, AdminTask[]> = {}
    for (const status of STATUS_OPTIONS) {
      const statusTasks = filteredTasks.filter(t => t.status === status)
      if (statusTasks.length > 0) groups[status] = statusTasks
    }
    return groups
  }, [filteredTasks])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const s of STATUS_OPTIONS) c[s] = tasks.filter(t => t.status === s).length
    return c
  }, [tasks])

  // Global task numbering: assign a sequential number to each task based on position in the full list
  const taskNumberMap = useMemo(() => {
    const map = new Map<string, number>()
    tasks.forEach((t, i) => map.set(t.id, i + 1))
    return map
  }, [tasks])

  // Multi-select helpers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllInStatus = (status: AdminTaskStatus) => {
    const ids = filteredTasks.filter(t => t.status === status).map(t => t.id)
    setSelectedIds(prev => {
      const next = new Set(prev)
      const allSelected = ids.every(id => next.has(id))
      if (allSelected) {
        ids.forEach(id => next.delete(id))
      } else {
        ids.forEach(id => next.add(id))
      }
      return next
    })
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
    setBulkAction(false)
  }

  // Selected tasks that are NOT done (eligible for bulk status change)
  const selectedForStatusChange = useMemo(() => {
    return tasks.filter(t => selectedIds.has(t.id) && t.status !== 'done')
  }, [tasks, selectedIds])

  const handleBulkStatusChange = async (newStatus: AdminTaskStatus) => {
    const eligibleIds = selectedForStatusChange.map(t => t.id)
    if (eligibleIds.length === 0) return
    setSaving(true)
    try {
      await Promise.all(
        eligibleIds.map(id =>
          fetch('/api/admin/tasks', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: newStatus }),
          })
        )
      )
      setTasks(prev =>
        prev.map(t => eligibleIds.includes(t.id) ? { ...t, status: newStatus } : t)
      )
      clearSelection()
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setSaving(true)
    try {
      await Promise.all(
        ids.map(id =>
          fetch('/api/admin/tasks', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          })
        )
      )
      setTasks(prev => prev.filter(t => !selectedIds.has(t.id)))
      clearSelection()
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  // Toggle collapsed section
  const toggleCollapse = (status: AdminTaskStatus) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  // CRUD handlers
  const handleCreate = async () => {
    if (!newTitle.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription || null,
          status: newStatus,
          priority: newPriority,
          category: newCategory,
          commit_shas: newCommitShas,
        }),
      })
      if (res.ok) {
        const task: AdminTask = await res.json()
        setTasks(prev => [...prev, task])
        setNewTitle('')
        setNewDescription('')
        setNewStatus('backlog')
        setNewPriority('medium')
        setNewCategory('feature')
        setNewCommitShas([])
        setShowAddForm(false)
      }
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (id: string, updates: Partial<AdminTask>) => {
    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      })
      if (res.ok) {
        const updated: AdminTask = await res.json()
        setTasks(prev => prev.map(t => t.id === id ? updated : t))
      }
    } catch {
      // ignore
    }
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editTitle.trim() || saving) return
    setSaving(true)
    await handleUpdate(editingId, {
      title: editTitle,
      description: editDescription || null,
      status: editStatus,
      priority: editPriority,
      category: editCategory,
      commit_shas: editCommitShas,
    })
    setEditingId(null)
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setTasks(prev => prev.filter(t => t.id !== id))
        setDeletingId(null)
      }
    } catch {
      // ignore
    }
  }

  const handleStatusCycle = async (task: AdminTask) => {
    const next = NEXT_STATUS[task.status]
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t))
    await handleUpdate(task.id, { status: next })
  }

  const startEdit = (task: AdminTask) => {
    setEditingId(task.id)
    setEditTitle(task.title)
    setEditDescription(task.description || '')
    setEditStatus(task.status)
    setEditPriority(task.priority)
    setEditCategory(task.category)
    setEditCommitShas(task.commit_shas || [])
  }

  // Commit picker helpers
  const addCommitToNew = (sha: string) => {
    if (!newCommitShas.includes(sha)) setNewCommitShas(prev => [...prev, sha])
  }
  const removeCommitFromNew = (sha: string) => {
    setNewCommitShas(prev => prev.filter(s => s !== sha))
  }
  const addCommitToEdit = (sha: string) => {
    if (!editCommitShas.includes(sha)) setEditCommitShas(prev => [...prev, sha])
  }
  const removeCommitFromEdit = (sha: string) => {
    setEditCommitShas(prev => prev.filter(s => s !== sha))
  }

  // Available commits for picker (unlinked + currently selected)
  const availableForNew = useMemo(() => {
    const selected = new Set(newCommitShas)
    return commits.filter(c => !shaToTaskId.has(c.shortSha) || selected.has(c.shortSha))
  }, [commits, shaToTaskId, newCommitShas])

  const availableForEdit = useMemo(() => {
    if (!editingId) return []
    const selected = new Set(editCommitShas)
    return commits.filter(c => {
      const linkedTo = shaToTaskId.get(c.shortSha)
      return !linkedTo || linkedTo === editingId || selected.has(c.shortSha)
    })
  }, [commits, shaToTaskId, editCommitShas, editingId])

  const isMultiSelectMode = selectedIds.size > 0

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search tasks…"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 text-gray-900"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-sm text-gray-900 border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]} ({counts[s] || 0})</option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="text-sm text-gray-900 border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map(c => (
            <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>
          ))}
        </select>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="ml-auto bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          {showAddForm ? 'Cancel' : '+ New task'}
        </button>
      </div>

      {/* Bulk action bar */}
      {isMultiSelectMode && (
        <div className="flex items-center gap-3 mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex-wrap">
          <span className="text-sm font-medium text-blue-900">
            {selectedIds.size} task{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {selectedForStatusChange.length > 0 && (
              <>
                <span className="text-xs text-blue-600">Move to:</span>
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => handleBulkStatusChange(s)}
                    disabled={saving}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors disabled:opacity-50 ${STATUS_COLOURS[s]} hover:opacity-80`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
                <span className="text-gray-300">|</span>
              </>
            )}
            {!bulkAction ? (
              <button
                onClick={() => setBulkAction(true)}
                disabled={saving}
                className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors disabled:opacity-50"
              >
                Delete selected
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-xs text-red-600">Delete {selectedIds.size} task{selectedIds.size > 1 ? 's' : ''}?</span>
                <button
                  onClick={handleBulkDelete}
                  disabled={saving}
                  className="text-xs text-red-700 font-semibold hover:text-red-800 transition-colors disabled:opacity-50"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setBulkAction(false)}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  No
                </button>
              </div>
            )}
            <span className="text-gray-300">|</span>
            <button
              onClick={clearSelection}
              className="text-xs text-gray-600 hover:text-gray-800 transition-colors"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">New Task</h3>
          <div className="space-y-3">
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Task title"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <textarea
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 resize-none"
            />
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={newStatus}
                onChange={e => setNewStatus(e.target.value as AdminTaskStatus)}
                className="text-sm text-gray-900 border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
              <select
                value={newPriority}
                onChange={e => setNewPriority(e.target.value as AdminTaskPriority)}
                className="text-sm text-gray-900 border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PRIORITY_OPTIONS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value as AdminTaskCategory)}
                className="text-sm text-gray-900 border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORY_OPTIONS.map(c => (
                  <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>
                ))}
              </select>
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim() || saving}
                className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Adding…' : 'Add task'}
              </button>
            </div>
            {/* Commit picker */}
            <CommitPicker
              selected={newCommitShas}
              available={availableForNew}
              commitMap={commitMap}
              onAdd={addCommitToNew}
              onRemove={removeCommitFromNew}
            />
          </div>
        </div>
      )}

      {/* Empty state */}
      {tasks.length === 0 && !showAddForm && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-4xl mb-3">📋</p>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No tasks yet</h3>
          <p className="text-gray-500 text-sm mb-4">
            Create tasks to track features, bugs, and improvements.
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="text-blue-600 text-sm font-medium hover:underline"
          >
            Create your first task →
          </button>
        </div>
      )}

      {/* No results from filtering */}
      {tasks.length > 0 && filteredTasks.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 text-sm">No tasks match your filters.</p>
        </div>
      )}

      {/* Grouped task list */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([status, statusTasks]) => {
          const typedStatus = status as AdminTaskStatus
          const isCollapsible = COLLAPSIBLE_SECTIONS.includes(typedStatus)
          const isCollapsed = collapsedSections.has(typedStatus)
          const allInStatusSelected = statusTasks.every(t => selectedIds.has(t.id))

          return (
            <div key={status}>
              <div className="flex items-center gap-2 mb-2">
                {isCollapsible ? (
                  <button
                    onClick={() => toggleCollapse(typedStatus)}
                    className="flex items-center gap-2 group"
                  >
                    <svg
                      className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <h3 className="text-sm font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">
                      {STATUS_LABELS[typedStatus]}
                    </h3>
                  </button>
                ) : (
                  <h3 className="text-sm font-semibold text-gray-700">
                    {STATUS_LABELS[typedStatus]}
                  </h3>
                )}
                <span className="text-xs text-gray-400">{statusTasks.length}</span>
                {/* Group select all checkbox */}
                <button
                  onClick={() => selectAllInStatus(typedStatus)}
                  className="ml-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  title={allInStatusSelected ? 'Deselect all in this group' : 'Select all in this group'}
                >
                  {allInStatusSelected ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              {!isCollapsed && (
                <div className="space-y-2">
                  {statusTasks.map(task => {
                    const taskNum = taskNumberMap.get(task.id)
                    const isSelected = selectedIds.has(task.id)

                    return (
                      <div
                        key={task.id}
                        className={`bg-white border rounded-xl p-4 transition-colors ${
                          isSelected
                            ? 'border-blue-300 bg-blue-50/30'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {editingId === task.id ? (
                          /* Edit mode */
                          <div className="space-y-3">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={e => setEditTitle(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                            />
                            <textarea
                              value={editDescription}
                              onChange={e => setEditDescription(e.target.value)}
                              placeholder="Description (optional)"
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 resize-none"
                            />
                            <div className="flex items-center gap-3 flex-wrap">
                              <select
                                value={editStatus}
                                onChange={e => setEditStatus(e.target.value as AdminTaskStatus)}
                                className="text-sm text-gray-900 border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                {STATUS_OPTIONS.map(s => (
                                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                ))}
                              </select>
                              <select
                                value={editPriority}
                                onChange={e => setEditPriority(e.target.value as AdminTaskPriority)}
                                className="text-sm text-gray-900 border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                {PRIORITY_OPTIONS.map(p => (
                                  <option key={p} value={p}>{p}</option>
                                ))}
                              </select>
                              <select
                                value={editCategory}
                                onChange={e => setEditCategory(e.target.value as AdminTaskCategory)}
                                className="text-sm text-gray-900 border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                {CATEGORY_OPTIONS.map(c => (
                                  <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>
                                ))}
                              </select>
                              <div className="flex items-center gap-2 ml-auto">
                                <button
                                  onClick={handleSaveEdit}
                                  disabled={!editTitle.trim() || saving}
                                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                                >
                                  {saving ? 'Saving…' : 'Save'}
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                            <CommitPicker
                              selected={editCommitShas}
                              available={availableForEdit}
                              commitMap={commitMap}
                              onAdd={addCommitToEdit}
                              onRemove={removeCommitFromEdit}
                            />
                          </div>
                        ) : (
                          /* View mode */
                          <div className="flex items-start justify-between gap-3">
                            {/* Checkbox for multi-select */}
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(task.id)}
                              className="mt-1 shrink-0 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-xs font-mono text-gray-400 shrink-0">#{taskNum}</span>
                                <span className="text-sm font-medium text-gray-900">{task.title}</span>
                                <button
                                  onClick={() => handleStatusCycle(task)}
                                  className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer hover:opacity-80 transition-opacity ${STATUS_COLOURS[task.status]}`}
                                  title={`Click to move to ${STATUS_LABELS[NEXT_STATUS[task.status]]}`}
                                >
                                  {STATUS_LABELS[task.status]}
                                </button>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOURS[task.priority]}`}>
                                  {task.priority}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {CATEGORY_ICONS[task.category]} {task.category}
                                </span>
                              </div>
                              {task.description && (
                                <p className="text-sm text-gray-500 line-clamp-2">{task.description}</p>
                              )}
                              {/* Linked commits */}
                              {task.commit_shas && task.commit_shas.length > 0 && (
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  <span className="text-xs text-gray-400">Commits:</span>
                                  {task.commit_shas.map(sha => {
                                    const commit = commitMap.get(sha)
                                    return (
                                      <a
                                        key={sha}
                                        href={commit?.url || `${GITHUB_REPO}/commit/${sha}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-mono bg-gray-50 text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded border border-gray-200 transition-colors"
                                        title={commit?.message || sha}
                                      >
                                        {sha}
                                      </a>
                                    )
                                  })}
                                </div>
                              )}
                              <p className="text-xs text-gray-400 mt-1">
                                {new Date(task.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => startEdit(task)}
                                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                              >
                                Edit
                              </button>
                              {deletingId === task.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleDelete(task.id)}
                                    className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setDeletingId(null)}
                                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeletingId(task.id)}
                                  className="text-xs text-red-500 hover:text-red-700 transition-colors"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary footer */}
      {tasks.length > 0 && (
        <div className="mt-6 text-xs text-gray-400 text-center">
          {counts['backlog'] || 0} backlog · {counts['in-progress'] || 0} in progress · {counts['done'] || 0} done · {counts['archived'] || 0} archived · {tasks.length} total
        </div>
      )}
    </div>
  )
}

/* Commit picker sub-component */
function CommitPicker({
  selected,
  available,
  commitMap,
  onAdd,
  onRemove,
}: {
  selected: string[]
  available: Commit[]
  commitMap: Map<string, Commit>
  onAdd: (sha: string) => void
  onRemove: (sha: string) => void
}) {
  const unselected = available.filter(c => !selected.includes(c.shortSha))

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">Linked commits</label>
      {/* Selected commits */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map(sha => {
            const commit = commitMap.get(sha)
            return (
              <span
                key={sha}
                className="inline-flex items-center gap-1 text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200"
              >
                {sha}
                <span className="text-blue-400 max-w-[200px] truncate">
                  {commit ? ` ${commit.message}` : ''}
                </span>
                <button
                  onClick={() => onRemove(sha)}
                  className="text-blue-400 hover:text-blue-700 ml-0.5"
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
      )}
      {/* Dropdown to add */}
      {unselected.length > 0 && (
        <select
          onChange={e => { if (e.target.value) { onAdd(e.target.value); e.target.value = '' } }}
          className="text-xs text-gray-900 border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
          defaultValue=""
        >
          <option value="">Link a commit…</option>
          {unselected.map(c => (
            <option key={c.shortSha} value={c.shortSha}>
              {c.shortSha} — {c.message.slice(0, 80)}
            </option>
          ))}
        </select>
      )}
      {selected.length === 0 && unselected.length === 0 && (
        <p className="text-xs text-gray-400 italic">No commits available to link.</p>
      )}
    </div>
  )
}
