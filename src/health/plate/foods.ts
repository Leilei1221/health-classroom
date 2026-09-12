/**
 * 我的餐盤：六大類每份營養、每日建議份數、食物庫。
 *
 * 內容整段取自 docs/我的餐盤_原型.html 的【CONFIG】區塊，
 * 數字與文字未經更動；只把原本的陣列改寫成具名欄位，方便型別檢查。
 *
 * TODO: 份數換算待老師逐項核對
 * 連鎖店與學校午餐的「熱量」是官方公布值，「份數」是依成分做的教學換算，
 * 不是官方數據。菜單會改版，建議每學期複查一次（查核日 2026-09-11）。
 */

/** 六大類的鍵，順序即畫面上份量尺的順序 */
export const CAT_KEYS = ['grain', 'prot', 'milk', 'veg', 'fruit', 'fat'] as const
export type CatKey = (typeof CAT_KEYS)[number]

/** 每份的營養：熱量 kcal／醣 c g／蛋白 p g／脂 f g */
export const PER: Record<CatKey, { kcal: number; c: number; p: number; f: number }> = {
  grain: { kcal: 70, c: 15, p: 2, f: 0 },   // 全穀雜糧 1 份
  prot: { kcal: 75, c: 0, p: 7, f: 5 },     // 豆魚蛋肉 1 份（中脂）
  milk: { kcal: 120, c: 12, p: 8, f: 4 },   // 乳品 1 杯（低脂）
  veg: { kcal: 25, c: 5, p: 1, f: 0 },      // 蔬菜 1 份
  fruit: { kcal: 60, c: 15, p: 0, f: 0 },   // 水果 1 份
  fat: { kcal: 45, c: 0, p: 0, f: 5 },      // 油脂與堅果種子 1 份
}

/** nm 完整名稱／sh 份量尺上的短名／col 色碼／unit 單位 */
export const CAT: Record<CatKey, { nm: string; sh: string; col: string; unit: string }> = {
  grain: { nm: '全穀雜糧', sh: '全穀', col: '#D9A441', unit: '份' },
  prot: { nm: '豆魚蛋肉', sh: '豆魚蛋肉', col: '#C56B78', unit: '份' },
  milk: { nm: '乳品', sh: '乳品', col: '#3E7AA6', unit: '杯' },
  veg: { nm: '蔬菜', sh: '蔬菜', col: '#3E8E5A', unit: '份' },
  fruit: { nm: '水果', sh: '水果', col: '#CF5F33', unit: '份' },
  fat: { nm: '油脂與堅果種子', sh: '油脂', col: '#8A6FA8', unit: '份' },
}

/** 每日建議份數，依熱量分檔（全穀以「份」計，1 碗飯＝4 份） */
export const GOALS: Record<number, Record<CatKey, number>> = {
  1800: { grain: 12, prot: 5, milk: 1.5, veg: 3, fruit: 2, fat: 6 },
  2000: { grain: 12, prot: 6, milk: 1.5, veg: 4, fruit: 3, fat: 7 },
  2200: { grain: 14, prot: 6, milk: 1.5, veg: 4, fruit: 3.5, fat: 7 },
  2500: { grain: 16, prot: 7, milk: 1.5, veg: 5, fruit: 4, fat: 8 },
  2700: { grain: 16, prot: 8, milk: 2, veg: 5, fruit: 4, fat: 9 },
}

export const KCAL_CHOICES = [1800, 2000, 2200, 2500, 2700]
export const DEFAULT_KCAL = 2500

/** 課本 85210：每日喝足 1,500 c.c. 白開水 */
export const WATER_GOAL = 1500
/** 份量尺全長代表 18 份（六類共用同一把尺） */
export const SCALE = 18

export interface FoodExtra {
  /** 計入喝水量的水分 c.c. */
  water?: number
  /** 含糖飲料 c.c.，不計入喝水量 */
  sugar?: number
  /** 官方公布熱量，優先於代換表推算值 */
  kc?: number
  /** 全穀（非精製） */
  whole?: number
  /** 深色蔬菜 */
  dark?: number
  /** 加工肉品 */
  proc?: number
}

export interface Food {
  /** emoji */
  e: string
  /** 名稱 */
  n: string
  /** 份量說明 */
  p: string
  parts: Partial<Record<CatKey, number>>
  ex?: FoodExtra
}

export interface FoodGroup {
  nm: string
  note: string
  /** 預設展開 */
  open?: boolean
  /** 含糖飲料區，樣式另外標示 */
  warn?: boolean
  /** 出處與查核日，畫面上要一起顯示 */
  src?: string
  items: Food[]
}

/**
 * 食物庫：每樣食物換算成六大類各幾份。
 *
 * 換算原則：以該品項「已查證的熱量」為錨點，依成分拆成六大類，
 * 使拆出來的份數 × 每份熱量 ≈ 官方熱量。份數本身屬教學用代換，非官方數據。
 */
export const GROUPS: FoodGroup[] = [
  {
    nm: "主食", note: "1 碗飯＝全穀 4 份",
    items: [
      { e: "🍚", n: "白飯", p: "半碗", parts: {grain: 2} },
      { e: "🍙", n: "糙米飯", p: "半碗", parts: {grain: 2}, ex: {whole: 1} },
      { e: "🍠", n: "地瓜", p: "1 條（中）", parts: {grain: 2}, ex: {whole: 1} },
      { e: "🌽", n: "玉米", p: "1 根", parts: {grain: 2}, ex: {whole: 1} },
      { e: "🍞", n: "吐司", p: "1 片", parts: {grain: 1} },
      { e: "🍜", n: "陽春麵", p: "1 碗", parts: {grain: 4, fat: 1} },
    ],
  },
  {
    nm: "豆魚蛋肉", note: "一掌心約 3 份",
    items: [
      { e: "🍢", n: "傳統豆腐", p: "1 塊 80g", parts: {prot: 1} },
      { e: "🥛", n: "無糖豆漿", p: "260 c.c.", parts: {prot: 1}, ex: {water: 260} },
      { e: "🐟", n: "魚", p: "半個掌心", parts: {prot: 2, fat: 1} },
      { e: "🥚", n: "蛋", p: "1 顆", parts: {prot: 1, fat: 1} },
      { e: "🍗", n: "雞腿（去皮）", p: "1 隻", parts: {prot: 3, fat: 1} },
      { e: "🥓", n: "培根／香腸", p: "2 片", parts: {prot: 1, fat: 2}, ex: {proc: 1} },
    ],
  },
  {
    nm: "蔬菜・水果", note: "蔬菜 1 份＝煮熟半碗",
    items: [
      { e: "🥬", n: "炒青菜", p: "半碗", parts: {veg: 1, fat: 1}, ex: {dark: 1} },
      { e: "🥦", n: "燙青花菜", p: "半碗", parts: {veg: 1}, ex: {dark: 1} },
      { e: "🍄", n: "菇類", p: "半碗", parts: {veg: 1} },
      { e: "🍎", n: "蘋果", p: "1 顆", parts: {fruit: 1} },
      { e: "🍌", n: "香蕉", p: "半根", parts: {fruit: 1} },
      { e: "🍊", n: "橘子", p: "1 顆", parts: {fruit: 1} },
    ],
  },
  {
    nm: "乳品・堅果・油", note: "乳品與堅果每天都要有",
    items: [
      { e: "🥛", n: "鮮奶", p: "1 杯 240c.c.", parts: {milk: 1}, ex: {water: 240} },
      { e: "🧀", n: "起司", p: "2 片", parts: {milk: 1} },
      { e: "🍶", n: "無糖優酪乳", p: "1 杯", parts: {milk: 1}, ex: {water: 240} },
      { e: "🌰", n: "杏仁果", p: "5 粒", parts: {fat: 1} },
      { e: "🥜", n: "花生", p: "10 粒", parts: {fat: 1} },
      { e: "🫒", n: "炒菜油", p: "1 茶匙", parts: {fat: 1} },
    ],
  },
  {
    nm: "夜市・小吃", note: "點下去看它拆成幾份",
    src: "份數為依成分的教學換算，非官方數據。",
    items: [
      { e: "🍱", n: "排骨便當", p: "1 個", parts: {grain: 5, prot: 3, veg: 1, fat: 5} },
      { e: "🍖", n: "滷肉飯", p: "1 碗", parts: {grain: 4, prot: 2, fat: 5} },
      { e: "🍗", n: "大雞排", p: "1 片 250g", parts: {grain: 1, prot: 5, fat: 4} },
      { e: "🍤", n: "鹹酥雞", p: "1 份 150g", parts: {grain: 1, prot: 3, fat: 5} },
      { e: "🫓", n: "蔥油餅", p: "1 片", parts: {grain: 3, fat: 7} },
      { e: "🌭", n: "大腸包小腸", p: "1 份", parts: {grain: 2, prot: 1, fat: 8}, ex: {proc: 1} },
      { e: "🥟", n: "水煎包", p: "1 顆", parts: {grain: 1.5, prot: 0.5, fat: 2} },
      { e: "🍡", n: "甜不辣", p: "1 份", parts: {grain: 2, prot: 1, fat: 5} },
      { e: "🍘", n: "地瓜球", p: "1 份", parts: {grain: 2, fat: 6} },
      { e: "🍲", n: "大腸麵線", p: "1 碗", parts: {grain: 3, prot: 1, fat: 3} },
      { e: "🍜", n: "泡麵", p: "1 碗", parts: {grain: 4, fat: 5} },
      { e: "🍙", n: "御飯糰", p: "1 個", parts: {grain: 2.5, prot: 0.5, fat: 1} },
    ],
  },
  {
    nm: "速食店", note: "熱量對得上官方公布值",
    src: "麥當勞熱量：台灣官方營養計算機（第三方營養師整理引用）；肯德基：官方 2026/5/18 營養標示。份數為教學換算，非官方數據。",
    items: [
      { e: "🍔", n: "大麥克", p: "1 個・約 503 大卡", parts: {grain: 3, prot: 2, fat: 3} },
      { e: "🐔", n: "麥香雞", p: "1 個・約 393 大卡", parts: {grain: 2.5, prot: 2, fat: 1.5} },
      { e: "🐟", n: "麥香魚", p: "1 個・約 343 大卡", parts: {grain: 2.5, prot: 1.5, fat: 1.5} },
      { e: "🌶️", n: "勁辣雞腿堡", p: "1 個・約 537 大卡", parts: {grain: 3, prot: 3, fat: 2} },
      { e: "🍟", n: "薯條（中）", p: "約 346 大卡", parts: {grain: 3, fat: 3} },
      { e: "🍟", n: "薯條（大）", p: "約 473 大卡", parts: {grain: 4, fat: 4} },
      { e: "🥧", n: "蘋果派", p: "1 個・約 217 大卡", parts: {grain: 1.5, fat: 2.5} },
      { e: "🥤", n: "可樂（中）", p: "約 210 大卡", parts: {grain: 3}, ex: {sugar: 350} },
      { e: "🍗", n: "咔啦雞腿堡", p: "1 個・445 大卡", parts: {grain: 3.5, prot: 2.5, fat: 0.5} },
      { e: "🍖", n: "義式香草紙包雞", p: "1 份・386 大卡", parts: {prot: 5} },
      { e: "🍤", n: "上校雞塊（4 塊）", p: "165 大卡", parts: {grain: 1, prot: 1, fat: 0.5} },
      { e: "🥔", n: "香酥脆薯（大）", p: "393 大卡", parts: {grain: 3.5, fat: 3} },
      { e: "🥧", n: "原味蛋撻", p: "1 個・182 大卡", parts: {grain: 1, fat: 2.5} },
    ],
  },
  {
    nm: "花中午餐", note: "學校午餐・官方登錄資料", open: true,
    src: "資料來源：教育部校園食材登錄平臺 2.0（學校代碼 64741591），六大類份數與熱量為平臺公告值。查核日 2026-09-11。※ 已排除兩天：9/3（張氏）全份餐只登錄 0.28 份全穀、41 大卡，不像一份完整午餐；9/4（維爾康）份數加總算不出公告的 829 大卡。兩者疑為廠商登錄不完整或有誤。",
    items: [
      { e: "🍱", n: "9/2 可口味", p: "香烤腿排・香酥蝦捲", parts: {grain: 5.13, prot: 4.59, veg: 1, fat: 0.06}, ex: {kc: 689} },
      { e: "🍱", n: "9/8 讚美食", p: "便當", parts: {grain: 6.68, prot: 1.56, veg: 0.58, fat: 4}, ex: {kc: 792} },
      { e: "🍱", n: "9/9 讚美食", p: "糖醋豬排骨・酸菜麵腸", parts: {grain: 5.66, prot: 3.6, veg: 1.07, fat: 2}, ex: {kc: 734} },
      { e: "🍱", n: "9/10 讚美食", p: "日京醬肉絲・炒冬粉", parts: {grain: 6.51, prot: 2.95, veg: 0.4, fat: 1}, ex: {kc: 866} },
    ],
  },
  {
    nm: "全家便利商店", note: "熱量取自全家官方平台",
    src: "熱量為全家「食在購安心」官方營養標示（foodsafety.family.com.tw，查核日 2026-09-11）。標★者官方另有完整三大營養素，份數換算較可靠；其餘只有熱量，份數為依成分推估，非官方數據。",
    items: [
      { e: "🍱", n: "香腸腿排雙拼便當★", p: "652 大卡", parts: {grain: 5.5, prot: 2, veg: 0.5, fat: 2}, ex: {proc: 1} },
      { e: "🍱", n: "鐵道滷排便當", p: "752 大卡", parts: {grain: 6, prot: 2.5, veg: 0.5, fat: 3} },
      { e: "🍱", n: "懷舊滷雙拼便當", p: "676 大卡", parts: {grain: 5.5, prot: 2, veg: 0.5, fat: 2.5} },
      { e: "🍙", n: "鮪魚飯糰★", p: "193 大卡", parts: {grain: 2, prot: 0.5, fat: 0.5} },
      { e: "🍙", n: "經典肉鬆飯糰", p: "223 大卡", parts: {grain: 2.5, fat: 1} },
      { e: "🍙", n: "麻油雞飯糰", p: "319 大卡", parts: {grain: 3, prot: 1, fat: 0.5} },
      { e: "🥪", n: "火腿起司蛋三明治★", p: "202 大卡", parts: {grain: 1.5, prot: 0.5, fat: 1.5}, ex: {proc: 1} },
      { e: "🥪", n: "好多蛋三明治", p: "294 大卡", parts: {grain: 1.5, prot: 1.5, fat: 1.5} },
      { e: "🥗", n: "好多菜三明治", p: "154 大卡", parts: {grain: 1.5, veg: 0.5, fat: 1} },
      { e: "🥪", n: "經典總匯三明治", p: "209 大卡", parts: {grain: 1.5, prot: 0.5, fat: 1.5} },
    ],
  },
  {
    nm: "7-11・咖啡店", note: "早餐和消夜最常出現的一區",
    src: "7-11 三項為實際包裝營養標示（營養師抽查公布）；路易莎為官方菜單熱量的第三方整理；便當類無公開標示，為估算值。",
    items: [
      { e: "🥪", n: "焗烤起司鮪魚三明治", p: "304 大卡", parts: {grain: 2, prot: 1, fat: 2} },
      { e: "🍜", n: "豆皮蕎麥冷麵", p: "398 大卡", parts: {grain: 3.5, prot: 1, fat: 1.5} },
      { e: "🍲", n: "麻油雞麵線", p: "463 大卡", parts: {grain: 3.5, prot: 2.5, fat: 1} },
      { e: "🍱", n: "超商排骨便當", p: "估算值", parts: {grain: 5, prot: 3, veg: 1, fat: 4} },
      { e: "🍱", n: "超商雞腿便當", p: "估算值", parts: {grain: 5, prot: 3, veg: 1, fat: 3} },
      { e: "🌭", n: "大亨堡", p: "估算值", parts: {grain: 2, prot: 1, fat: 3}, ex: {proc: 1} },
      { e: "☕", n: "美式黑咖啡", p: "約 16 大卡", parts: {}, ex: {water: 360} },
      { e: "🥛", n: "拿鐵（中・無糖）", p: "約 200 大卡", parts: {milk: 1.5}, ex: {water: 240} },
      { e: "🧋", n: "咖啡拿鐵（中・全糖）", p: "約 241 大卡", parts: {milk: 1.5, grain: 1}, ex: {sugar: 360} },
      { e: "🥯", n: "貝果・火腿", p: "366 大卡", parts: {grain: 4.5, prot: 0.5} },
      { e: "🥪", n: "麥香三明治・燻雞", p: "322 大卡", parts: {grain: 3, prot: 1, fat: 1} },
      { e: "🍵", n: "無糖茶", p: "1 瓶 600c.c.", parts: {}, ex: {water: 600} },
    ],
  },
  {
    nm: "吃到飽・自助餐", note: "用「拿了幾盤」來估",
    src: "以一般店家的盤量估算（蔬菜盤約 400g 生重、肉盤約 120g），只求抓個大概，不求精準【估算值】",
    items: [
      { e: "🥬", n: "蔬菜盤", p: "1 盤", parts: {veg: 4}, ex: {dark: 1} },
      { e: "🥩", n: "火鍋肉片", p: "1 盤約 120g", parts: {prot: 4, fat: 2} },
      { e: "🍖", n: "燒烤肉盤", p: "1 盤", parts: {prot: 4, fat: 2} },
      { e: "🦐", n: "海鮮盤", p: "1 盤", parts: {prot: 3} },
      { e: "🍢", n: "火鍋料盤", p: "1 盤（貢丸魚餃等）", parts: {grain: 1, prot: 2, fat: 2}, ex: {proc: 1} },
      { e: "🍚", n: "白飯", p: "1 碗", parts: {grain: 4} },
      { e: "🍜", n: "冬粉／王子麵", p: "1 份", parts: {grain: 2, fat: 1} },
      { e: "🥣", n: "沙茶醬", p: "1 大匙", parts: {fat: 3} },
      { e: "🍤", n: "炸物盤", p: "1 盤", parts: {grain: 2, prot: 1, fat: 4} },
      { e: "🍦", n: "霜淇淋", p: "1 支", parts: {grain: 2, milk: 0.5, fat: 2} },
      { e: "🥤", n: "飲料吧含糖飲", p: "1 杯", parts: {grain: 3}, ex: {sugar: 500} },
      { e: "🍮", n: "甜點一小塊", p: "1 份", parts: {grain: 2, fat: 2} },
    ],
  },
  {
    nm: "飲料", note: "只有白開水和無糖飲料算進喝水量", warn: true,
    items: [
      { e: "💧", n: "白開水", p: "1 杯 250c.c.", parts: {}, ex: {water: 250} },
      { e: "🍵", n: "無糖茶", p: "1 杯 500c.c.", parts: {}, ex: {water: 500} },
      { e: "🧋", n: "珍珠鮮奶茶", p: "700 c.c. 全糖", parts: {grain: 4, milk: 0.5}, ex: {sugar: 700} },
      { e: "🥤", n: "可樂", p: "600 c.c.", parts: {grain: 4}, ex: {sugar: 600} },
      { e: "⚡", n: "運動飲料", p: "600 c.c.", parts: {grain: 2.5}, ex: {sugar: 600} },
      { e: "🧃", n: "包裝果汁", p: "300 c.c.", parts: {fruit: 1, grain: 1}, ex: {sugar: 300} },
    ],
  },
]
