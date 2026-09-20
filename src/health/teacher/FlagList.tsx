import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth'
import { friendlyError } from '../../lib/errors'
import {
  listHealthClasses, listRisk, reviewRisk,
  RISK_OUTCOMES, RISK_OUTCOME_LABEL,
  type HealthClass, type RiskOutcome, type RiskStudent,
} from '../api'
import type { RiskLevel } from '../riskLevel'

/**
 * 教師端紅旗名單。規格：docs/課本檢測_等第對應與紅旗處理規格.md 第五節「教師端」。
 *
 * 三區，順序就是規格書的順序：
 *   L3 立即   置頂。未處理的不會自動消失，一直留在最上面直到標記已處理。
 *   L2 需關注 第二區。
 *   L1 留意   第三區，可收合——L1 有 27 個人，攤開來會把上面兩區壓到看不見。
 *
 * 這一頁唯一的寫入是「已聯繫」，走 hc_health_risk_review() 那支
 * SECURITY DEFINER 函式，只碰四個處理紀錄欄位，碰不到學生的作答內容。
 * 班級進度表（要投影的那一頁）仍然完全唯讀，也仍然不顯示任何心理紅旗。
 */
export default function FlagList() {
  const { student, teacher } = useAuth()
  const [classes, setClasses] = useState<HealthClass[] | null>(null)
  const [rows, setRows] = useState<RiskStudent[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    listHealthClasses()
      .then(async (cs) => {
        if (cancelled) return
        setClasses(cs)
        if (cs.length === 0) { setRows([]); return }
        // 學期字串與登記頁的 semesterKey() 同一個組法
        const semesters = [
          ...new Set(cs.map((c) => `${c.row.academic_year}-${c.row.semester}`)),
        ]
        const list = await listRisk(semesters)
        if (!cancelled) setRows(list)
      })
      .catch((e) => { if (!cancelled) setError(friendlyError(e)) })
    return () => { cancelled = true }
  }, [])

  /** 標記完就地更新那一列，不重新整頁：老師按完要馬上看到，也不該跳回頂端 */
  function apply(r: RiskStudent, patch: Partial<RiskStudent>) {
    setRows((prev) => (prev ?? []).map((x) =>
      x.student_email === r.student_email && x.semester === r.semester
        ? { ...x, ...patch } : x))
  }

  if (error) return <Shell><Box tone="error">{error}</Box></Shell>
  if (classes === null) return <Shell><Box>載入中…</Box></Shell>

  /*
    擋人的條件用「有沒有帶班級」，不是用 role。
    有幾個學生帳號因為早期登入順序的關係在 hc_teachers 裡有一列，
    只看 role 會把他們當成老師放進來；而「帶班級」正好也是 RLS
    判斷讀得到誰的同一個條件，兩邊不會各說各話。
  */
  if (classes.length === 0) {
    return (
      <Shell>
        <Box tone="error">
          <strong className="mb-1 block">這一頁是健護老師用的</strong>
          {student ? (
            <>
              你的帳號在學生名單上（{student.class_name} 班・座號 {student.seat_no ?? '—'}）。
              要填自己的資料請到 <Link to="/health" className="font-medium underline">健康登記頁</Link>。
            </>
          ) : (
            <>
              這個帳號沒有任何開啟健康管理的班級。
              班級有開但這裡看不到的話，到班級管理編輯那個班，
              把「使用健康管理模組」勾起來。
            </>
          )}
        </Box>
      </Shell>
    )
  }

  const of = (lv: RiskLevel) => (rows ?? []).filter((r) => r.level === lv).sort(order)
  const l3 = of(3)
  const l3Open = l3.filter((r) => !r.reviewed)

  return (
    <Shell subtitle={`${teacher?.display_name ?? ''}　${classes.length} 個班級`}>
      {rows === null ? (
        <Box>載入中…</Box>
      ) : rows.length === 0 ? (
        <Box>
          目前沒有需要關心的學生。
          <span className="mt-1 block text-xs text-slate-500">
            學生每送出一份量表就會重新判定；這一頁只顯示這學期的結果。
          </span>
        </Box>
      ) : (
        <div className="space-y-5">
          <Section
            level={3}
            title="立即・今天要處理"
            hint={l3Open.length > 0
              ? `${l3Open.length} 位尚未標記已聯繫。標記之前不會從最上面消失。`
              : '都已標記已聯繫。紀錄留在下面，學期內不會消失。'}
            rows={l3}
            apply={apply}
          />
          <Section
            level={2}
            title="需關注"
            hint="分數落在課本判讀的中重度區間。找時間談，不必當天。"
            rows={of(2)}
            apply={apply}
          />
          <Section
            level={1}
            title="留意"
            hint="課本建議「找親友談談」的那一段。這一區不是紅旗，是名單。"
            rows={of(1)}
            collapsible
            apply={apply}
          />
        </div>
      )}

      <div className="mt-5 space-y-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3.5 text-xs leading-relaxed text-slate-600">
        <p>
          <strong className="mr-1.5 text-[#A8403C]">● 立即</strong>
          情緒自我檢視表第 20 題「我想要消失不見」答是。不看總分，
          而且答過之後即使重做也不會消失。
        </p>
        <p>
          <strong className="mr-1.5 text-[#8A5310]">▲ 需關注</strong>
          心情溫度計 15 分以上、情緒自我檢視表 12 分以上、或壓力偵測站 6 項以上。
        </p>
        <p>
          <strong className="mr-1.5 text-slate-600">・留意</strong>
          心情溫度計 6-14 分、情緒自我檢視表 6-11 分、或壓力偵測站 4-5 項。
        </p>
        <p>
          等級是學生送出當下算好寫進去的，不是現在現算的——門檻日後調整，
          舊紀錄維持當時的判定。學生端從頭到尾看不到分數與等級。
          要看某位同學填了什麼，到 <Link to="/health/detail" className="underline">學生明細</Link>。
        </p>
      </div>
    </Shell>
  )
}

/** 未處理的排前面，其次照觸發時間新到舊 */
function order(a: RiskStudent, b: RiskStudent): number {
  if (a.reviewed !== b.reviewed) return a.reviewed ? 1 : -1
  return (b.flaggedAt ?? '').localeCompare(a.flaggedAt ?? '')
}

function Section({
  level, title, hint, rows, collapsible, apply,
}: {
  level: RiskLevel
  title: string
  hint: string
  rows: RiskStudent[]
  collapsible?: boolean
  apply: (r: RiskStudent, patch: Partial<RiskStudent>) => void
}) {
  // L1 預設收起。上面兩區永遠是攤開的，不給收——那是規格書要它們顯眼的意思
  const [open, setOpen] = useState(!collapsible)
  if (rows.length === 0) return null
  const open2 = collapsible ? open : true

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className={`text-base font-semibold ${
          level === 3 ? 'text-[#A8403C]' : level === 2 ? 'text-[#8A5310]' : 'text-slate-700'
        }`}>
          {level === 3 ? '● ' : level === 2 ? '▲ ' : ''}{title}
        </h2>
        <span className="text-sm text-slate-500">{rows.length} 位</span>
        {collapsible && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-sm text-slate-500 underline hover:text-slate-900"
          >
            {open2 ? '收起' : '展開'}
          </button>
        )}
        <span className="basis-full text-xs text-slate-500">{hint}</span>
      </div>
      {open2 && (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.student_email + r.semester} r={r} apply={apply} />
          ))}
        </div>
      )}
    </section>
  )
}

function Card({
  r, apply,
}: { r: RiskStudent; apply: (r: RiskStudent, patch: Partial<RiskStudent>) => void }) {
  const [editing, setEditing] = useState(false)
  const unhandled = r.level === 3 && !r.reviewed

  return (
    <div className={`rounded-xl border px-3.5 py-3 ${
      unhandled ? 'border-[#E7C4C2] bg-[#FBEDEC]'
        : r.reviewed ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'
    }`}>
      <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge level={r.level} />
        {r.l3Count >= 2 && (
          <span className="rounded-md border border-[#A8403C] px-1.5 py-0.5 text-xs font-bold text-[#A8403C]">
            重複觸發 {r.l3Count} 次
          </span>
        )}
        {r.reviewed && (
          <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-xs text-slate-700">
            已聯繫{r.outcome ? `・${RISK_OUTCOME_LABEL[r.outcome]}` : ''}
          </span>
        )}
        <span className="ml-auto text-xs tabular-nums text-slate-500">
          觸發 {when(r.flaggedAt)}
        </span>
      </div>

      <div className="mb-1.5 text-[15px]">
        <span className="text-slate-500">{r.class_name ?? '—'} 班　{r.seat_no ?? '—'} 號</span>
        <Who row={r} className="ml-2 font-semibold" />
      </div>

      <Reasons rows={r.reasons} />

      {r.reviewed && (
        <p className="mt-1.5 text-xs text-slate-600">
          {when(r.reviewedAt)} 標記
          {r.note && <span className="ml-1">・{r.note}</span>}
        </p>
      )}

      {editing ? (
        <ReviewForm r={r} apply={apply} close={() => setEditing(false)} />
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {/*
            規格書把「已聯繫」寫在 L3 底下。L2、L1 先不給按鈕——
            那兩區是名單不是待辦，多一顆按鈕會讓人以為每一列都要處理掉。
            要加再說，RPC 本身沒有限制等級。
          */}
          {r.level === 3 && (
            <button
              onClick={() => setEditing(true)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                r.reviewed
                  ? 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                  : 'bg-[#A8403C] text-white hover:bg-[#8F3532]'
              }`}
            >
              {r.reviewed ? '修改處理結果' : '已聯繫'}
            </button>
          )}
          {r.level === 3 && r.reviewed && (
            <UndoButton r={r} apply={apply} />
          )}
        </div>
      )}
    </div>
  )
}

function ReviewForm({
  r, apply, close,
}: {
  r: RiskStudent
  apply: (r: RiskStudent, patch: Partial<RiskStudent>) => void
  close: () => void
}) {
  const [outcome, setOutcome] = useState<RiskOutcome | null>(r.outcome)
  const [note, setNote] = useState(r.note ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    if (!outcome || busy) return
    setBusy(true); setErr('')
    try {
      await reviewRisk(r.student_email, r.semester, true, outcome, note)
      apply(r, {
        reviewed: true, outcome, note: note.trim() || null,
        reviewedAt: new Date().toISOString(),
      })
      close()
    } catch (e) {
      setErr(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5">
      <p className="mb-1.5 text-sm font-medium">處理結果</p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {RISK_OUTCOMES.map((o) => (
          <button
            key={o.key}
            onClick={() => setOutcome(o.key)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              outcome === o.key
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">備註（選填，只有你看得到）</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="例：9/20 午休談過，導師已知"
          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
        />
      </label>
      {err && <p className="mt-1.5 text-sm text-[#A8403C]">{err}</p>}
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => void save()}
          disabled={!outcome || busy}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? '儲存中…' : '儲存'}
        </button>
        <button
          onClick={close}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          取消
        </button>
      </div>
    </div>
  )
}

/** 按錯了。取消標記會把那一列送回未處理，重新排到最上面 */
function UndoButton({
  r, apply,
}: { r: RiskStudent; apply: (r: RiskStudent, patch: Partial<RiskStudent>) => void }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      disabled={busy}
      onClick={() => {
        setBusy(true)
        void reviewRisk(r.student_email, r.semester, false, null, null)
          .then(() => apply(r, { reviewed: false, outcome: null, note: null, reviewedAt: null }))
          .finally(() => setBusy(false))
      }}
      className="text-sm text-slate-500 underline hover:text-slate-900 disabled:opacity-40"
    >
      取消標記
    </button>
  )
}

function Badge({ level }: { level: RiskLevel }) {
  if (level === 3) {
    return (
      <span className="inline-flex whitespace-nowrap rounded-md bg-[#A8403C] px-2 py-1 text-xs font-bold text-white">
        ● 立即
      </span>
    )
  }
  if (level === 2) {
    return (
      <span className="inline-flex whitespace-nowrap rounded-md border border-[#D19A2E] px-2 py-1 text-xs font-medium text-[#8A5310]">
        ▲ 需關注
      </span>
    )
  }
  return (
    <span className="inline-flex whitespace-nowrap rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600">
      留意
    </span>
  )
}

/** 對不到名單（換過信箱、或已從名單移除）才退回顯示帳號 */
function Who({ row, className = '' }: { row: RiskStudent; className?: string }) {
  return row.name
    ? <span className={className}>{row.name}</span>
    : <span className="font-mono text-xs text-slate-500">{row.student_email}</span>
}

function Reasons({ rows }: { rows: RiskStudent['reasons'] }) {
  return (
    <>
      {rows.map((x, i) => (
        <div key={i} className={`text-sm ${i > 0 ? 'mt-0.5' : ''}`}>
          <span className="font-medium">{x.scale}</span>
          <span className="text-slate-500">　{x.detail}</span>
        </div>
      ))}
    </>
  )
}

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('zh-TW', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    : '—'

function Shell({ subtitle, children }: { subtitle?: string; children: React.ReactNode }) {
  const { signOut } = useAuth()
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <h1 className="text-base font-semibold">需要關心的學生</h1>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          <Link to="/" className="text-sm text-slate-500 hover:text-slate-900">班級管理</Link>
          <button onClick={() => void signOut()} className="text-sm text-slate-500 hover:text-slate-900">
            登出
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-5">{children}</main>
    </div>
  )
}

function Box({ tone, children }: { tone?: 'error'; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border px-4 py-4 text-sm ${
      tone === 'error'
        ? 'border-[#E7C4C2] bg-[#FBEDEC] text-[#A8403C]'
        : 'border-slate-200 bg-white text-slate-600'
    }`}>
      {children}
    </div>
  )
}
