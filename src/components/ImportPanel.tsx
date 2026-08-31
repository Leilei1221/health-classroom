import { useRef, useState } from 'react'
import { Button, ErrorBox, Field, inputClass } from './ui'
import { importRoster } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { parseRosterFile, suggestGroupCount, type ParsedRoster } from '../lib/rosterFile'
import type { ImportResult } from '../lib/types'

function currentAcademicYear(): number {
  const now = new Date()
  const rocYear = now.getFullYear() - 1911
  return now.getMonth() + 1 >= 8 ? rocYear : rocYear - 1
}

interface ClassSetting {
  name: string
  group_count: number
  group_capacity: number
}

/** 上傳 Excel 名單 → 預覽 → 確認後建立班級與學生 */
export default function ImportPanel({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<ParsedRoster | null>(null)
  const [filename, setFilename] = useState('')
  const [settings, setSettings] = useState<ClassSetting[]>([])
  const [term, setTerm] = useState({ academic_year: currentAcademicYear(), semester: 1 })
  const [defaults] = useState({ group_count: 7, group_capacity: 5 })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const onFile = async (file: File) => {
    setError(''); setResult(null)
    try {
      const p = await parseRosterFile(file)
      setParsed(p)
      setFilename(file.name)
      setSettings(
        p.classNames.map((name) => ({
          name,
          group_count: suggestGroupCount(name, defaults.group_count),
          group_capacity: defaults.group_capacity,
        })),
      )
    } catch (e) {
      setParsed(null)
      setError(friendlyError(e))
    }
  }

  const submit = async () => {
    if (!parsed) return
    setBusy(true); setError('')
    try {
      const res = await importRoster({
        academic_year: term.academic_year,
        semester: term.semester,
        filename,
        default_group_count: defaults.group_count,
        default_group_capacity: defaults.group_capacity,
        classes: settings,
        rows: parsed.rows,
      })
      setResult(res)
      setParsed(null)
      if (fileRef.current) fileRef.current.value = ''
      onDone()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const patch = (name: string, key: 'group_count' | 'group_capacity', value: number) =>
    setSettings((prev) => prev.map((s) => (s.name === name ? { ...s, [key]: value } : s)))

  const countFor = (name: string) => parsed?.rows.filter((r) => r.class_name === name).length ?? 0

  return (
    <div className="space-y-4">
      {error && <ErrorBox message={error} />}

      {result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          匯入完成：新建 {result.classes_created} 個班級，新增 {result.inserted} 位、
          更新 {result.updated} 位學生。
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">
          上傳 Excel（.xlsx）或 CSV 名單，需包含<strong>班級、座號、學號、姓名</strong>四欄，
          第一列為標題列。系統會依「班級」欄自動建立班級；學號相同者更新資料，不會重複建立。
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="學年度">
            <input type="number" className={inputClass} value={term.academic_year}
              onChange={(e) => setTerm({ ...term, academic_year: +e.target.value })} />
          </Field>
          <Field label="學期">
            <select className={inputClass} value={term.semester}
              onChange={(e) => setTerm({ ...term, semester: +e.target.value })}>
              <option value={1}>第 1 學期</option>
              <option value={2}>第 2 學期</option>
            </select>
          </Field>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.csv"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f) }}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
        />
      </div>

      {parsed && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <h3 className="text-sm font-medium">
              偵測到 {parsed.classNames.length} 個班級，共 {parsed.rows.length} 位學生
            </h3>
            {parsed.skipped > 0 && (
              <p className="mt-1 text-xs text-amber-700">
                有 {parsed.skipped} 列因缺少班級／學號／姓名而略過。
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              組數可逐班調整，確認無誤後再匯入。
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-2 py-2">班級</th>
                  <th className="px-2 py-2">人數</th>
                  <th className="px-2 py-2">組數</th>
                  <th className="px-2 py-2">每組人數上限</th>
                </tr>
              </thead>
              <tbody>
                {settings.map((s) => (
                  <tr key={s.name} className="border-b border-slate-100 last:border-0">
                    <td className="px-2 py-2 font-medium">{s.name}</td>
                    <td className="px-2 py-2 text-slate-500">{countFor(s.name)}</td>
                    <td className="px-2 py-2">
                      <input type="number" min={1} max={12}
                        className={`${inputClass} w-24`} value={s.group_count}
                        onChange={(e) => patch(s.name, 'group_count', +e.target.value)} />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min={1} max={10}
                        className={`${inputClass} w-24`} value={s.group_capacity}
                        onChange={(e) => patch(s.name, 'group_capacity', +e.target.value)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-slate-600">預覽前 10 筆資料</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="px-2 py-1">班級</th>
                    <th className="px-2 py-1">座號</th>
                    <th className="px-2 py-1">學號</th>
                    <th className="px-2 py-1">姓名</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-2 py-1">{r.class_name}</td>
                      <td className="px-2 py-1">{r.seat_no || '—'}</td>
                      <td className="px-2 py-1 font-mono">{r.student_no}</td>
                      <td className="px-2 py-1">{r.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <div className="flex gap-2">
            <Button onClick={submit} disabled={busy}>
              {busy ? '匯入中…' : `確認匯入 ${parsed.rows.length} 位學生`}
            </Button>
            <Button variant="secondary" onClick={() => { setParsed(null); setError('') }}>
              取消
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
