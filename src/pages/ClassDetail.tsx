import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import Layout from '../components/Layout'
import LessonPanel from '../components/LessonPanel'
import RosterPanel from '../components/RosterPanel'
import ScorePanel from '../components/ScorePanel'
import SeatPanel from '../components/SeatPanel'
import { Button, ErrorBox, Field, Spinner, inputClass } from '../components/ui'
import { deleteClass, getClass, updateClass } from '../lib/api'
import { friendlyError } from '../lib/errors'
import type { ClassRow } from '../lib/types'

const TABS = [
  { key: 'lesson', label: '點名與表現' },
  { key: 'seat', label: '座位圖' },
  { key: 'roster', label: '學生名單' },
  { key: 'score', label: '成績統計' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function ClassDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { teacher } = useAuth()
  const [cls, setCls] = useState<ClassRow | null>(null)
  const [tab, setTab] = useState<TabKey>('lesson')
  const [error, setError] = useState('')

  // 班級設定
  const [showSettings, setShowSettings] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', group_count: 7, group_capacity: 5 })

  useEffect(() => {
    getClass(id).then(setCls).catch((e) => setError(friendlyError(e)))
  }, [id])

  const openSettings = () => {
    if (!cls) return
    setEditForm({ name: cls.name, group_count: cls.group_count, group_capacity: cls.group_capacity })
    setShowSettings(true)
  }

  const saveSettings = async () => {
    if (!cls) return
    if (!editForm.name.trim()) { setError('班級名稱不能空白'); return }
    setError('')
    try {
      const updated = await updateClass(cls.id, {
        name: editForm.name.trim(),
        group_count: editForm.group_count,
        group_capacity: editForm.group_capacity,
      })
      setCls(updated)
      setShowSettings(false)
    } catch (e) {
      setError(friendlyError(e))
    }
  }

  const handleDeleteClass = async () => {
    if (!cls) return
    if (!confirm(`確定要刪除「${cls.name}」班級嗎？\n\n⚠️ 該班級底下的所有學生、座位、點名與表現紀錄都會一併刪除，此操作無法復原。`)) return
    try {
      await deleteClass(cls.id)
      navigate('/', { replace: true })
    } catch (e) {
      setError(friendlyError(e))
    }
  }

  if (error && !cls) return <Layout title="班級" back="/"><ErrorBox message={error} /></Layout>
  if (!cls || !teacher) return <Layout title="班級" back="/"><Spinner /></Layout>

  return (
    <Layout title={`${cls.name}（${cls.academic_year} 學年 第 ${cls.semester} 學期）`} back="/">
      {/* 班級操作列 */}
      <div className="mb-4 flex items-center justify-end gap-2">
        <button
          onClick={openSettings}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
            <path d="m15 5 4 4"/>
          </svg>
          編輯班級
        </button>
        <button
          onClick={handleDeleteClass}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          </svg>
          刪除班級
        </button>
      </div>

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      {/* 編輯班級設定面板 */}
      {showSettings && (
        <div className="mb-6 space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-medium text-slate-700">編輯班級設定</h3>
          <Field label="班級名稱">
            <input className={inputClass} value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="組數">
              <input type="number" min={1} max={12} className={inputClass} value={editForm.group_count}
                onChange={(e) => setEditForm({ ...editForm, group_count: +e.target.value })} />
            </Field>
            <Field label="每組人數上限">
              <input type="number" min={1} max={10} className={inputClass} value={editForm.group_capacity}
                onChange={(e) => setEditForm({ ...editForm, group_capacity: +e.target.value })} />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button onClick={saveSettings}>儲存變更</Button>
            <Button variant="ghost" onClick={() => setShowSettings(false)}>取消</Button>
          </div>
        </div>
      )}

      <div className="mb-5 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'lesson' && <LessonPanel classId={cls.id} teacherId={teacher.id} />}
      {tab === 'seat' && <SeatPanel cls={cls} onClassChange={setCls} />}
      {tab === 'roster' && <RosterPanel classId={cls.id} />}
      {tab === 'score' && <ScorePanel classId={cls.id} className={cls.name} />}
    </Layout>
  )
}
