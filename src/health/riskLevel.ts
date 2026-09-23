/**
 * 心理檢測的紅旗判定：三個量表 → L0–L3。
 *
 * 規格：docs/課本檢測_等第對應與紅旗處理規格.md 第五節。
 * 這是整個系統最重要的一段判定，門檻與分級一律照規格書，不要憑印象改。
 *
 * ── L3 只有一條偵測路徑 ────────────────────────────────────────────
 * 規格書原本寫 L3 是「BSRS-5 ★自殺想法 ≥ 2 **或** 情緒檢視表第 20 題答是」。
 * 但 ★ 那一題**維持紙本課堂施測，線上不收、不存**（蕾蕾 2026-09-20 決定），
 * 所以線上只有第 20 題這一條路。
 *
 * 這裡刻意不留一個「★ ≥ 2」的條件擺著——一個永遠不會成立的判斷會讓下一個
 * 讀這段程式的人以為線上有在收那一題，進而以為 L3 的涵蓋範圍比實際大。
 * 要改成線上施測的話，是加一個欄位、加一條判定、改規格書，三件事一起做。
 *
 * ── 取最高級 ──────────────────────────────────────────────────────
 * 三個量表分別落在不同等級時以最高者為準。沒做的量表（null）不參與判定，
 * 也不會把等級往下拉——只做了壓力就送出的人，照壓力那一份判。
 */

/** 0 一般｜1 留意｜2 需關注｜3 立即 */
export type RiskLevel = 0 | 1 | 2 | 3

export interface RiskInput {
  /** 心情溫度計 BSRS-5 前 5 題總分 0–20；沒做為 null */
  mood: number | null
  /** 壓力偵測站符合項數 0–12；沒做為 null */
  stress: number | null
  /** 情緒自我檢視表總分 0–20；沒做為 null */
  depression: number | null
  /** 情緒自我檢視表第 20 題「我想要消失不見」答是 */
  depressionCritical: boolean
}

/**
 * 每個量表的分級門檻，照規格書第五節逐條抄下來。
 * min 為「幾分以上」（含），沒有上限——取最高級時自然會被更高的那條蓋過。
 */
const BANDS: { scale: string; of: (i: RiskInput) => number | null; cuts: { min: number; level: RiskLevel; label: (n: number) => string }[] }[] = [
  {
    scale: '心情溫度計',
    of: (i) => i.mood,
    cuts: [
      { min: 15, level: 2, label: (n) => `${n} 分（重度情緒困擾）` },
      { min: 6, level: 1, label: (n) => `${n} 分（${n >= 10 ? '中度' : '輕度'}情緒困擾）` },
    ],
  },
  {
    scale: '情緒自我檢視表',
    of: (i) => i.depression,
    cuts: [
      { min: 12, level: 2, label: (n) => `${n} 分` },
      { min: 6, level: 1, label: (n) => `${n} 分` },
    ],
  },
  {
    scale: '壓力偵測站',
    of: (i) => i.stress,
    cuts: [
      { min: 6, level: 2, label: (n) => `${n} 項` },
      { min: 4, level: 1, label: (n) => `${n} 項` },
    ],
  },
]

export interface RiskReason {
  scale: string
  detail: string
  level: RiskLevel
}

/** 觸發了哪幾條，等級高的排前面。教師端用這個列出原因 */
export function riskReasons(i: RiskInput): RiskReason[] {
  const out: RiskReason[] = []

  if (i.depressionCritical) {
    out.push({
      scale: '情緒自我檢視表',
      detail: '第 20 題「我想要消失不見」答是',
      level: 3,
    })
  }

  for (const b of BANDS) {
    const n = b.of(i)
    if (n === null || !Number.isFinite(n)) continue
    const hit = b.cuts.find((c) => n >= c.min)
    if (hit) out.push({ scale: b.scale, detail: hit.label(n), level: hit.level })
  }

  return out.sort((a, b) => b.level - a.level)
}

/** 取最高級。三個量表都沒做（全 null）時為 0 */
export function riskLevel(i: RiskInput): RiskLevel {
  return riskReasons(i).reduce<RiskLevel>((max, r) => (r.level > max ? r.level : max), 0)
}

/** 教師端的等級名稱。學生端一律不顯示等級，見規格書「絕對不可以做的事」第 3 點 */
export const RISK_LABEL: Record<RiskLevel, string> = {
  0: '一般',
  1: '留意',
  2: '需關注',
  3: '立即',
}

/* ------------------------------------------------------------ 教師端處理結果 */

/**
 * 老師按下「已聯繫」時要選的處理結果，照規格書第五節教師端的三個選項。
 * other 是資料庫的 check constraint 允許、但畫面上不給選的退路。
 *
 * 放在這裡而不是 api.ts：匯出 CSV 也要印這些字，而 csv.ts 刻意不相依
 * supabase client（那份測試是用 tsx 直接跑檔案的，不進瀏覽器環境）。
 */
export type RiskOutcome = 'needs_support' | 'observed_ok' | 'joking' | 'other'

export const RISK_OUTCOMES: { key: RiskOutcome; label: string }[] = [
  { key: 'needs_support', label: '需要持續關心' },
  { key: 'observed_ok', label: '課堂觀察後無虞' },
  { key: 'joking', label: '疑似玩笑' },
]

export const RISK_OUTCOME_LABEL: Record<RiskOutcome, string> = {
  needs_support: '需要持續關心',
  observed_ok: '課堂觀察後無虞',
  joking: '疑似玩笑',
  other: '其他',
}

export const isRiskOutcome = (v: string | null): v is RiskOutcome =>
  v === 'needs_support' || v === 'observed_ok' || v === 'joking' || v === 'other'
