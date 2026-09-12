/**
 * 我的餐盤的判定邏輯。
 *
 * 整段照 docs/我的餐盤_原型.html 的 judge() 轉寫，門檻與文案未更動。
 * 這是課堂活動不是檢測：判定只回「裝滿了沒有」，不算分、不評價，
 * 也不會影響 hc_health_selfcheck.needs_followup。
 */
import { CAT, CAT_KEYS, GOALS, GROUPS, PER, WATER_GOAL, type CatKey, type Food } from './foods'

/** 依點擊順序記錄吃了什麼 */
export interface PickedItem {
  gi: number
  ii: number
  n: number
}

export type Totals = Record<CatKey, number> & {
  water: number
  sugar: number
  /** 官方公布熱量與代換表推算值的差額 */
  kcalAdj: number
}

export const foodAt = (gi: number, ii: number): Food => GROUPS[gi].items[ii]

export const foodKcal = (parts: Partial<Record<CatKey, number>>): number =>
  CAT_KEYS.reduce((s, k) => s + (parts[k] ?? 0) * PER[k].kcal, 0)

/** 整數不補小數點，其餘留一位 */
export const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1))

export function totals(log: PickedItem[]): Totals {
  const t = {
    grain: 0, prot: 0, milk: 0, veg: 0, fruit: 0, fat: 0,
    water: 0, sugar: 0, kcalAdj: 0,
  } as Totals
  for (const e of log) {
    const { parts, ex } = foodAt(e.gi, e.ii)
    for (const k of CAT_KEYS) t[k] += (parts[k] ?? 0) * e.n
    if (ex?.water) t.water += ex.water * e.n
    if (ex?.sugar) t.sugar += ex.sugar * e.n
    // 官方公布熱量優先：補上與代換表算出來的差額
    if (ex?.kc) t.kcalAdj += (ex.kc - foodKcal(parts)) * e.n
  }
  return t
}

export function macros(t: Totals) {
  const c = CAT_KEYS.reduce((s, k) => s + t[k] * PER[k].c, 0)
  const p = CAT_KEYS.reduce((s, k) => s + t[k] * PER[k].p, 0)
  const f = CAT_KEYS.reduce((s, k) => s + t[k] * PER[k].f, 0)
  const tot = c * 4 + p * 4 + f * 9
  return {
    c, p, f, tot,
    pc: tot ? (c * 4) / tot * 100 : 0,
    pp: tot ? (p * 4) / tot * 100 : 0,
    pf: tot ? (f * 9) / tot * 100 : 0,
  }
}

export const totalKcal = (t: Totals): number =>
  CAT_KEYS.reduce((s, k) => s + t[k] * PER[k].kcal, 0) + t.kcalAdj

export interface JudgeCard {
  ok: boolean
  t: string
  p: string
}

export interface JudgeResult {
  out: JudgeCard[]
  /** 超出建議份數的類別描述 */
  over: string[]
  notes: string[]
  /** 通過幾條判定 */
  matched: number
  /** 判定總條數，六大類＋喝水＋三大營養素比例 */
  total: number
}

/** 判定需要的全部輸入；從 log 現算或從存下來的結果還原都走這裡 */
export interface JudgeInput {
  t: Totals
  /** 實際總熱量，官方公布值優先 */
  kcal: number
  kcalTarget: number
  /** 有沒有吃到全穀（非精製） */
  whole: boolean
  /** 有沒有吃到深色蔬菜 */
  dark: boolean
  /** 有沒有吃到加工肉品 */
  proc: boolean
}

export function judgeInput({ t, kcal, kcalTarget, whole, dark, proc }: JudgeInput): JudgeResult {
  const goals = GOALS[kcalTarget]
  const out: JudgeCard[] = []
  const over: string[] = []

  for (const k of CAT_KEYS) {
    const cur = t[k]
    const goal = goals[k]
    const nm = CAT[k].nm
    const u = CAT[k].unit
    if (cur === 0) {
      out.push({ ok: false, t: nm, p: `今天完全沒吃到這一類，目標是 ${fmt(goal)} ${u}。六大類少掉一類，就有一組營養素補不回來。` })
    } else if (cur < goal * 0.6) {
      out.push({ ok: false, t: nm, p: `只吃到 ${fmt(cur)} ${u}，離 ${fmt(goal)} ${u} 還差不少。` })
    } else if (cur < goal) {
      out.push({ ok: false, t: nm, p: `${fmt(cur)} / ${fmt(goal)} ${u}，快到了，再補一點就滿了。` })
    } else if (cur <= goal * 1.2) {
      out.push({ ok: true, t: nm, p: `${fmt(cur)} / ${fmt(goal)} ${u}，裝得剛剛好。` })
    } else {
      const ex = cur - goal
      const tail =
        k === 'fat' ? '油脂是六類裡格子最小的一格，炸物和醬料很容易一口氣把它填爆。'
        : k === 'grain' ? '主食超量最常見的來源是含糖飲料和麵食的份量。'
        : ''
      out.push({ ok: false, t: nm, p: `裝到 ${fmt(cur)} ${u}，超出 ${fmt(ex)} ${u}。${tail}` })
      over.push(`${nm} 超出 ${fmt(ex)} ${u}`)
    }
  }

  /* 水 */
  if (t.water >= WATER_GOAL) {
    out.push({ ok: true, t: '喝水', p: `喝到 ${t.water} c.c.，達到一天 1,500 c.c. 的目標。` })
  } else {
    out.push({ ok: false, t: '喝水', p: `只喝到 ${t.water} c.c.，離 1,500 c.c. 還差 ${WATER_GOAL - t.water} c.c.。含糖飲料不能算在裡面。` })
  }

  /* 三大營養素比例 */
  const m = macros(t)
  if (m.tot) {
    const txt = `醣類 ${Math.round(m.pc)}%、蛋白質 ${Math.round(m.pp)}%、脂質 ${Math.round(m.pf)}%（建議 50–60 / 10–20 / 20–30）。`
    if (m.pf > 30) out.push({ ok: false, t: '三大營養素比例', p: `${txt} 脂質偏高，通常是炸物、醬料和加工肉造成的。` })
    else if (m.pf < 20) out.push({ ok: false, t: '三大營養素比例', p: `${txt} 脂質偏低，好的油脂（堅果、魚、植物油）也是身體需要的。` })
    else if (m.pc > 60) out.push({ ok: false, t: '三大營養素比例', p: `${txt} 醣類偏高，多半來自含糖飲料。` })
    else out.push({ ok: true, t: '三大營養素比例', p: `${txt} 在建議範圍內。` })
  }

  /* 附註 */
  const notes: string[] = []
  const diff = Math.round(kcal - kcalTarget)
  if (Math.abs(diff) > 250) {
    notes.push(`今天總熱量 ${Math.round(kcal)} 大卡，${diff > 0 ? `比目標多 ${diff}` : `比目標少 ${-diff}`} 大卡。`)
  }
  if (t.sugar > 0) {
    notes.push(`含糖飲料喝了 ${t.sugar} c.c.。課本 P.26 健康飲食習慣的其中一條就是「不喝含糖飲料」，它進不了餐盤的任何一格，但熱量照算。`)
  }
  if (t.grain > 0 && !whole) {
    notes.push('主食全部是精製的。換掉其中 1/3 成糙米、地瓜或玉米，份數一樣但纖維和維生素 B 群差很多。')
  }
  if (t.veg > 0 && !dark) {
    notes.push('蔬菜裡沒有深色的，課本建議至少 1/3 選深色。')
  }
  if (proc) {
    notes.push('加工肉品（香腸、培根）的鈉和亞硝酸鹽較高，不適合當每天的蛋白質來源。')
  }

  return { out, over, notes, matched: out.filter((r) => r.ok).length, total: out.length }
}

/** 作答當下的判定 */
export function judge(log: PickedItem[], kcalTarget: number): JudgeResult {
  const t = totals(log)
  return judgeInput({
    t,
    kcal: totalKcal(t),
    kcalTarget,
    whole: log.some((e) => !!foodAt(e.gi, e.ii).ex?.whole),
    dark: log.some((e) => !!foodAt(e.gi, e.ii).ex?.dark),
    proc: log.some((e) => !!foodAt(e.gi, e.ii).ex?.proc),
  })
}

/**
 * 總結的標題與第一句。
 *
 * 全對時的「八個格子」是原型的固定文案：判定條數只有在完全沒吃到含營養素的
 * 食物時才會少一條，那種情況六大類一定都是 0，不可能全對，所以講八不會出錯。
 */
export function summary(r: JudgeResult): { head: string; body: string } {
  if (r.matched === r.total) {
    return {
      head: '八個格子你都裝得剛剛好',
      body: '這在真實生活裡不容易。接下來可以往品質調整：主食換全穀、油脂來源從炸物換成堅果和魚。',
    }
  }
  if (r.matched >= r.total - 2) {
    return {
      head: `大部分都對了，剩下 ${r.total - r.matched} 項可以調`,
      body: '挑上面標「!」的其中一項，這禮拜先做到那一項就好。',
    }
  }
  return {
    head: `有 ${r.total - r.matched} 項可以調整`,
    body: '不用一次全改。先看哪一格「滿出來」——那通常是最容易處理的一項。',
  }
}
