/**
 * 燈號判定門檻。
 *
 * 【BMI】⚠️ 出處待查證，2026-09-19 起這組數字視為**未經證實**，不要再引用。
 *
 * 這三個數字（過輕 < 17.7、過重 ≥ 21.9、肥胖 ≥ 23.2）在 commit 8c1555a
 * 被寫成「衛福部國民健康署《兒童及青少年生長身體質量指數（BMI）建議值》
 * 的 18 歲男生一列」，但那次 commit 沒有留下任何查證紀錄，回頭也對不到原表。
 *
 * 用本校 2026-09-19 的 158 筆期初資料反推，這組數字站不住腳：
 *   ≥ 21.9（號稱「過重」＝第 85 百分位）落在 49.4%，而本校中位數是 21.8
 *   ≥ 23.2（號稱「肥胖」＝第 95 百分位）落在 38.0%
 * 國健署那張表的定義就是「超過該年齡層第 85 百分位為過重、第 95 為肥胖」。
 * 一個號稱第 95 百分位的切點抓到 38% 的人，差了將近八倍；
 * 而號稱第 85 百分位的切點正好落在本校中位數上。就算本校男生確實比
 * 2010–11 全國常模重（本校 p85 ＝ 26.8、p95 ＝ 29.3），也解釋不了這個差距。
 *
 * 最可能的情況是這組數字根本不是 17～18 歲男生那幾列。
 * 在拿到官方表格逐列核對之前，**不要拿這組門檻去跟學生或家長談**。
 *
 * 參考：國健署對 18 歲以上成人的體位標準是
 * 過輕 < 18.5、健康體重 18.5–24、過重 24–27、肥胖 ≥ 27（原型當初用的就是這組）。
 * 高三學生約 17.5～18 歲，正好落在成人標準的邊界上。
 * 要改成哪一組由蕾蕾決定，見 docs/待辦.md。
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
