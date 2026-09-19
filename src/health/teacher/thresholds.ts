/**
 * 教師端的數值判讀：哪一列要標紅、標琥珀，右邊寫什麼。
 *
 * BMI／腰臀比／血壓三項直接呼叫 rules.ts 的 judgeBmi／judgeWhr／judgeBp，
 * 不在這裡另外寫一組數字。學生看到的燈號和老師看到的紅字必須出自同一個判斷，
 * 否則會變成學生說「我的是綠燈」、老師說「你這個要重測」，兩邊各說各話。
 *
 * 原型 docs/教師端進度看板_原型.html 的 judge() 用的是成人 BMI 24／27，
 * 這裡刻意沒有照抄——理由見 rules.ts 開頭：高三學生要用國健署 18 歲那一列
 * （過輕 < 17.7、過重 ≥ 21.9、肥胖 ≥ 23.2）。套成人標準會把偏瘦的判成正常。
 *
 * 脈搏與血氧學生端沒有燈號，門檻取自原型：
 * 血氧 < 95 偏低、脈搏 > 100 偏快、脈搏 < 50 偏慢。
 *
 * 其餘欄位（體脂率、內臟脂肪、基礎代謝率、身體年齡、皮下脂肪率、骨骼肌率）
 * 目前沒有議定好的門檻，一律不標記。寧可不標，也不要自己編一組數字出來——
 * 這些數字會被老師拿去跟學生談話，標錯的代價是實的。
 */
import { calcBmi, calcWhr, judgeBmi, judgeBp, judgeWhr } from '../rules'
import type { HealthMeasurement } from '../../lib/types'

/** red＝建議老師看一眼、必要時請學生重測；amber＝邊界值 */
export type Tone = 'red' | 'amber'

export interface Mark {
  tone: Tone
  /** 右側標註，例：偏高／偏低／建議重測 */
  note: string
}

/** 會被標記的列。前三個是自動計算出來的，其餘是登記欄位名 */
export type MarkKey = 'bmi' | 'whr' | 'sbp' | 'dbp' | 'pulse' | 'spo2'

export type Marks = Partial<Record<MarkKey, Mark>>

const num = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v)

export function marksOf(m: HealthMeasurement | null): Marks {
  const out: Marks = {}
  if (!m) return out

  if (num(m.height_cm) && num(m.weight_kg) && m.height_cm > 0) {
    const bmi = calcBmi(m.height_cm, m.weight_kg)
    const v = judgeBmi(bmi)
    if (v.level !== 'g') {
      // rules.ts 的過輕只有一級（< 17.7，判 y），所以偏低不會是紅的
      out.bmi = bmi < 17.7
        ? { tone: 'amber', note: '偏低' }
        : { tone: v.level === 'o' ? 'red' : 'amber', note: v.level === 'o' ? '偏高' : '略高' }
    }
  }

  if (num(m.waist_cm) && num(m.hip_cm) && m.hip_cm > 0) {
    const v = judgeWhr(calcWhr(m.waist_cm, m.hip_cm))
    if (v.level !== 'g') {
      out.whr = v.level === 'o'
        ? { tone: 'red', note: '偏高' }
        : { tone: 'amber', note: '略高' }
    }
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
  bmi: 'BMI', whr: '腰臀比', sbp: '收縮壓', dbp: '舒張壓', pulse: '脈搏', spo2: '血氧',
}

/** 例：「BMI 偏高、收縮壓 建議重測」；沒有要注意的回空字串 */
export function marksSummary(marks: Marks): string {
  return (Object.keys(MARK_LABEL) as MarkKey[])
    .filter((k) => marks[k])
    .map((k) => `${MARK_LABEL[k]} ${marks[k]!.note}`)
    .join('、')
}

export const hasRed = (marks: Marks) => Object.values(marks).some((m) => m.tone === 'red')
