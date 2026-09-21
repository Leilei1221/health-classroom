import type { HealthMeasurement, HealthSelfcheck } from '../../lib/types'
import {
  CURRENT_STATE, EXERCISES, SUGGESTIONS,
  type CurrentState, type Domain, type Exercise, type Suggestion,
} from '../selfcheck/suggestions'
import {
  STUDENT_GRADE, bmiAge, calcBmi, calcWhr, judgeBmi, judgeBp, judgeWhr,
  type Verdict,
} from '../rules'
import { ROUND } from '../api'

type Priority = 1 | 2 | 3
type Weight = 1 | 2 | 3

export interface Signal {
  key: string
  label: string
  value: string
  verdict: Verdict | null
}

export interface FocusItem {
  trigger: string
  domain: Domain
  title: string
  priority: Priority
  weight: Weight
  state: CurrentState
  firstStep: string
}

export interface StudentAnalysis {
  signals: Signal[]
  focuses: FocusItem[]
  suggestions: Suggestion[]
  exercises: Exercise[]
  ready: boolean
  hasMeasurement: boolean
  hasSelfcheck: boolean
}

const STATE_BY_TRIGGER = new Map(CURRENT_STATE.map((s) => [s.trigger, s]))

const FALLBACK_STATE: Record<string, CurrentState> = {
  skip_breakfast: {
    trigger: 'skip_breakfast',
    now: '早餐在你的日常裡還不夠穩定。',
    why: '早餐能讓上午的專注力比較穩，第二三節課比較不容易恍神。',
  },
  sedentary: {
    trigger: 'sedentary',
    now: '你可以再多累積一些日常活動量。',
    why: '零碎活動比較容易維持，也能慢慢改善久坐帶來的疲累感。',
  },
  diet_type_ABCDF: {
    trigger: 'diet_type_ABCDF',
    now: '你的飲食組成還有一些可以調整的地方。',
    why: '先把六大類食物補齊，比追求完美飲食更容易做到。',
  },
  whr_amber: {
    trigger: 'whr_amber',
    now: '你的腰臀比可以留意一下。',
    why: '增加日常活動量和規律運動，對腰腹脂肪分布最直接。',
  },
}

const TRIGGER_DOMAIN: Record<string, Domain> = {
  sleep_under_6: 'sleep',
  sleep_6_7: 'sleep',
  sleep_onset: 'sleep',
  veg_under_3: 'diet',
  sugar_drink: 'diet',
  skip_breakfast: 'diet',
  fried_food: 'diet',
  diet_type_ABCDF: 'diet',
  exercise_under_1h: 'activity',
  sedentary: 'activity',
  whr_amber: 'activity',
  stress_high: 'stress',
  mood_low: 'stress',
  water_under_target: 'hydration',
  screen_over_2h: 'screen',
  bp_amber: 'diet',
  bmi_amber_high: 'diet',
  bmi_amber_low: 'diet',
}

const FIRST_STEP: Record<string, string> = {
  bp_amber: '下次量血壓前先坐著休息 5 分鐘，再把數字告訴老師。',
  bmi_amber_high: '今天先挑一餐，照「先菜、再肉、最後飯」的順序吃。',
  bmi_amber_low: '明天早餐加一份蛋白質，例如蛋、無糖豆漿或鮮奶。',
  whr_amber: '今天先走一段樓梯，或晚自習後伸展 5 分鐘。',
}

function stateFor(trigger: string): CurrentState {
  return STATE_BY_TRIGGER.get(trigger) ?? FALLBACK_STATE[trigger] ?? {
    trigger,
    now: '你有一個生活習慣可以先從小地方調整。',
    why: '一次只改一件事，比同時改很多件事更容易維持。',
  }
}

function addFocus(
  list: FocusItem[],
  trigger: string,
  priority: Priority,
  weight: Weight,
  title?: string,
) {
  const domain = TRIGGER_DOMAIN[trigger]
  if (!domain || list.some((f) => f.trigger === trigger)) return
  const firstSuggestion = SUGGESTIONS.find((s) => s.domain === domain)
  const state = stateFor(trigger)
  list.push({
    trigger,
    domain,
    priority,
    weight,
    state,
    title: title ?? state.now,
    firstStep: FIRST_STEP[trigger] ?? firstSuggestion?.firstStep ?? '今天先做一個小版本。',
  })
}

function levelRank(v: Verdict | null): number {
  if (!v) return 0
  return v.level === 'o' ? 2 : v.level === 'y' ? 1 : 0
}

function signal(label: string, value: string, verdict: Verdict | null, key: string): Signal {
  return { key, label, value, verdict }
}

function collectSignals(m: HealthMeasurement | null, sc: HealthSelfcheck | null): Signal[] {
  const out: Signal[] = []
  if (m?.height_cm && m.weight_kg) {
    const bmi = calcBmi(m.height_cm, m.weight_kg)
    out.push(signal(
      'BMI',
      bmi.toFixed(1),
      judgeBmi(bmi, bmiAge(STUDENT_GRADE, ROUND)),
      'bmi',
    ))
  }
  if (m?.sbp && m.dbp) {
    out.push(signal('血壓', `${m.sbp}/${m.dbp}`, judgeBp(m.sbp, m.dbp), 'bp'))
  }
  if (m?.waist_cm && m.hip_cm) {
    const whr = calcWhr(m.waist_cm, m.hip_cm)
    out.push(signal('腰臀比', whr.toFixed(2), judgeWhr(whr), 'whr'))
  }
  if (sc?.h85210) {
    const done = Object.values(sc.h85210).filter(Boolean).length
    out.push(signal('85210', `${done}/7 項`, {
      level: done >= 6 ? 'g' : done >= 4 ? 'y' : 'o',
      label: done >= 6 ? '完成度高' : done >= 4 ? '接近一半以上' : '可以先挑一項',
      msg: '這七項都是具體的日常習慣。',
    }, 'h85210'))
  }
  return out
}

function addMeasurementFocuses(out: FocusItem[], m: HealthMeasurement | null) {
  if (!m) return
  if (m.sbp && m.dbp && levelRank(judgeBp(m.sbp, m.dbp)) > 0) {
    addFocus(out, 'bp_amber', 1, judgeBp(m.sbp, m.dbp).level === 'o' ? 3 : 2, '血壓先確認一次')
  }
  if (m.height_cm && m.weight_kg) {
    const verdict = judgeBmi(calcBmi(m.height_cm, m.weight_kg), bmiAge(STUDENT_GRADE, ROUND))
    if (verdict?.level === 'y' && verdict.label.includes('偏低')) {
      addFocus(out, 'bmi_amber_low', 3, 2, 'BMI 可以留意')
    } else if (verdict && verdict.level !== 'g') {
      addFocus(out, 'bmi_amber_high', 1, verdict.level === 'o' ? 3 : 2, 'BMI 可以留意')
    }
  }
  if (m.waist_cm && m.hip_cm && levelRank(judgeWhr(calcWhr(m.waist_cm, m.hip_cm))) > 0) {
    addFocus(out, 'whr_amber', 3, 2, '腰臀比可以留意')
  }
}

const LIFESTYLE_TRIGGERS: Record<number, string> = {
  1: 'exercise_under_1h',
  2: 'sedentary',
  3: 'skip_breakfast',
  4: 'veg_under_3',
  5: 'water_under_target',
  6: 'sleep_6_7',
  7: 'sleep_onset',
  9: 'sugar_drink',
  10: 'fried_food',
}

function addSelfcheckFocuses(out: FocusItem[], sc: HealthSelfcheck | null) {
  if (!sc) return
  for (const n of sc.lifestyle?.red ?? []) {
    const trigger = n === 6 ? 'sleep_under_6' : LIFESTYLE_TRIGGERS[n]
    if (trigger) addFocus(out, trigger, trigger.startsWith('sleep') ? 2 : 3, 3)
  }
  for (const n of sc.lifestyle?.yellow ?? []) {
    const trigger = LIFESTYLE_TRIGGERS[n]
    if (trigger) addFocus(out, trigger, trigger.startsWith('sleep') ? 2 : 3, 1)
  }

  const h = sc.h85210 ?? {}
  if (h.sleep8 === false) addFocus(out, 'sleep_6_7', 2, 2)
  if (h.screen_under2 === false) addFocus(out, 'screen_over_2h', 3, 2)
  if (h.fruit5 === false) addFocus(out, 'veg_under_3', 3, 2)
  if (h.water1500 === false) addFocus(out, 'water_under_target', 3, 2)
  if (h.no_sugar_drink === false) addFocus(out, 'sugar_drink', 3, 2)
  if (h.breakfast === false) addFocus(out, 'skip_breakfast', 3, 2)
  if (h.exercise1h === false) addFocus(out, 'exercise_under_1h', 3, 2)

  if (sc.stress_level !== null && sc.stress_level >= 4 && sc.stress_level <= 5) {
    addFocus(out, 'stress_high', 2, 3)
  }
  if (sc.mood_scale !== null && sc.mood_scale >= 6 && sc.mood_scale <= 14) {
    addFocus(out, 'mood_low', 2, 2, '心情起伏可以留意')
  }
  if (sc.sleep_isi !== null && sc.sleep_isi >= 10) {
    addFocus(out, 'sleep_onset', 2, 2, '睡眠品質可以留意')
  }
  if (sc.diet_type && !['E', 'G'].includes(sc.diet_type)) {
    addFocus(out, 'diet_type_ABCDF', 3, 1, '飲食組成可以調整')
  }
}

function sortFocuses(items: FocusItem[]): FocusItem[] {
  return [...items].sort((a, b) =>
    a.priority - b.priority || b.weight - a.weight || a.trigger.localeCompare(b.trigger),
  )
}

function pickSuggestions(focuses: FocusItem[]): Suggestion[] {
  const seen = new Set<string>()
  const out: Suggestion[] = []
  for (const f of focuses) {
    for (const s of SUGGESTIONS.filter((item) => item.domain === f.domain)) {
      if (seen.has(s.id)) continue
      seen.add(s.id)
      out.push(s)
      break
    }
    if (out.length >= 3) break
  }
  for (const f of focuses) {
    for (const s of SUGGESTIONS.filter((item) => item.domain === f.domain)) {
      if (seen.has(s.id)) continue
      seen.add(s.id)
      out.push(s)
      if (out.length >= 3) return out
    }
  }
  return out
}

function pickExercises(focuses: FocusItem[]): Exercise[] {
  const hasActivity = focuses.some((f) => f.domain === 'activity')
  return (hasActivity ? EXERCISES : EXERCISES.filter((e) => ['ex-01', 'ex-02', 'ex-05'].includes(e.id))).slice(0, 3)
}

export function analyzeStudent(
  measurement: HealthMeasurement | null,
  selfcheck: HealthSelfcheck | null,
): StudentAnalysis {
  const hasSelfcheck = selfcheck !== null && (
    selfcheck.lifestyle !== null
    || Object.keys(selfcheck.h85210 ?? {}).length > 0
    || selfcheck.diet_type !== null
    || selfcheck.sleep_isi !== null
    || selfcheck.mood_scale !== null
    || selfcheck.stress_level !== null
    || selfcheck.depression !== null
  )
  const focuses: FocusItem[] = []
  addMeasurementFocuses(focuses, measurement)
  addSelfcheckFocuses(focuses, selfcheck)
  const sorted = sortFocuses(focuses)
  const primary = sorted.slice(0, 2)
  return {
    signals: collectSignals(measurement, selfcheck),
    focuses: primary,
    suggestions: pickSuggestions(primary.length ? primary : sorted).slice(0, 3),
    exercises: pickExercises(primary.length ? primary : sorted).slice(0, 3),
    ready: measurement !== null && hasSelfcheck,
    hasMeasurement: measurement !== null,
    hasSelfcheck,
  }
}
