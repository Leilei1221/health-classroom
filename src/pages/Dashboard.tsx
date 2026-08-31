import { Suspense, lazy, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import Layout from '../components/Layout'
import { Button, Empty, ErrorBox, Field, Spinner, inputClass } from '../components/ui'
import { createClass, deleteClass, listClasses, updateClass } from '../lib/api'
import { friendlyError } from '../lib/errors'
import type { ClassRow } from '../lib/types'

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

  // 編輯班級
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', group_count: 7, group_capacity: 5, grade: 3 })

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

  /** 刪除班級 */
  const handleDelete = async (c: ClassRow) => {
    if (!confirm(`確定要刪除「${c.name}」班級嗎？\n\n⚠️ 該班級底下的所有學生、座位、點名與表現紀錄都會一併刪除，此操作無法復原。`)) return
    setError('')
    try {
      await deleteClass(c.id)
      reload()
    } catch (e) {
      setError(friendlyError(e))
    }
  }

  /** 開始編輯班級 */
  const startEdit = (c: ClassRow) => {
    setEditingId(c.id)
    setEditForm({ name: c.name, group_count: c.group_count, group_capacity: c.group_capacity, grade: c.grade ?? 3 })
  }

  /** 儲存編輯 */
  const saveEdit = async () => {
    if (!editingId) return
    if (!editForm.name.trim()) { setError('班級名稱不能空白'); return }
    setError('')
    try {
      await updateClass(editingId, {
        name: editForm.name.trim(),
        group_count: editForm.group_count,
        group_capacity: editForm.group_capacity,
        grade: editForm.grade,
      })
      setEditingId(null)
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
                <div key={c.id} className="rounded-xl border border-slate-200 bg-white transition hover:border-slate-400 hover:shadow-sm">
                  {/* 編輯模式 */}
                  {editingId === c.id ? (
                    <div className="space-y-3 p-4">
                      <Field label="班級名稱">
                        <input className={inputClass} value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
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
                        <Button onClick={saveEdit}>儲存</Button>
                        <Button variant="ghost" onClick={() => setEditingId(null)}>取消</Button>
                      </div>
                    </div>
                  ) : (
                    /* 一般模式 */
                    <div className="flex items-start justify-between p-4">
                      <Link to={`/class/${c.id}`} className="flex-1">
                        <div className="flex items-center gap-2">
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
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={(e) => { e.preventDefault(); startEdit(c) }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                          title="編輯班級"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                            <path d="m15 5 4 4"/>
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); handleDelete(c) }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                          title="刪除班級"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </Layout>
  )
}
