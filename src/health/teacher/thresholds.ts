/**
 * 教師端的數值判讀：哪一列要標紅、標琥珀，右邊寫什麼。
 *
 * ── 紅與琥珀的分層原則（蕾蕾 2026-09-19 定案，改這裡之前先讀完）──────
 *
 *   紅色 ＝ **今天要處理**。
 *     血壓、血氧、脈搏屬於這一類：單次數值本來就會浮動，看到了就請學生
 *     坐下休息再量一次，必要時當天帶去保健室。紅色要能驅動一個當天的動作。
 *
 *   琥珀 ＝ **長期指標，課堂上談**。
 *     BMI、體脂率、腰圍、腰臀比都屬於這一類。體位是幾個月、幾學期的事，
 *     沒有哪一個當天的動作可以處理它，標成紅色只會稀釋紅色的意思——
 *     紅的東西一多，老師就不看了。
 *
 * 所以這四項不論多高多低都只標琥珀。這不是「紅標太多所以調鬆」，
 * 是紅色的定義本來就該是「今天要處理」。日後要加新欄位時照這個問題判斷：
 * 「看到這個數字，老師今天做得了什麼？」做得了 → 紅；做不了 → 琥珀。
 *
 * BMI／腰臀比／血壓／體脂率／腰圍的門檻都放在 rules.ts，不在這裡另外寫一組。
 * 學生看到的燈號和老師看到的標記必須出自同一組數字，
 * 否則會變成學生說「我的是綠燈」、老師說「你這個要重測」，兩邊各說各話。
 *
 * BMI 是年齡別的，所以 marksOf() 要帶 age 進來（由呼叫端從班級年級推出，
 * 見 rules.ts 的 GRADE_ROUND_AGE）。age 為 null＝年級未確認，那就不判 BMI。
 *
 * 脈搏與血氧學生端沒有燈號，門檻取自 docs/教師端進度看板_原型.html：
 * 血氧 < 95 偏低、脈搏 > 100 偏快、脈搏 < 50 偏慢。
 *
 * 其餘欄位（內臟脂肪、基礎代謝率、身體年齡、皮下脂肪率、骨骼肌率）
 * 目前沒有議定好的門檻，一律不標記。寧可不標，也不要自己編一組數字出來——
 * 這些數字會被老師拿去跟學生談話，標錯的代價是實的。
 */
import {
  BODY_FAT_MALE_U30, WAIST_MALE_OBESE,
  calcBmi, calcWhr, judgeBmi, judgeBp, judgeWhr, type BmiAge,
} from '../rules'
import type { HealthMeasurement } from '../../lib/types'

/** red＝建議老師看一眼、必要時請學生重測；amber＝邊界值 */
export type Tone = 'red' | 'amber'

export interface Mark {
  tone: Tone
  /** 右側標註，例：偏高／偏低／建議重測 */
  note: string
}

/** 會被標記的列。前三個是自動計算出來的，其餘是登記欄位名 */
export type MarkKey =
  | 'bmi' | 'whr' | 'body_fat_pct' | 'waist_cm' | 'sbp' | 'dbp' | 'pulse' | 'spo2'

export type Marks = Partial<Record<MarkKey, Mark>>

const num = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v)

/**
 * age 為 null＝年級未確認，BMI 就不判。
 * 不要在這裡挑一列來湊——套錯一列（15 歲過重 22.9 vs 18 歲 24.0）會冤枉人。
 */
export function marksOf(m: HealthMeasurement | null, age: BmiAge | null): Marks {
  const out: Marks = {}
  if (!m) return out

  if (num(m.height_cm) && num(m.weight_kg) && m.height_cm > 0) {
    const bmi = calcBmi(m.height_cm, m.weight_kg)
    const v = judgeBmi(bmi, age)
    // 一律 amber —— 見檔案開頭的分層原則。學生端該亮橘燈還是亮橘燈，
    // 那是「值得投入改善的方向」，與教師端「今天要不要處理」是兩回事。
    if (v && v.level !== 'g') {
      out.bmi = {
        tone: 'amber',
        note: v.label === '目前偏低' ? '偏低' : v.level === 'o' ? '偏高' : '略高',
      }
    }
  }

  if (num(m.waist_cm) && num(m.hip_cm) && m.hip_cm > 0) {
    const v = judgeWhr(calcWhr(m.waist_cm, m.hip_cm))
    if (v.level !== 'g') {
      out.whr = { tone: 'amber', note: v.level === 'o' ? '偏高' : '略高' }
    }
  }

  // 體脂率：30 歲以下男性正常 14–20%，≥ 25% 為肥胖
  if (num(m.body_fat_pct)) {
    const { low, high, obese } = BODY_FAT_MALE_U30
    if (m.body_fat_pct >= obese) out.body_fat_pct = { tone: 'amber', note: '偏高' }
    else if (m.body_fat_pct > high) out.body_fat_pct = { tone: 'amber', note: '略高' }
    else if (m.body_fat_pct < low) out.body_fat_pct = { tone: 'amber', note: '偏低' }
  }

  // 腰圍：男性 > 90 公分為肥胖。課本寫的是「大於」，所以剛好 90.0 不標
  if (num(m.waist_cm) && m.waist_cm > WAIST_MALE_OBESE) {
    out.waist_cm = { tone: 'amber', note: '偏高' }
  }

  if (num(m.sbp) && num(m.dbp)) {
    const v = judgeBp(m.sbp, m.dbp)
    if (v.level !== 'g') {
      // 判斷用合併的（收縮、舒張任一越線就算），但標記標在真的越線的那一列，
      // 免得舒張壓 70 也跟著變紅字
      const mark: Mark = v.level === 'o'
        ? { tone: 'red', note: '建議重測' }
        : { tone: 'amber', note: '略高' }
      const hiS = v.level === 'o' ? m.sbp >= 140 : m.sbp >= 120
      const hiD = v.level === 'o' ? m.dbp >= 90 : m.dbp >= 80
      if (hiS) out.sbp = mark
      if (hiD) out.dbp = mark
    }
  }

  if (num(m.pulse)) {
    if (m.pulse > 100) out.pulse = { tone: 'red', note: '偏快' }
    else if (m.pulse < 50) out.pulse = { tone: 'red', note: '偏慢' }
  }

  if (num(m.spo2) && m.spo2 < 95) out.spo2 = { tone: 'red', note: '偏低' }

  return out
}

/** 標記的中文名稱，給摘要與 CSV 用 */
export const MARK_LABEL: Record<MarkKey, string> = {
  bmi: 'BMI', whr: '腰臀比', body_fat_pct: '體脂率', waist_cm: '腰圍',
  sbp: '收縮壓', dbp: '舒張壓', pulse: '脈搏', spo2: '血氧',
}

/** 要注意的項目，紅的排前面——摘要那一欄位置有限，先看到今天要處理的 */
export function markList(marks: Marks): { key: MarkKey; label: string; mark: Mark }[] {
  return (Object.keys(MARK_LABEL) as MarkKey[])
    .filter((k) => marks[k])
    .map((k) => ({ key: k, label: MARK_LABEL[k], mark: marks[k]! }))
    .sort((a, b) => Number(b.mark.tone === 'red') - Number(a.mark.tone === 'red'))
}

/** 例：「收縮壓 建議重測、BMI 偏高」；沒有要注意的回空字串。CSV 用這個 */
export function marksSummary(marks: Marks): string {
  return markList(marks).map((m) => `${m.label} ${m.mark.note}`).join('、')
}

export const hasRed = (marks: Marks) => Object.values(marks).some((m) => m.tone === 'red')
