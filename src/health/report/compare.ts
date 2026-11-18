/**
 * 期末成果：期初 vs 期末的比較與評語。
 *
 * 純函式，不碰資料庫也不碰畫面——學生成果頁與之後的列印都用這一份，
 * 兩邊算出來的增減與評語不會各說各話。
 *
 * ── 評語 ───────────────────────────────────────────────────────────
 * 依「身體年齡增減」（期末 − 期初）分六級，取代 114 學年 Google 試算表的
 *   =IFS(BY2>5,…, BY2<0,…, BY2=0～5,…)
 * 舊版把 0～+5 歲全部當成「維持」，+5 歲和 0 歲拿到同一句話。
 * 新分級與文字由蕾蕾老師 2026-11-18 確認（見工作日誌），要改文字改 BODY_AGE_TIERS。
 *
 * ── 進步亮點 ───────────────────────────────────────────────────────
 * 身體年齡變老的同學，也該看得到自己哪裡有進步，所以另外挑幾項
 * 「方向明確」的指標（骨骼肌率越高越好、體脂率／內臟脂肪／腰圍越低越好）。
 *
 * HIGHLIGHT_MIN 是**畫面用的最小變化量，不是醫學門檻**：
 * 體脂機同一個人連量兩次也會差個零點幾，差 0.1 就說「進步了」不誠實。
 * 數字是先抓的，蕾蕾老師可以調。
 *
 * 體重、BMI 不列入亮點，也不標好壞：增減對每個人的意義不同
 * （偏瘦的人體重上升是好事），而且規格第八節不顯示減重公斤數。
 */
import { calcBmi, calcFatKg, calcWhr } from '../rules'
import type { HealthMeasurement } from '../../lib/types'

/* ------------------------------------------------------------ 指標定義 */

/** better：哪個方向算進步；null＝不評好壞，只呈現數字 */
export interface Metric {
  key: string
  label: string
  unit: string
  dp: number
  better: 'up' | 'down' | null
  get: (m: HealthMeasurement) => number | null
}

const col = (k: keyof HealthMeasurement) => (m: HealthMeasurement) => {
  const v = m[k]
  return v === null || v === undefined || v === '' ? null : Number(v)
}

const both = (a: number | null, b: number | null) => a !== null && b !== null

export const MAIN_METRICS: Metric[] = [
  { key: 'weight_kg', label: '體重', unit: 'kg', dp: 1, better: null, get: col('weight_kg') },
  { key: 'body_fat_pct', label: '體脂率', unit: '%', dp: 1, better: 'down', get: col('body_fat_pct') },
  {
    key: 'fat_kg', label: '體脂重量', unit: 'kg', dp: 1, better: null,
    get: (m) => (both(m.weight_kg, m.body_fat_pct) ? calcFatKg(Number(m.weight_kg), Number(m.body_fat_pct)) : null),
  },
  {
    key: 'bmi', label: 'BMI', unit: '', dp: 1, better: null,
    get: (m) => (both(m.height_cm, m.weight_kg) ? calcBmi(Number(m.height_cm), Number(m.weight_kg)) : null),
  },
  { key: 'waist_cm', label: '腰圍', unit: 'cm', dp: 1, better: 'down', get: col('waist_cm') },
  { key: 'hip_cm', label: '臀圍', unit: 'cm', dp: 1, better: null, get: col('hip_cm') },
  {
    key: 'whr', label: '腰臀比', unit: '', dp: 2, better: null,
    get: (m) => (both(m.waist_cm, m.hip_cm) ? calcWhr(Number(m.waist_cm), Number(m.hip_cm)) : null),
  },
  { key: 'visceral_fat', label: '內臟脂肪', unit: '級', dp: 1, better: 'down', get: col('visceral_fat') },
  { key: 'bmr_kcal', label: '基礎代謝率', unit: 'kcal', dp: 0, better: null, get: col('bmr_kcal') },
  { key: 'sbp', label: '收縮壓', unit: 'mmHg', dp: 0, better: null, get: col('sbp') },
  { key: 'dbp', label: '舒張壓', unit: 'mmHg', dp: 0, better: null, get: col('dbp') },
  { key: 'pulse', label: '脈搏', unit: '次/分', dp: 0, better: null, get: col('pulse') },
  { key: 'spo2', label: '血氧濃度', unit: '%', dp: 0, better: null, get: col('spo2') },
]

const PARTS = [
  ['whole', '全身'], ['trunk', '軀幹'], ['arms', '雙臂'], ['legs', '雙腿'],
] as const

export const SUBCUT_METRICS: Metric[] = PARTS.map(([p, name]) => ({
  key: `subcut_${p}`, label: name, unit: '%', dp: 1,
  better: p === 'whole' ? 'down' : null,
  get: col(`subcut_${p}` as keyof HealthMeasurement),
}))

export const MUSCLE_METRICS: Metric[] = PARTS.map(([p, name]) => ({
  key: `muscle_${p}`, label: name, unit: '%', dp: 1,
  better: p === 'whole' ? 'up' : null,
  get: col(`muscle_${p}` as keyof HealthMeasurement),
}))

/* ------------------------------------------------------------ 比較 */

export interface Row {
  metric: Metric
  before: number | null
  after: number | null
  /** 已依 dp 四捨五入後再相減，避免 0.30000000004 這種尾巴；兩邊缺一就是 null */
  delta: number | null
}

const roundTo = (v: number, dp: number) => {
  const f = 10 ** dp
  return Math.round(v * f) / f
}

export function compare(metrics: Metric[], a: HealthMeasurement, b: HealthMeasurement): Row[] {
  return metrics.map((metric) => {
    const x = metric.get(a)
    const y = metric.get(b)
    const before = x === null ? null : roundTo(x, metric.dp)
    const after = y === null ? null : roundTo(y, metric.dp)
    const delta = before === null || after === null ? null : roundTo(after - before, metric.dp)
    return { metric, before, after, delta }
  })
}

/** 「+1.2」「−0.5」「0」；用全形減號，手機上比較不會跟連字號混在一起 */
export function signed(v: number, dp: number): string {
  if (v === 0) return '0'
  return `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(dp)}`
}

/* ------------------------------------------------------------ 身體年齡評語 */

export interface BodyAgeTier {
  /** 這一級的範圍（含兩端）；Infinity 表示沒有上／下限 */
  min: number
  max: number
  text: (n: number) => string
}

/** 2026-11-18 蕾蕾老師確認的六級。n＝增減的絕對值 */
export const BODY_AGE_TIERS: BodyAgeTier[] = [
  { min: -Infinity, max: -3, text: (n) => `身體年齡年輕了 ${n} 歲！這學期的努力，身體都記得。` },
  { min: -2, max: -1, text: (n) => `身體年齡年輕了 ${n} 歲，小小的進步也是真的進步，繼續保持！` },
  { min: 0, max: 0, text: () => '身體年齡穩穩守住了。能維持，就是一種用心。' },
  { min: 1, max: 3, text: (n) => `身體年齡多了 ${n} 歲。這個數字會隨睡眠、作息、量測時間起伏，看看下面哪一項有進步，從那裡繼續。` },
  { min: 4, max: 5, text: (n) => `身體年齡多了 ${n} 歲，身體在提醒你多照顧自己一點。挑一個最容易做到的習慣，從這週開始。` },
  { min: 6, max: Infinity, text: (n) => `身體年齡多了 ${n} 歲，這是值得認真看待的訊號。下學期我們一起找出原因，老師陪你調整。` },
]

/**
 * 身體年齡是整數（體脂機只給整數），但資料庫型別若哪天改成小數，
 * 這裡先四捨五入成整數再分級，不會有 0.5 歲落在兩級之間沒有評語。
 */
export function bodyAgeComment(delta: number | null): string | null {
  if (delta === null || Number.isNaN(delta)) return null
  const d = Math.round(delta)
  const tier = BODY_AGE_TIERS.find((t) => d >= t.min && d <= t.max)!
  return tier.text(Math.abs(d))
}

/* ------------------------------------------------------------ 進步亮點 */

/** 畫面用的最小變化量（不是醫學門檻），見檔頭說明 */
export const HIGHLIGHT_MIN: Record<string, number> = {
  muscle_whole: 0.5,
  body_fat_pct: 0.5,
  subcut_whole: 0.5,
  visceral_fat: 0.5,
  waist_cm: 1.0,
}

const HIGHLIGHT_ORDER: { key: string; name: string; metrics: Metric[] }[] = [
  { key: 'muscle_whole', name: '全身骨骼肌率', metrics: MUSCLE_METRICS },
  { key: 'body_fat_pct', name: '體脂率', metrics: MAIN_METRICS },
  { key: 'visceral_fat', name: '內臟脂肪', metrics: MAIN_METRICS },
  { key: 'waist_cm', name: '腰圍', metrics: MAIN_METRICS },
  { key: 'subcut_whole', name: '全身皮下脂肪率', metrics: SUBCUT_METRICS },
]

/** 每一項寫成「從 A 降到 B」：比「下降 1.2%」精確，不會把百分點說成百分比 */
export function highlights(a: HealthMeasurement, b: HealthMeasurement): string[] {
  const out: string[] = []
  for (const h of HIGHLIGHT_ORDER) {
    const metric = h.metrics.find((m) => m.key === h.key)!
    const [row] = compare([metric], a, b)
    if (row.delta === null || row.before === null || row.after === null) continue
    const gain = metric.better === 'up' ? row.delta : -row.delta
    if (gain < HIGHLIGHT_MIN[h.key]) continue
    const verb = metric.better === 'up' ? '升到' : '降到'
    const u = metric.unit === '%' ? '%' : metric.unit === '級' ? ' 級' : ` ${metric.unit}`
    // 內臟脂肪是整數級或半級，「6.0 級」讀起來怪，整數就不印小數
    const f = (v: number) => (metric.unit === '級' && Number.isInteger(v) ? String(v) : v.toFixed(metric.dp))
    out.push(`${h.name}從 ${f(row.before)}${u} ${verb} ${f(row.after)}${u}`)
  }
  return out
}

/** 一句話把亮點串起來；沒有亮點就不說，不硬擠一句客套話 */
export function highlightSentence(items: string[]): string | null {
  if (items.length === 0) return null
  return `這學期你的${items.join('、')}，這些都是你努力的證據！`
}
