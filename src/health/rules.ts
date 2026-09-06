/**
 * 燈號判定門檻。
 *
 * 【BMI】採衛福部國民健康署「兒童及青少年生長身體質量指數（BMI）建議值」
 * 的 18 歲男生一列：過輕 < 17.7、正常 17.7–21.9、過重 ≥ 21.9、肥胖 ≥ 23.2。
 * 不是成人的 18.5 / 24 / 27 —— 高三學生多數尚未滿 18 或剛滿 18，
 * 套成人標準會把偏瘦的學生判成正常、把正常的判成偏低。
 *
 * 【腰臀比】0.90 / 0.95 是男性標準。WHO 2008 年專家諮詢報告的門檻是
 * 男性 ≥ 0.90、女性 ≥ 0.85 為風險顯著增加。
 *
 * 【已知限制，日後要擴充時看這裡】
 * 兩組門檻目前都只有男性、且 BMI 只有 18 歲那一列。這是刻意的：
 * 本校學生以男性為主，這學期不會教到女生班，且 hc_students.gender
 * 現在全部是空的（Excel 名單沒有這欄），就算寫了性別分支也無從判斷。
 * 若日後要支援女生或其他年齡，需要：
 *   1. 名單匯入補上性別，hc_my_student_profile() 一併回傳 gender
 *   2. BMI 改成年齡別（需要生日或年齡，目前資料裡也沒有）
 *   3. 女性腰臀比門檻改為 0.85
 * 在那之前不要偷偷套男性標準到女生身上，寧可顯示「需要更多資料才能判定」。
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

// 國健署 18 歲男生：過輕 < 17.7｜正常 17.7–21.9｜過重 ≥ 21.9｜肥胖 ≥ 23.2
const BMI_RULES: { max: number; v: Verdict }[] = [
  { max: 17.7, v: { level: 'y', label: '目前偏低', msg: '體重相對身高偏低，均衡吃夠三餐是這學期可以留意的方向。' } },
  { max: 21.9, v: { level: 'g', label: '在理想範圍', msg: '維持現在的作息和活動量就很好。' } },
  { max: 23.2, v: { level: 'y', label: '稍微偏高', msg: '有調整空間，從飲食和活動量著手都會有幫助。' } },
  { max: Infinity, v: { level: 'o', label: '建議留意', msg: '這是一個值得投入改善的方向，我們會在課堂上一起討論做法。' } },
]

// 男性標準；WHO 2008：男性 ≥ 0.90 即為風險顯著增加，女性門檻為 0.85
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
