/**
 * 燈號判定門檻。
 *
 * ── BMI ────────────────────────────────────────────────────────────
 * 出處：衛生福利部國民健康署，2021，育達版健康與護理課本 P.24。
 * 男性 15～18 歲四列，原表照抄未改（見 BMI_MALE）。
 *
 * 這組數字是 2026-09-20 由授課教師從課本查到後提供的。在那之前程式裡寫的是
 * 17.7 / 21.9 / 23.2，標成「國健署 18 歲男生一列」但對不上原表任何一列，
 * 已全部換掉。當時用本校 158 筆期初資料就看得出不對：號稱第 85 百分位的
 * 21.9 落在 49.4%（本校中位數 21.8），號稱第 95 百分位的 23.2 落在 38.0%。
 * 教訓記在這裡——門檻數字沒有一手出處就不要寫進來。
 *
 * ── 年齡怎麼取 ─────────────────────────────────────────────────────
 * 不寫死單一組數字，走 GRADE_ROUND_AGE 這張表：年級 × 期初／期中／期末 → 年齡。
 * 高三學生會在學年中跨過生日，所以期初查 17 歲那列、期末查 18 歲那列。
 * 換年級只要看這張表，不用動判定邏輯。
 *
 * 年級不可信時（多元選修混年級、或還沒查證，hc_classes.grade_confirmed = false）
 * 一律不判 BMI，畫面顯示「年級未確認」。套錯一列的代價是實的：
 * 15 歲那列過重是 22.9、18 歲那列是 24.0，中間差了 1.1。
 *
 * ── 腰臀比 ─────────────────────────────────────────────────────────
 * 0.90 / 0.95 是男性標準。WHO 2008 年專家諮詢報告：男性 ≥ 0.90、
 * 女性 ≥ 0.85 為風險顯著增加。
 *
 * ── 已知限制，日後要擴充時看這裡 ───────────────────────────────────
 * 兩組門檻目前都只有男性。這是刻意的：本校學生以男性為主，
 * 這學期不會教到女生班，且 hc_students.gender 現在全部是空的
 * （Excel 名單沒有這欄），就算寫了性別分支也無從判斷。
 * 若日後要支援女生，需要：
 *   1. 名單匯入補上性別，hc_my_student_profile() 一併回傳 gender
 *   2. 補上國健署同一張表的女性四列
 *   3. 女性腰臀比門檻改為 0.85
 * 在那之前不要偷偷套男性標準到女生身上，寧可顯示「需要更多資料才能判定」。
 *
 * 用詞一律中性：不出現「異常」「高血壓」「肥胖」，也不顯示目標體重或該減幾公斤。
 * 紅色警示只做在教師端，學生端維持三色燈號。
 */
import type { MeasurementRound } from '../lib/types'

export type Level = 'g' | 'y' | 'o'

export interface Verdict {
  level: Level
  label: string
  msg: string
}

/* ------------------------------------------------------------------ BMI */

/** 國健署那張表有列的年齡 */
export type BmiAge = 15 | 16 | 17 | 18

export interface BmiRow {
  /** 過輕：BMI < under */
  under: number
  /** 過重：BMI ≥ over */
  over: number
  /** 肥胖：BMI ≥ obese */
  obese: number
}

/**
 * 衛生福利部國民健康署，2021，育達版健康與護理課本 P.24，男性。
 * 原表數字照抄，不要自己四捨五入或補值。
 */
export const BMI_MALE: Record<BmiAge, BmiRow> = {
  15: { under: 16.9, over: 22.9, obese: 25.4 },
  16: { under: 17.4, over: 23.3, obese: 25.6 },
  17: { under: 17.8, over: 23.5, obese: 25.6 },
  18: { under: 18.5, over: 24.0, obese: 27.0 },
}

export const BMI_SOURCE = '衛生福利部國民健康署，2021，育達版健康與護理課本 P.24（男性）'

/**
 * 年級 × 這次測量 → 要查 BMI 表的哪一列。
 *
 * 高中生入學時多半剛滿 15／16／17，學年中會跨過生日，
 * 所以期末那次往上一歲。期中與期初同一列：那時只有一部分人過完生日，
 * 兩邊都不準，取較嚴的（年齡小的那列門檻較低）。要改就改這一行。
 */
export const GRADE_ROUND_AGE: Record<number, Record<MeasurementRound, BmiAge>> = {
  1: { initial: 15, mid: 15, final: 16 },
  2: { initial: 16, mid: 16, final: 17 },
  3: { initial: 17, mid: 17, final: 18 },
}

/**
 * 學生端用的年級。
 *
 * hc_my_student_profile() 目前不回傳年級，而學生讀不到 hc_classes
 * （RLS 只開給帶班的老師），所以學生端拿不到自己的年級。
 * 這學期健康模組只有高三在用（期初 158 筆全部來自 305–309），
 * 先用這個常數，要支援其他年級時得先讓那支 RPC 多回傳一欄 grade。
 */
export const STUDENT_GRADE = 3

/** 查不到對應年齡時回傳 null —— 不判，比判錯好 */
export function bmiAge(
  grade: number | null | undefined,
  round: MeasurementRound,
  gradeConfirmed = true,
): BmiAge | null {
  if (!gradeConfirmed || grade === null || grade === undefined) return null
  return GRADE_ROUND_AGE[grade]?.[round] ?? null
}

/** 這一列的四段文字。等第名稱不進學生畫面，只有 label/msg 會顯示 */
function bmiVerdict(bmi: number, row: BmiRow): Verdict {
  if (bmi < row.under) {
    return {
      level: 'y', label: '目前偏低',
      msg: '體重相對身高偏低，均衡吃夠三餐是這學期可以留意的方向。',
    }
  }
  if (bmi >= row.obese) {
    return {
      level: 'o', label: '建議留意',
      msg: '這是一個值得投入改善的方向，我們會在課堂上一起討論做法。',
    }
  }
  if (bmi >= row.over) {
    return {
      level: 'y', label: '稍微偏高',
      msg: '有調整空間，從飲食和活動量著手都會有幫助。',
    }
  }
  return { level: 'g', label: '在理想範圍', msg: '維持現在的作息和活動量就很好。' }
}

/** 不知道年齡就判不了；呼叫端要處理 null，不要自己挑一列來湊 */
export function judgeBmi(bmi: number, age: BmiAge | null): Verdict | null {
  if (age === null) return null
  return bmiVerdict(bmi, BMI_MALE[age])
}

/* ------------------------------------------------------------ 腰臀比／血壓 */

// 男性標準；WHO 2008：男性 ≥ 0.90 即為風險顯著增加，女性門檻為 0.85
const WHR_RULES: { max: number; v: Verdict }[] = [
  { max: 0.90, v: { level: 'g', label: '在理想範圍', msg: '腰腹脂肪分布在合適的範圍。' } },
  { max: 0.95, v: { level: 'y', label: '可以留意', msg: '增加日常活動量對這個數字最有幫助。' } },
  { max: Infinity, v: { level: 'o', label: '建議留意', msg: '腰腹脂肪較多，規律活動是最直接的方式。' } },
]

export function judgeWhr(whr: number): Verdict {
  return WHR_RULES.find((r) => whr < r.max)!.v
}

export function judgeBp(sbp: number, dbp: number): Verdict {
  if (sbp >= 140 || dbp >= 90) {
    return {
      level: 'o', label: '建議再測一次並告訴老師',
      msg: '單次數值偏高很常見，量測前休息不足、剛跑完都會影響。請再量一次，並讓老師知道。',
    }
  }
  if (sbp >= 130 || dbp >= 80) {
    return {
      level: 'y', label: '可以留意',
      msg: '從減少含糖飲料、增加蔬果和規律活動開始，對這個數字最有效。',
    }
  }
  if (sbp >= 120) {
    return {
      level: 'y', label: '接近參考上限',
      msg: '現在建立的習慣，會是未來心血管健康的資產。',
    }
  }
  return { level: 'g', label: '在理想範圍', msg: '維持規律作息和活動量就很好。' }
}

/* ------------------------------------------------------- 體脂率／腰圍（教師端） */

/**
 * 體脂率與腰圍，由授課教師提供（2026-09-20）。
 * 只用在教師端明細頁，學生端沒有這兩項的燈號，兩項都只標琥珀。
 *
 * 【體脂率】課本的參考範圍是 30 歲以下男性 14–20%，≥ 25% 為肥胖。
 * **只取 > 20 與 ≥ 25 兩段，低於 14 不標。**
 * 14% 這個下限是成人範圍，套在發育中的高中男生會大量誤判——
 * 本校 157 筆裡有 49 人（31%）低於 14，把三成的學生標成「偏低」
 * 等於沒有標；而且體脂偏低本來就不是這個年紀要提醒的方向。
 *
 * 【腰圍】男性 ≥ 90 公分。課本字面寫的是「大於 90」，這裡採 ≥，
 * 理由是國健署代謝症候群判定用的就是 ≥ 90，剛好卡在 90.0 的
 * （本校有 7 人）本來就該留意。
 */
export const BODY_FAT_MALE_U30 = { high: 20, obese: 25 }
export const WAIST_MALE_OBESE = 90

/** 前端現算，不存資料庫（規格書：存原始值，避免資料不一致） */
export const calcBmi = (h: number, w: number) => w / Math.pow(h / 100, 2)
export const calcFatKg = (w: number, pct: number) => (w * pct) / 100
export const calcWhr = (waist: number, hip: number) => waist / hip
