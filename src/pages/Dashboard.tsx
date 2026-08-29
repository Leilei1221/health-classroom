import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import Layout from '../components/Layout'
import { Button, Empty, ErrorBox, Field, Spinner, inputClass } from '../components/ui'
import { createClass, listClasses } from '../lib/api'
import { friendlyError } from '../lib/errors'
import type { ClassRow } from '../lib/types'

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

  const [form, setForm] = useState({
    academic_year: currentAcademicYear(),
    semester: 1,
    name: '',
    grade: 1,
    seat_rows: 6,
    seat_cols: 6,
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
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? '取消' : '+ 新增班級'}
        </Button>
      </div>

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

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
            <Field label="座位圖列數">
              <input type="number" min={1} max={20} className={inputClass} value={form.seat_rows}
                onChange={(e) => setForm({ ...form, seat_rows: +e.target.value })} />
            </Field>
            <Field label="座位圖行數">
              <input type="number" min={1} max={20} className={inputClass} value={form.seat_cols}
                onChange={(e) => setForm({ ...form, seat_cols: +e.target.value })} />
            </Field>
          </div>
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
                    座位圖 {c.seat_rows} × {c.seat_cols}
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
