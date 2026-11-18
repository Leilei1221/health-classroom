import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth'
import Layout from '../../components/Layout'
import { friendlyError } from '../../lib/errors'
import { listBodyAgeByClass, listHealthClasses, type BodyAgeByClass, type HealthClass } from '../api'
import { signed } from '../report/compare'

/**
 * 各班身體年齡統計（教師端，可投影）。
 *
 * 沿用 114 學年學習單最後那張「各班期初年齡區間統計」的樣子：
 * 列＝年齡區間、欄＝班級＋總和，最後一列平均。多了「期末」和「變化」兩個切換。
 *
 * 只印人數與平均，不印姓名、座號、單一個人的值。查詢也只撈身體年齡
 * （見 api.ts 的 listBodyAgeByClass）。
 *
 * 區間調整：去年第一列寫「18~20」、最後一列「60以上」與「51~60」重疊。
 * 這裡改成「20 以下」（體脂機有可能給出 17 歲）與「61 以上」，每個整數只落在一格。
 */

type View = 'initial' | 'final' | 'delta'

interface Bin { label: string; test: (v: number) => boolean }

const AGE_BINS: Bin[] = [
  { label: '20 以下', test: (v) => v <= 20 },
  { label: '21～30', test: (v) => v >= 21 && v <= 30 },
  { label: '31～40', test: (v) => v >= 31 && v <= 40 },
  { label: '41～50', test: (v) => v >= 41 && v <= 50 },
  { label: '51～60', test: (v) => v >= 51 && v <= 60 },
  { label: '61 以上', test: (v) => v >= 61 },
]

/** 與學生端評語的六級同一套切點（report/compare.ts 的 BODY_AGE_TIERS） */
const DELTA_BINS: Bin[] = [
  { label: '年輕 3 歲以上', test: (v) => v <= -3 },
  { label: '年輕 1～2 歲', test: (v) => v >= -2 && v <= -1 },
  { label: '持平', test: (v) => v === 0 },
  { label: '多 1～3 歲', test: (v) => v >= 1 && v <= 3 },
  { label: '多 4～5 歲', test: (v) => v >= 4 && v <= 5 },
  { label: '多 6 歲以上', test: (v) => v >= 6 },
]

const VIEWS: { key: View; label: string }[] = [
  { key: 'initial', label: '期初' },
  { key: 'final', label: '期末' },
  { key: 'delta', label: '變化（期末－期初）' },
]

const avg = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length)

export default function BodyAgeStats() {
  const { teacher, student } = useAuth()
  const [classes, setClasses] = useState<HealthClass[] | null>(null)
  const [stats, setStats] = useState<BodyAgeByClass[] | null>(null)
  const [view, setView] = useState<View>('initial')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    listHealthClasses()
      .then(async (cs) => {
        if (cancelled) return
        setClasses(cs)
        const s = await listBodyAgeByClass(cs.map((c) => c.row))
        if (!cancelled) setStats(s)
      })
      .catch((e) => { if (!cancelled) setError(friendlyError(e)) })
    return () => { cancelled = true }
  }, [])

  const table = useMemo(() => {
    if (!classes || !stats) return null
    const bins = view === 'delta' ? DELTA_BINS : AGE_BINS
    const values = stats.map((s) => (view === 'delta' ? s.deltas : view === 'final' ? s.final : s.initial))
    const all = values.flat()
    const counts = bins.map((b) => [...values.map((vs) => vs.filter(b.test).length), all.filter(b.test).length])
    const max = Math.max(1, ...counts.flatMap((r) => r.slice(0, -1)))
    return { bins, values, all, counts, max }
  }, [classes, stats, view])

  if (error) return <Shell><Box tone="error">{error}</Box></Shell>
  if (classes === null || table === null) return <Shell><Box>載入中…</Box></Shell>

  if (classes.length === 0) {
    return (
      <Shell>
        <Box tone="error">
          <strong className="mb-1 block">這一頁是健護老師用的</strong>
          {student
            ? <>要看自己的成果請到 <Link to="/health" className="underline">學生入口</Link>。</>
            : '這個帳號沒有任何開啟健康管理的班級。'}
        </Box>
      </Shell>
    )
  }

  const fmtAvg = (xs: number[]) => {
    const a = avg(xs)
    if (a === null) return '—'
    const r = Math.round(a * 10) / 10
    return view === 'delta' ? signed(r, 1) : r.toFixed(1)
  }

  return (
    <Shell subtitle={teacher?.display_name}>
      <p className="mb-3 text-[13px] leading-relaxed text-cute-mute">
        這一頁只有人數和平均，沒有姓名與個人數值，可以投影給全班看。
        {view === 'delta' && '「變化」只算期初、期末都有身體年齡的人。'}
      </p>

      <div className="mb-4 flex overflow-hidden rounded-lg border border-cute-ink/35 w-fit">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`px-3 py-1.5 text-sm ${v.key === view ? 'bg-cute-ink font-bold text-white' : 'bg-white text-cute-mute'}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="cute-card overflow-x-auto rounded-3xl p-2">
        <table className="w-full min-w-[520px] text-center text-[15px] tabular-nums">
          <caption className="sr-only">
            各班身體年齡{VIEWS.find((v) => v.key === view)!.label}人數統計
          </caption>
          <thead>
            <tr className="text-sm text-cute-mute">
              <th scope="col" className="px-2 py-2 text-left font-bold">
                {view === 'delta' ? '變化' : '身體年齡'}
              </th>
              {classes.map((c) => (
                <th key={c.row.id} scope="col" className="px-2 py-2 font-bold text-cute-ink">{c.row.name}</th>
              ))}
              <th scope="col" className="px-2 py-2 font-bold text-cute-ink">總和</th>
            </tr>
          </thead>
          <tbody>
            {table.bins.map((b, i) => (
              <tr key={b.label} className="border-t border-cute-ink/10">
                <th scope="row" className="whitespace-nowrap px-2 py-2 text-left text-sm font-medium">{b.label}</th>
                {table.counts[i].map((n, j) => {
                  const isTotal = j === table.counts[i].length - 1
                  // 單一色相由淺到深，0 人不上色；總和欄不上色，免得被最大值吃掉對比
                  const alpha = isTotal || n === 0 ? 0 : 0.12 + 0.5 * (n / table.max)
                  return (
                    <td
                      key={j}
                      className={`px-2 py-2 ${isTotal ? 'font-bold' : ''} ${n === 0 ? 'text-cute-ink/35' : ''}`}
                      style={{ background: alpha ? `rgb(79 111 146 / ${alpha.toFixed(2)})` : undefined }}
                    >
                      {n}
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr className="border-t-2 border-cute-ink/30">
              <th scope="row" className="px-2 py-2 text-left text-sm font-bold">人數</th>
              {table.values.map((vs, j) => <td key={j} className="px-2 py-2">{vs.length}</td>)}
              <td className="px-2 py-2 font-bold">{table.all.length}</td>
            </tr>
            <tr className="border-t border-cute-ink/10">
              <th scope="row" className="px-2 py-2 text-left text-sm font-bold">
                {view === 'delta' ? '平均變化' : '平均年齡'}
              </th>
              {table.values.map((vs, j) => <td key={j} className="px-2 py-2 font-bold">{fmtAvg(vs)}</td>)}
              <td className="px-2 py-2 font-bold">{fmtAvg(table.all)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-cute-mute">
        身體年齡由體脂機推算，是參考值。人數只算有填身體年齡的同學；
        還沒登記的人不在表內。平均取到小數第一位。
      </p>
    </Shell>
  )
}

function Shell({ subtitle, children }: { subtitle?: string; children: React.ReactNode }) {
  return (
    <Layout title="各班身體年齡統計" subtitle={subtitle} back="/" maxWidth="max-w-5xl">
      {children}
    </Layout>
  )
}

function Box({ tone, children }: { tone?: 'error'; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border px-4 py-4 text-sm ${
      tone === 'error'
        ? 'border-[#E7C4C2] bg-[#FBEDEC] text-[#9A3834]'
        : 'border-cute-ink/20 bg-white text-cute-mute'
    }`}>
      {children}
    </div>
  )
}
