import { Suspense, lazy, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import Layout from '../components/Layout'
import { Button, Empty, ErrorBox, Field, Spinner, inputClass } from '../components/ui'
import { createClass, listClasses } from '../lib/api'
import { friendlyError } from '../lib/errors'
import type { ClassRow } from '../lib/types'

// Excel 解析器約 60kB，只有老師匯入名單時才需要；
// 分開打包，學生開選位頁時不必下載。
const ImportPanel = lazy(() => import('../components/ImportPanel'))

/** 民國學年度：8 月起算新學年 */
function currentAcademicYear(): number {
  const now = new Date()
  const rocYear = now.getFullYear() - 1911
  return now.getMonth() + 1 >= 8 ? rocYear : rocYear - 1
}

export default function Dashboard() {
  const { teacher } = useAuth()
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const [form, setForm] = useState({
    academic_year: currentAcademicYear(),
    semester: 1,
    name: '',
    grade: 1,
    group_count: 7,
    group_capacity: 5,
  })

  const reload = () => {
    setLoading(true)
    listClasses()
      .then(setClasses)
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false))
  }

  useEffect(reload, [])

  const submit = async () => {
    if (!teacher) return
    if (!form.name.trim()) { setError('請輸入班級名稱'); return }
    setError('')
    try {
      await createClass({ ...form, teacher_id: teacher.id, name: form.name.trim() })
      setShowForm(false)
      setForm({ ...form, name: '' })
      reload()
    } catch (e) {
      setError(friendlyError(e))
    }
  }

  const grouped = classes.reduce<Record<string, ClassRow[]>>((acc, c) => {
    const k = `${c.academic_year} 學年度 第 ${c.semester} 學期`
    ;(acc[k] ||= []).push(c)
    return acc
  }, {})

  return (
    <Layout title="我的班級">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">共 {classes.length} 個班級</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setShowImport((v) => !v); setShowForm(false) }}>
            {showImport ? '取消匯入' : '匯入 Excel 名單'}
          </Button>
          <Button onClick={() => { setShowForm((v) => !v); setShowImport(false) }}>
            {showForm ? '取消' : '+ 新增班級'}
          </Button>
        </div>
      </div>

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      {showImport && (
        <div className="mb-6">
          <Suspense fallback={<Spinner label="載入匯入工具…" />}>
            <ImportPanel onDone={reload} />
          </Suspense>
        </div>
      )}

      {showForm && (
        <div className="mb-6 space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="學年度">
              <input type="number" className={inputClass} value={form.academic_year}
                onChange={(e) => setForm({ ...form, academic_year: +e.target.value })} />
            </Field>
            <Field label="學期">
              <select className={inputClass} value={form.semester}
                onChange={(e) => setForm({ ...form, semester: +e.target.value })}>
                <option value={1}>第 1 學期</option>
                <option value={2}>第 2 學期</option>
              </select>
            </Field>
            <Field label="年級">
              <select className={inputClass} value={form.grade}
                onChange={(e) => setForm({ ...form, grade: +e.target.value })}>
                <option value={1}>一年級</option>
                <option value={2}>二年級</option>
                <option value={3}>三年級</option>
              </select>
            </Field>
          </div>
          <Field label="班級名稱">
            <input className={inputClass} placeholder="例：高一忠" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="組數">
              <input type="number" min={1} max={12} className={inputClass} value={form.group_count}
                onChange={(e) => setForm({ ...form, group_count: +e.target.value })} />
            </Field>
            <Field label="每組人數上限">
              <input type="number" min={1} max={10} className={inputClass} value={form.group_capacity}
                onChange={(e) => setForm({ ...form, group_capacity: +e.target.value })} />
            </Field>
          </div>
          <p className="text-xs text-slate-500">
            標準 7 組、每組 5 人（U 字型：左 2、右 2、桌子後端 1）；308 班為 8 組。
          </p>
          <Button onClick={submit}>建立班級</Button>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : classes.length === 0 ? (
        <Empty>還沒有班級，點右上角「新增班級」開始。</Empty>
      ) : (
        Object.entries(grouped).map(([label, rows]) => (
          <section key={label} className="mb-6">
            <h2 className="mb-2 text-sm font-medium text-slate-500">{label}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((c) => (
                <Link key={c.id} to={`/class/${c.id}`}
                  className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-400 hover:shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{c.name}</span>
                    {c.seat_picking_open && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                        選位開放中
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {c.group_count} 組 · 每組 {c.group_capacity} 人
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </Layout>
  )
}
