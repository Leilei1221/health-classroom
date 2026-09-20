/**
 * 整班匯出 CSV。
 *
 * 給老師自己留底和做課程分析用，所以欄位開好開滿：登記的 20 欄、三個自動計算、
 * 七份量表的分數與分級、餐盤的份數。這份檔案含分數，跟這一頁一樣不能投影。
 *
 * 欄位定義直接從 fields.ts 的 ALL_FIELDS 生出來，不另外抄一份：
 * 登記頁加欄位時匯出會自己跟上，不會出現「畫面上有、匯出沒有」。
 */
import { ALL_FIELDS } from '../fields'
import { calcBmi, calcFatKg, calcWhr } from '../rules'
import { SCALES } from '../selfcheck/scales'
import { outcomeFromRow } from '../selfcheck/state'
import { CAT, CAT_KEYS } from '../plate/foods'
import { H85210_KEYS, H85210_SHORT } from './labels'
import { marksOf, marksSummary } from './thresholds'
import type { DetailStudent } from '../api'
import type { BmiAge } from '../rules'
import type { HealthMeasurement, MeasurementRound } from '../../lib/types'

/*
  Excel 會把 = + @ 開頭的欄位當公式執行。體脂機編號是學生自己打的自由文字，
  姓名也可能被改過，所以輸出前一律擋掉。負號要放行，不然數字會被加上引號。
*/
const RISKY = /^[=+@\t\r]/
function guard(s: string): string {
  if (RISKY.test(s)) return `'${s}`
  if (s.startsWith('-') && Number.isNaN(Number(s))) return `'${s}`
  return s
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = guard(String(v))
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const toCsv = (rows: unknown[][]): string =>
  rows.map((r) => r.map(cell).join(',')).join('\r\n')

const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100

const num = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v)

/** 一列量測的自動計算；算不出來（缺欄位）回 null，不要輸出 0 */
export function computed(m: HealthMeasurement | null) {
  const bmi = m && num(m.height_cm) && num(m.weight_kg) && m.height_cm > 0
    ? round1(calcBmi(m.height_cm, m.weight_kg)) : null
  const fatKg = m && num(m.weight_kg) && num(m.body_fat_pct)
    ? round1(calcFatKg(m.weight_kg, m.body_fat_pct)) : null
  const whr = m && num(m.waist_cm) && num(m.hip_cm) && m.hip_cm > 0
    ? round2(calcWhr(m.waist_cm, m.hip_cm)) : null
  return { bmi, fatKg, whr }
}

const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('zh-TW', { hour12: false }) : ''

export function header(): string[] {
  return [
    '班級', '座號', '學號', '姓名', '登入帳號',
    '測量時間',
    ...ALL_FIELDS.map((f) => (f.unit ? `${f.label}(${f.unit})` : f.label)),
    'BMI', '體脂重量(kg)', '腰臀比', '需要注意的項目',
    '生活型態・綠燈題數', '生活型態・黃燈題數', '生活型態・紅燈題數', '生活型態・紅燈題號',
    '85210・達成項數',
    ...H85210_KEYS.map((k) => `85210・${H85210_SHORT[k] ?? k}`),
    '飲食金字塔・類型', '飲食金字塔・說明',
    '睡眠檢測・分數', '睡眠檢測・分級',
    '心情溫度計・分數', '心情溫度計・分級',
    '壓力偵測站・項數', '壓力偵測站・分級',
    '情緒自我檢視表・分數', '情緒自我檢視表・分級', '情緒自我檢視表・第20題',
    '需要關懷',
    '餐盤・通過條數', '餐盤・總條數', '餐盤・熱量', '餐盤・熱量建議',
    ...CAT_KEYS.map((k) => `餐盤・${CAT[k].nm}(${CAT[k].unit})`),
    '餐盤・喝水(c.c.)', '餐盤・含糖飲料(c.c.)', '餐盤・吃了什麼',
    '自我檢測最後更新',
  ]
}

export function row(
  className: string, s: DetailStudent, round: MeasurementRound, age: BmiAge | null,
): unknown[] {
  const m = s.rounds[round]
  const c = computed(m)
  const sc = s.selfcheck
  const o = (k: Parameters<typeof outcomeFromRow>[1]) => outcomeFromRow(sc, k)

  const life = o('lifestyle')?.zones ?? null
  const h = o('h85210')
  const pyr = o('pyramid')
  const sleep = o('sleep')
  const mood = o('mood')
  const stress = o('stress')
  const dep = o('depression')
  const plate = sc?.plate ?? null

  return [
    className, s.seat_no, s.student_no, s.name, s.account,
    when(m?.measured_at),
    ...ALL_FIELDS.map((f) => (m ? (m as unknown as Record<string, unknown>)[f.key] ?? '' : '')),
    c.bmi, c.fatKg, c.whr, marksSummary(marksOf(m, age)),
    life?.green.length ?? '', life?.yellow.length ?? '', life?.red.length ?? '',
    life ? life.red.join(' ') : '',
    h?.score ?? '',
    ...H85210_KEYS.map((k) => (h ? (sc?.h85210?.[k] === true ? '是' : '否') : '')),
    pyr?.dietType ?? '', pyr?.dietType ? SCALES.pyramid.results![pyr.dietType].nm : '',
    sleep?.score ?? '', sleep?.band?.label ?? '',
    mood?.score ?? '', mood?.band?.label ?? '',
    stress?.score ?? '', stress?.band?.label ?? '',
    dep?.score ?? '', dep?.band?.label ?? '', dep ? (dep.critical ? '是' : '否') : '',
    sc ? (sc.needs_followup ? '是' : '否') : '',
    plate?.matched ?? '', plate?.total ?? '', plate?.kcal ?? '', plate?.kcalTarget ?? '',
    ...CAT_KEYS.map((k) => plate?.[k] ?? ''),
    plate?.water ?? '', plate?.sugar ?? '',
    plate ? plate.items.map((i) => (i.n > 1 ? `${i.name}×${i.n}` : i.name)).join('、') : '',
    when(sc?.updated_at),
  ]
}

export function buildClassCsv(
  className: string, students: DetailStudent[], round: MeasurementRound, age: BmiAge | null,
): string {
  return toCsv([header(), ...students.map((s) => row(className, s, round, age))])
}

/**
 * 存檔。BOM 是必要的：沒有它，Excel 會把 UTF-8 的中文開成亂碼。
 */
export function downloadCsv(filename: string, text: string): void {
  const blob = new Blob([`﻿${text}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 立刻 revoke 在部分瀏覽器會讓下載中斷，等一拍再收
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
