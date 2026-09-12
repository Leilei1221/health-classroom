import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth'
import { friendlyError } from '../../lib/errors'
import HealthHeader, { PreviewBanner } from '../Header'
import { getSelfcheck, saveSelfcheck, semesterKey, type SelfcheckPatch } from '../api'
import DietTree from './DietTree'
import Scale, { ScaleResult } from './Scale'
import { SCALES, SCALE_KEYS, SOURCE_LINE, subLine, type DietType, type ScaleKey } from './scales'
import { gradeDiet, outcomeFromRow, type ScaleOutcome } from './state'
import type { HealthSelfcheck, StudentProfile } from '../../lib/types'

type View =
  | { at: 'home' }
  | { at: 'quiz'; key: ScaleKey }
  | { at: 'result'; key: ScaleKey; outcome: ScaleOutcome; retakable: boolean }

/** preview 有值時為教師預覽：套用假學生、不讀也不寫資料庫 */
export default function SelfCheck({ preview }: { preview?: StudentProfile }) {
  const { student: signedIn } = useAuth()
  const isPreview = preview !== undefined
  const student = preview ?? signedIn
  const semester = student ? semesterKey(student) : ''

  const [row, setRow] = useState<HealthSelfcheck | null>(null)
  const [view, setView] = useState<View>({ at: 'home' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadWarning, setLoadWarning] = useState('')

  useEffect(() => {
    if (!student) return
    if (isPreview) { setLoading(false); return }
    getSelfcheck(student.email, semester)
      .then(setRow)
      .catch(() => setLoadWarning('沒有讀到你先前做過的紀錄，直接作答即可。'))
      .finally(() => setLoading(false))
  }, [student, semester, isPreview])

  const submit = async (key: ScaleKey, patch: SelfcheckPatch, outcome: ScaleOutcome) => {
    if (!student) return
    if (isPreview) {
      setView({ at: 'result', key, outcome, retakable: true })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setSaving(true); setError('')
    try {
      const saved = await saveSelfcheck(student.email, semester, patch)
      setRow(saved)
      // 第 20 題的旗子是黏的，可能與這次作答不同，一律以資料庫回來的為準
      setView({
        at: 'result', key, retakable: true,
        outcome: outcomeFromRow(saved, key) ?? outcome,
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  if (!student) return null
  if (loading) return <div className="p-10 text-center text-sm text-slate-500">載入中…</div>

  const done = SCALE_KEYS.filter((k) => outcomeFromRow(row, k) !== null).length

  return (
    <div className="min-h-screen bg-[#E9F5F2] text-[#0E2E2B]">
      <div className="mx-auto max-w-[520px] pb-32">
        <HealthHeader student={student} isPreview={isPreview} tab="selfcheck" />

        <div className="bg-[#0B4A44] px-5 pb-4 text-white">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
            <i
              className="block h-full rounded-full bg-[#8FE0B4] transition-[width] duration-300"
              style={{ width: `${(done / SCALE_KEYS.length) * 100}%` }}
            />
          </div>
          <div className="mt-1.5 text-[12.5px] opacity-75">
            {SCALE_KEYS.length} 份檢測，完成 {done} 份
          </div>
        </div>

        {isPreview && (
          <PreviewBanner>
            這是學生在手機上看到的畫面。題目可以試答、結果也會算出來，但送出不會寫入任何資料。
          </PreviewBanner>
        )}
        {loadWarning && (
          <div className="mx-3 mt-3 rounded-lg bg-[#FDF3E3] px-4 py-3 text-sm text-[#8A5310]">
            {loadWarning}
          </div>
        )}
        {error && (
          <div className="mx-3 mt-3 rounded-lg bg-[#FBEDEC] px-4 py-3 text-sm text-[#A8403C]">
            {error}
          </div>
        )}

        {view.at === 'home' ? (
          <Home
            row={row}
            onOpen={(key) => {
              const prev = outcomeFromRow(row, key)
              setView(prev
                ? { at: 'result', key, outcome: prev, retakable: true }
                : { at: 'quiz', key })
              window.scrollTo({ top: 0 })
            }}
            isPreview={isPreview}
          />
        ) : view.at === 'quiz' ? (
          view.key === 'pyramid' ? (
            <DietTree
              saving={saving}
              onBack={() => setView({ at: 'home' })}
              onFinish={(letter: DietType) => {
                const { patch, outcome } = gradeDiet(letter)
                void submit('pyramid', patch, outcome)
              }}
            />
          ) : (
            <Scale
              scaleKey={view.key}
              saving={saving}
              onBack={() => setView({ at: 'home' })}
              onSubmit={(patch, outcome) => void submit(view.key, patch, outcome)}
            />
          )
        ) : (
          <ScaleResult
            scaleKey={view.key}
            outcome={view.outcome}
            onBack={() => { setView({ at: 'home' }); window.scrollTo({ top: 0 }) }}
            onRetake={view.retakable
              ? () => { setView({ at: 'quiz', key: view.key }); window.scrollTo({ top: 0 }) }
              : undefined}
          />
        )}
      </div>
    </div>
  )
}

function Home({ row, onOpen, isPreview }: {
  row: HealthSelfcheck | null
  onOpen: (key: ScaleKey) => void
  isPreview: boolean
}) {
  return (
    <>
      <section className="mx-3 my-3.5 overflow-hidden rounded-2xl border border-[#C7E2DC] bg-white">
        <div className="border-b border-[#C7E2DC] bg-[#F7FCFB] px-4 pb-3 pt-3.5">
          <h3 className="text-base font-bold">課本自我檢測</h3>
          <p className="mt-0.5 text-[13px] text-[#4A6461]">
            照你最近的狀況回答就好，沒有標準答案，也不算成績
          </p>
        </div>
        {SCALE_KEYS.map((k) => {
          const s = SCALES[k]
          const finished = outcomeFromRow(row, k) !== null
          return (
            <button
              key={k}
              onClick={() => onOpen(k)}
              className="flex w-full items-center gap-3 border-b border-[#F0F6F5] px-4 py-3.5 text-left last:border-0"
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                finished ? 'bg-[#12776E] text-white' : 'bg-[#E9F5F2] text-[#12776E]'
              }`}>
                {finished ? '✓' : s.no}
              </span>
              <span className="flex-1">
                <b className="block text-[15px]">{s.nm}</b>
                <span className="block text-[12.5px] text-[#4A6461]">{subLine(k)}</span>
              </span>
              <span className={`shrink-0 text-[12.5px] ${finished ? 'font-medium text-[#12776E]' : 'text-[#8CA5A2]'}`}>
                {finished ? '已完成' : '尚未做'}
              </span>
            </button>
          )
        })}
      </section>

      <div className="mx-3 rounded-xl border border-dashed border-[#C7E2DC] bg-[#F7FCFB] px-4 py-3.5 text-[13px] leading-relaxed text-[#4A6461]">
        這幾份量表是「自我覺察」的工具，不是診斷。分數高不代表你有病，分數低也不代表完全沒事。
        真正有用的是：做完之後，你比昨天更知道自己現在的狀態。
      </div>

      <section className="mx-3 my-3.5 overflow-hidden rounded-2xl border border-[#C7E2DC] bg-white">
        <div className="border-b border-[#C7E2DC] bg-[#F7FCFB] px-4 pb-3 pt-3.5">
          <h3 className="text-base font-bold">做完檢測之後</h3>
          <p className="mt-0.5 text-[13px] text-[#4A6461]">
            這是課堂活動，不是檢測——不算分、不評價，也不會出現在成績裡
          </p>
        </div>
        <Link
          to={isPreview ? '/health/plate/preview' : '/health/plate'}
          className="flex items-center gap-3 px-4 py-3.5"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E9F5F2] text-[13px] font-bold text-[#12776E]">
            ▶
          </span>
          <span className="flex-1">
            <b className="block text-[15px]">我的餐盤・一日份量拼盤</b>
            <span className="block text-[12.5px] text-[#4A6461]">
              把今天吃的點進去，看六大類各裝了多少、哪一格先滿出來
            </span>
          </span>
          <span className="shrink-0 text-[12.5px] text-[#12776E]">開始 →</span>
        </Link>
      </section>

      <p className="mx-3 pb-2 text-[11.5px] leading-relaxed text-[#8CA5A2]">{SOURCE_LINE}</p>
    </>
  )
}
