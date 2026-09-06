/**
 * 燈號判定門檻。
 *
 * 【送出前請老師確認】規格書第 4 節列了兩件事：
 *   1. BMI 目前用 18 歲以上成人標準（18.5 / 24 / 27）。若班上有未滿 18 歲的
 *      學生，請改用衛福部「兒童及青少年生長身體質量指數建議值」的年齡別數字。
 *   2. 腰臀比用男性標準（0.90 / 0.95）。
 *
 * 用詞一律中性：不出現「異常」「高血壓」「肥胖」，也不顯示目標體重或該減幾公斤。
 * 紅色警示只做在教師端，學生端維持三色燈號。
 */
export type Level = 'g' | 'y' | 'o'

export interface Verdict {
  level: Level
  label: string
  msg: string
}

const BMI_RULES: { max: number; v: Verdict }[] = [
  { max: 18.5, v: { level: 'y', label: '目前偏低', msg: '體重相對身高偏低，均衡吃夠三餐是這學期可以留意的方向。' } },
  { max: 24, v: { level: 'g', label: '在理想範圍', msg: '維持現在的作息和活動量就很好。' } },
  { max: 27, v: { level: 'y', label: '稍微偏高', msg: '有調整空間，從飲食和活動量著手都會有幫助。' } },
  { max: Infinity, v: { level: 'o', label: '建議留意', msg: '這是一個值得投入改善的方向，我們會在課堂上一起討論做法。' } },
]

const WHR_RULES: { max: number; v: Verdict }[] = [
  { max: 0.90, v: { level: 'g', label: '在理想範圍', msg: '腰腹脂肪分布在合適的範圍。' } },
  { max: 0.95, v: { level: 'y', label: '可以留意', msg: '增加日常活動量對這個數字最有幫助。' } },
  { max: Infinity, v: { level: 'o', label: '建議留意', msg: '腰腹脂肪較多，規律活動是最直接的方式。' } },
]

export function judgeBmi(bmi: number): Verdict {
  return BMI_RULES.find((r) => bmi < r.max)!.v
}

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

/** 前端現算，不存資料庫（規格書：存原始值，避免資料不一致） */
export const calcBmi = (h: number, w: number) => w / Math.pow(h / 100, 2)
export const calcFatKg = (w: number, pct: number) => (w * pct) / 100
export const calcWhr = (waist: number, hip: number) => waist / hip
