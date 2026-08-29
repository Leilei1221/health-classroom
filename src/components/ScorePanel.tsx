import { useEffect, useState } from 'react'
import { Button, Empty, ErrorBox, Spinner } from './ui'
import { listScores } from '../lib/api'
import { friendlyError } from '../lib/errors'
import type { StudentScore } from '../lib/types'

function toCsv(rows: StudentScore[]): string {
  const head = ['座號', '學號', '姓名', '出缺席分', '表現分', '總分', '遲到次數', '曠課次數']
  const body = rows.map((r) => [
    r.seat_no ?? '', r.student_no, r.name,
    r.attendance_points, r.performance_points, r.total_points,
    r.late_count, r.absent_count,
  ])
  return [head, ...body].map((r) => r.join(',')).join('\n')
}

export default function ScorePanel({ classId, className }: {
  classId: string
  className: string
}) {
  const [scores, setScores] = useState<StudentScore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    listScores(classId)
      .then(setScores)
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false))
  }, [classId])

  const download = () => {
    // 加上 BOM，Excel 開啟才不會把中文變亂碼
    const blob = new Blob(['﻿' + toCsv(scores)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${className}_成績統計.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (loading) return <Spinner />
  if (error) return <ErrorBox message={error} />
  if (scores.length === 0) return <Empty>還沒有資料。</Empty>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          總分 = 出缺席加扣分 + 上課表現加扣分
        </p>
        <Button variant="secondary" onClick={download}>下載 CSV</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">座號</th>
              <th className="px-3 py-2">姓名</th>
              <th className="px-3 py-2 text-right">出缺席</th>
              <th className="px-3 py-2 text-right">表現</th>
              <th className="px-3 py-2 text-right">總分</th>
              <th className="px-3 py-2 text-right">遲到</th>
              <th className="px-3 py-2 text-right">曠課</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s) => (
              <tr key={s.student_id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2 text-slate-500">{s.seat_no ?? '—'}</td>
                <td className="px-3 py-2 font-medium">{s.name}</td>
                <td className="px-3 py-2 text-right text-slate-600">{s.attendance_points}</td>
                <td className="px-3 py-2 text-right text-slate-600">{s.performance_points}</td>
                <td className={`px-3 py-2 text-right font-semibold ${
                  Number(s.total_points) > 0 ? 'text-emerald-700'
                  : Number(s.total_points) < 0 ? 'text-red-700' : 'text-slate-500'
                }`}>{s.total_points}</td>
                <td className="px-3 py-2 text-right text-slate-500">{s.late_count}</td>
                <td className="px-3 py-2 text-right text-slate-500">{s.absent_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
