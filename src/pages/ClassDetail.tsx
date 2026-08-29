import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import Layout from '../components/Layout'
import LessonPanel from '../components/LessonPanel'
import RosterPanel from '../components/RosterPanel'
import ScorePanel from '../components/ScorePanel'
import SeatPanel from '../components/SeatPanel'
import { ErrorBox, Spinner } from '../components/ui'
import { getClass } from '../lib/api'
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
  const { teacher } = useAuth()
  const [cls, setCls] = useState<ClassRow | null>(null)
  const [tab, setTab] = useState<TabKey>('lesson')
  const [error, setError] = useState('')

  useEffect(() => {
    getClass(id).then(setCls).catch((e) => setError(friendlyError(e)))
  }, [id])

  if (error) return <Layout title="班級" back="/"><ErrorBox message={error} /></Layout>
  if (!cls || !teacher) return <Layout title="班級" back="/"><Spinner /></Layout>

  return (
    <Layout title={`${cls.name}（${cls.academic_year} 學年 第 ${cls.semester} 學期）`} back="/">
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
