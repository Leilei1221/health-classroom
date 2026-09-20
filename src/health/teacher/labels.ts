/**
 * 教師端要用的短標籤。
 *
 * 85210 七題在課本裡是完整句子（「每天四電……的時間總計少於 2 小時」），
 * 直接當表格欄位名或標籤會擠爆版面，這裡另給一組短名。
 * 故意放在教師資料夾而不是 scales.ts：學生看到的題目文字一個字都不改。
 */
import { SCALES } from '../selfcheck/scales'

export const H85210_KEYS = SCALES.h85210.keys ?? []

export const H85210_SHORT: Record<string, string> = {
  sleep8: '睡足 8 小時',
  screen_under2: '四電少於 2 小時',
  fruit5: '五蔬果',
  water1500: '喝水 1500 c.c.',
  no_sugar_drink: '不喝含糖飲料',
  breakfast: '吃早餐',
  exercise1h: '運動 1 小時',
}

/** 七份量表在教師端的名稱，與進度表的 label 同一組字 */
export const SCALE_LABEL = {
  lifestyle: '生活型態',
  h85210: '85210',
  pyramid: '飲食金字塔',
  sleep: '睡眠檢測',
  mood: '心情溫度計',
  stress: '壓力偵測站',
  depression: '情緒自我檢視表',
} as const
