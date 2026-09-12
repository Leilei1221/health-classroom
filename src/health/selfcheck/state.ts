/**
 * 量表結果與資料庫欄位之間的換算。
 *
 * 分級一律在前端現算（交接文件的設計決定 4），資料庫只存分數與旗標，
 * 所以「剛做完」和「回頭看上次的結果」兩種情況可以走同一段顯示程式。
 */
import type { HealthSelfcheck, LifestyleZones } from '../../lib/types'
import type { SelfcheckPatch } from '../api'
import { FOLLOWUP, SCALES, type Band, type DietType, type ScaleKey } from './scales'

export interface ScaleOutcome {
  /** light 型不以分數呈現，其餘為分數或項數 */
  score: number | null
  zones: LifestyleZones | null
  dietType: DietType | null
  band: Band | null
  critical: boolean
  /** 要不要顯示關懷文案 */
  flag: boolean
}

function bandOf(key: ScaleKey, score: number): Band | null {
  const bands = SCALES[key].bands
  if (!bands) return null
  return bands.find((b) => score <= b.max) ?? bands[bands.length - 1]
}

function build(key: ScaleKey, opts: {
  score?: number | null
  zones?: LifestyleZones | null
  dietType?: DietType | null
  critical?: boolean
}): ScaleOutcome {
  const score = opts.score ?? null
  const critical = opts.critical === true
  const flag = (score !== null && (FOLLOWUP[key]?.(score) ?? false)) || critical
  return {
    score,
    zones: opts.zones ?? null,
    dietType: opts.dietType ?? null,
    band: score === null ? null : bandOf(key, score),
    critical,
    flag,
  }
}

/** 這一份做完了沒有；沒做回傳 null */
export function outcomeFromRow(
  row: HealthSelfcheck | null, key: ScaleKey,
): ScaleOutcome | null {
  if (!row) return null
  switch (key) {
    case 'lifestyle':
      return row.lifestyle ? build(key, { zones: row.lifestyle }) : null
    case 'h85210': {
      const keys = SCALES.h85210.keys ?? []
      const saved = row.h85210 ?? {}
      if (!keys.some((k) => k in saved)) return null
      return build(key, { score: keys.filter((k) => saved[k] === true).length })
    }
    case 'pyramid':
      return row.diet_type ? build(key, { dietType: row.diet_type }) : null
    case 'sleep':
      return row.sleep_isi === null ? null : build(key, { score: row.sleep_isi })
    case 'mood':
      return row.mood_scale === null ? null : build(key, { score: row.mood_scale })
    case 'stress':
      return row.stress_level === null ? null : build(key, { score: row.stress_level })
    case 'depression':
      return row.depression === null
        ? null
        : build(key, { score: row.depression, critical: row.depression_critical })
  }
}

/**
 * 把作答算成結果與要寫進資料庫的欄位。
 * ans 依題目順序，light 為 0/1/2，check 與 yn 為 0/1，likert 為 0–4。
 */
export function gradeAnswers(
  key: ScaleKey, ans: number[],
): { outcome: ScaleOutcome; patch: SelfcheckPatch } {
  const s = SCALES[key]

  if (key === 'lifestyle') {
    const z: number[][] = [[], [], []]
    ans.forEach((v, i) => z[v].push(i + 1))
    const zones: LifestyleZones = { green: z[0], yellow: z[1], red: z[2] }
    return { outcome: build(key, { zones }), patch: { lifestyle: zones } }
  }

  const score = ans.reduce((a, b) => a + (b || 0), 0)

  if (key === 'h85210') {
    const keys = s.keys ?? []
    const h85210: Record<string, boolean> = {}
    keys.forEach((k, i) => { h85210[k] = ans[i] === 1 })
    return { outcome: build(key, { score }), patch: { h85210 } }
  }

  if (key === 'depression') {
    const critical = s.critical !== undefined && ans[s.critical] === 1
    return {
      outcome: build(key, { score, critical }),
      patch: { depression: score, depression_critical: critical },
    }
  }

  const column = { sleep: 'sleep_isi', mood: 'mood_scale', stress: 'stress_level' } as const
  const col = column[key as keyof typeof column]
  return { outcome: build(key, { score }), patch: { [col]: score } as SelfcheckPatch }
}

/** 飲食金字塔走完決策樹 */
export function gradeDiet(letter: DietType): { outcome: ScaleOutcome; patch: SelfcheckPatch } {
  return { outcome: build('pyramid', { dietType: letter }), patch: { diet_type: letter } }
}
