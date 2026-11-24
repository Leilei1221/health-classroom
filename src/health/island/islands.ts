/**
 * 身體島的內容設定。
 *
 * 版面、文字、連線全在這一檔；畫面元件只負責畫。
 * 之後 ChatGPT 畫好島的圖，把 PNG 放進 src/assets/island/，
 * 在 ISLAND_ART（BodyIslands.tsx）對上 id 就會取代預設的向量圖。
 *
 * 正確性原則（蕾蕾老師要求以正確性為最優先）：
 * - 「能量代謝島」不是正式的器官系統，島名與說明都不寫成「○○系統」
 * - 心理健康不完全等於神經系統，所以叫「腦與心島」
 * - 連線只寫課本層級、確定的生理關係；只有「相關」的寫「有關」，不寫「會造成」
 * - 作業連結只連到真的存在的頁面；某些內容會依檢測結果才出現，要照實寫
 */

export type IslandId = 'brain' | 'cardio' | 'digest' | 'metab' | 'muscle' | 'harbor'

/** 島上的「建築」：一個作業或一組量測數值，點了會到對應的作業頁 */
export type Building = {
  name: string
  /** 一句話說明這是什麼 */
  note: string
  /** 作業頁路徑（不含 /preview）；沒有就只是說明 */
  to?: string
  /** 連結上的文字，例如「到身體數值登記」 */
  toLabel?: string
}

export type Island = {
  id: IslandId
  name: string
  /** 對應的身體系統；不是身體系統的要照實寫 */
  system: string
  intro: string
  /** 地圖上的中心點（viewBox 0 0 360 600） */
  x: number
  y: number
  r: number
  /** 預設向量圖的島頂顏色 */
  tint: string
  /** 24×24 的線條圖示 path */
  icon: string
  buildings: Building[]
}

const REGISTER = { to: '/health/register', toLabel: '到身體數值登記' }
const SELFCHECK = { to: '/health/selfcheck', toLabel: '到課本自我檢測' }
const ANALYSIS = { to: '/health/analysis', toLabel: '到健康分析' }

export const ISLANDS: Island[] = [
  {
    id: 'brain',
    name: '腦與心島',
    system: '神經系統・心理健康',
    intro: '大腦和神經系統指揮全身，睡眠、情緒和壓力也都和這裡有關。',
    x: 180, y: 80, r: 46,
    tint: '#CFC1EA',
    icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.5 14.5s1.2 1.5 3.5 1.5 3.5-1.5 3.5-1.5M9 9.5h.01M15 9.5h.01',
    buildings: [
      { name: '睡眠檢測', note: '課本自我檢測第 4 項', ...SELFCHECK },
      { name: '心情溫度計', note: '課本自我檢測第 5 項', ...SELFCHECK },
      { name: '壓力偵測站', note: '課本自我檢測第 6 項', ...SELFCHECK },
      { name: '情緒自我檢視表', note: '課本自我檢測第 7 項', ...SELFCHECK },
      { name: '身心調節策略', note: '在健康分析頁，依你的壓力、睡眠和情緒檢測結果才會出現', ...ANALYSIS },
      { name: '感恩日記', note: '在健康分析頁', ...ANALYSIS },
    ],
  },
  {
    id: 'cardio',
    name: '心肺島',
    system: '循環系統＋呼吸系統',
    intro: '肺把氧氣帶進血液，心臟再把血液送到全身。',
    x: 180, y: 200, r: 50,
    tint: '#F2B8B0',
    icon: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10zM7 12h3l1-2 2 4 1-2h3',
    buildings: [
      { name: '血壓', note: '收縮壓（上面那個數字）和舒張壓（下面那個數字）', ...REGISTER },
      { name: '脈搏', note: '每分鐘心跳幾下', ...REGISTER },
      { name: '血氧濃度', note: '血液裡帶了多少氧氣，和呼吸、循環都有關', ...REGISTER },
    ],
  },
  {
    id: 'digest',
    name: '消化島',
    system: '消化系統',
    intro: '吃進來的食物在這裡被分解、吸收，變成身體用得到的養分。',
    x: 180, y: 318, r: 48,
    tint: '#F9D27E',
    icon: 'M4 11h16a8 8 0 0 1-16 0zM9 7c0-1.5 1-2 1-3.5M14 7c0-1.5 1-2 1-3.5',
    buildings: [
      { name: '我的餐盤', note: '記錄六大類食物吃了幾份', to: '/health/plate', toLabel: '到我的餐盤' },
      { name: '飲食金字塔・你是哪一型', note: '課本自我檢測第 3 項', ...SELFCHECK },
    ],
  },
  {
    id: 'metab',
    name: '能量代謝島',
    system: '能量代謝與身體組成（不是一個器官系統）',
    intro: '身體把吃進來的能量用掉，用不完的會存成脂肪。',
    x: 292, y: 300, r: 42,
    tint: '#F9C79B',
    icon: 'M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 1 1 2 2 2 3 0-3 1-5 1-7z',
    buildings: [
      { name: '體脂率・內臟脂肪', note: '身體裡脂肪占多少', ...REGISTER },
      { name: '基礎代謝率', note: '維持呼吸、心跳等基本生命活動所需的熱量，整天躺著不動也要用掉', ...REGISTER },
      { name: '身體年齡', note: '體脂機依身體組成推算出來的參考年齡', ...REGISTER },
      { name: '腰圍・臀圍', note: '腹部有沒有堆積太多脂肪的參考', ...REGISTER },
    ],
  },
  {
    id: 'muscle',
    name: '肌肉骨骼島',
    system: '骨骼系統＋肌肉系統',
    intro: '骨骼撐起身體，肌肉拉動骨骼，身體才動得起來。',
    x: 112, y: 462, r: 46,
    tint: '#BFE3A8',
    icon: 'M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12',
    buildings: [
      { name: '骨骼肌率', note: '全身、軀幹、雙手、雙腳的骨骼肌各占多少', ...REGISTER },
    ],
  },
  {
    id: 'harbor',
    name: '出發港',
    system: '不是身體系統：整體的生活型態',
    intro: '這裡的作業跨好幾座島，從這裡出發，最後也回到這裡看成果。',
    x: 256, y: 520, r: 44,
    tint: '#A9D6EE',
    icon: 'M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 8v12M5 13a7 7 0 0 0 14 0M9 11h6',
    buildings: [
      { name: '身體數值登記', note: '一次填完所有量測數值，各島的數字都從這裡來', ...REGISTER },
      { name: '檢視我的生活型態', note: '課本自我檢測第 1 項', ...SELFCHECK },
      { name: '85210 健康守則', note: '課本自我檢測第 2 項', ...SELFCHECK },
      { name: '健康分析', note: '把你填的數值換成看得懂的話', ...ANALYSIS },
      { name: 'SMART 目標', note: '訂一個這學期做得到的目標', to: '/health/goal', toLabel: '到 SMART 目標' },
      { name: '第一週打卡', note: '目標訂好之後的七天紀錄', to: '/health/checkin', toLabel: '到第一週打卡' },
      { name: '期末成果', note: '期初和期末比一比', to: '/health/report', toLabel: '到期末成果' },
    ],
  },
]

/** 島和島之間的「協作線」：身體系統之間的關係 */
export type Link = { from: IslandId; to: IslandId; text: string }

export const LINKS: Link[] = [
  { from: 'digest', to: 'cardio', text: '小腸吸收的養分進入血液，由循環系統送到全身。' },
  { from: 'cardio', to: 'muscle', text: '運動時肌肉需要更多氧氣，心跳和呼吸都會加快。' },
  { from: 'brain', to: 'cardio', text: '自律神經會調節心跳和呼吸的快慢。' },
  { from: 'brain', to: 'digest', text: '自律神經也會調節腸胃的消化活動。' },
  { from: 'digest', to: 'metab', text: '食物提供能量；吃進來的比用掉的多，多出來的會存成脂肪。' },
  { from: 'muscle', to: 'metab', text: '肌肉是消耗能量的主要組織之一，肌肉量較多，基礎代謝率通常也較高。' },
  { from: 'brain', to: 'metab', text: '長期睡眠不足和壓力，和體重增加有關。' },
]

export const islandById = (id: IslandId) => ISLANDS.find((i) => i.id === id)!
