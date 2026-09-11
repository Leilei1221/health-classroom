/**
 * 七份課本自我檢測的題目、選項與分級文案。
 *
 * 內容整段取自 docs/自我檢測頁_原型.html 的【CONFIG】區塊，
 * 題目文字與門檻數字一字未改；只把原本用 <br>／<small> 標出來的補充說明
 * 拆成 sub 欄位，顯示出來的字完全相同。
 *
 * ── 已定案的四項設計決定（原型註解，原樣保留）──────────────
 * 1. P.224 ★「有自殺的想法」不放線上，改由紙本課堂施測（見 note224）
 * 2. P.232 的分級建議改寫為校內輔導資源，不照抄課本的醫療化文字
 * 3. 生活型態存三燈區題號分布（jsonb），不存單一等第
 * 4. 心情溫度計／憂鬱情緒檢核存「分數」，等第由前端現算
 *
 * 來源：育達乙版全一冊Ⅰ／Ⅱ 第一章、第五章；均悅 U2 Ch1。
 */

/** 綠／黃／橘燈 */
export type Level = 'g' | 'y' | 'o'

/** 飲食金字塔的結果代碼，對應 hc_health_selfcheck.diet_type */
export type DietType = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

export const SCALE_KEYS = [
  'lifestyle', 'h85210', 'pyramid', 'sleep', 'mood', 'stress', 'depression',
] as const
export type ScaleKey = (typeof SCALE_KEYS)[number]

/** 選項或題目：需要小字補充時用物件，否則直接是字串 */
export type Choice = string | { label: string; sub: string }
export type Question = string | { t: string; sub: string }

export const choiceLabel = (c: Choice) => (typeof c === 'string' ? c : c.label)
export const choiceSub = (c: Choice) => (typeof c === 'string' ? undefined : c.sub)
export const questionText = (q: Question) => (typeof q === 'string' ? q : q.t)
export const questionSub = (q: Question) => (typeof q === 'string' ? undefined : q.sub)

export interface Band {
  /** 分數上限（含） */
  max: number
  level: Level
  label: string
  /** 紅旗分級刻意沒有 msg：結果頁只給分數與分級，建議由關懷文案取代 */
  msg?: string
  flag?: boolean
}

export interface Scale {
  no: number
  nm: string
  short: string
  src: string
  kind: 'light' | 'check' | 'tree' | 'likert' | 'yn'
  mins: string
  /** 決策樹沒有固定題數，改用這行說明 */
  qcount?: string
  flag?: boolean
  ask?: string
  lead?: string
  note224?: string
  opts?: Choice[]
  qs?: Question[]
  /** check 型每一題對應的 jsonb key */
  keys?: string[]
  groups?: { opts: Choice[]; qs: Question[] }[]
  /** 三燈區，k 是綠／黃／紅（與 bands 的 level 不同一組）*/
  zones?: { k: 'g' | 'y' | 'r'; nm: string; sub: string; msg: string }[]
  tree?: Record<number, { t: string; o: [string, number | DietType][] }>
  results?: Record<DietType, { level: Level; nm: string; msg: string; tip: string }>
  bands?: Band[]
  /** 需要單獨標記的題號（0 起算） */
  critical?: number
  tail?: string
}

export const SCALES: Record<ScaleKey, Scale> = {
  lifestyle: {
    no: 1, nm: "檢視我的生活型態", short: "生活型態",
    src: "課本 P.14・改編自青少年健康促進量表 APHS",
    kind: "light", mins: "約 3 分鐘",
    opts: [
      { label: "經常做到", sub: "一週 3 次以上" },
      { label: "偶爾做到", sub: "一週 1～2 次" },
      "從未做到",
    ],
    qs: [
      "除體育課外，我每週至少運動 3 次，每次至少 30 分鐘為基準。",
      "我盡量找機會運動（例如：用走樓梯代替電梯或多走路）。",
      "我有每天吃早餐的習慣。",
      "我每天都吃五蔬果。",
      "我每天喝 1,500 c.c. 以上的開水。",
      "我每天睡 7 小時以上。",
      "我可以在躺床 20 分鐘以內入睡。",
      "當身體不適時，我會盡快去看醫生。",
      "我會限制糖分與甜食的攝取。",
      "我很少吃油炸與高熱量食物。",
    ],
    zones: [
      { k: "g", nm: "綠燈區", sub: "健康 ALL PASS 區", msg: "好好持續執行這些良好的生活型態，健康青年就是你！" },
      { k: "y", nm: "黃燈區", sub: "健康警示區", msg: "隨時注意這些亮警戒的生活型態，讓健康加分！" },
      { k: "r", nm: "紅燈區", sub: "健康加強區", msg: "建議趕快改善不良的生活型態，不讓健康遠離你！" },
    ],
  },

  h85210: {
    no: 2, nm: "85210 健康守則", short: "85210",
    src: "課本 P.30・健康體位 85210 評量問卷",
    kind: "check", mins: "約 1 分鐘",
    ask: "有做到的請打勾",
    qs: [
      "每天睡足 8 小時",
      "每天四電（看電視、玩電動、打電腦、使用智慧型電子產品〔含手機〕）的時間總計少於 2 小時",
      "天天吃 5 個拳頭大小的蔬果（3 蔬 2 果）",
      "每日有喝足 1,500 c.c. 白開水",
      "不喝含糖飲料",
      "每天吃早餐",
      "每天運動 1 小時",
    ],
    keys: [
      "sleep8",
      "screen_under2",
      "fruit5",
      "water1500",
      "no_sugar_drink",
      "breakfast",
      "exercise1h",
    ],
    bands: [
      { max: 3, level: "o", label: "做到 0～3 項",
        msg: "這七項都是很具體的日常目標，不是抽象的「要健康一點」。先挑一項最容易的開始，例如「每天吃早餐」。" },
      { max: 5, level: "y", label: "做到 4～5 項",
        msg: "已經做到一半以上了。看看沒打勾的那幾項，哪一項調整起來最不痛苦。" },
      { max: 7, level: "g", label: "做到 6～7 項",
        msg: "這幾項你都顧到了，這是很難維持的狀態，繼續保持。" },
    ],
  },

  pyramid: {
    no: 3, nm: "飲食金字塔・你是哪一型", short: "飲食金字塔",
    src: "課本飲食單元・決策樹測驗",
    kind: "tree", mins: "約 3 分鐘", qcount: "最多 8 題，依你的答案分支",
    tree: {
      1: { t: "喜歡吃正餐超過點心嗎？", o: [["是", 2], ["不是", 3]] },
      2: { t: "常常為了功課、社團、打工或其他事情而耽誤正餐嗎？", o: [["是", 3], ["不是", 6]] },
      3: { t: "想喝東西的時候，你通常會選：", o: [["白開水、熱茶", 4], ["含糖紅茶、綠茶、奶茶、稀釋果汁、乳酸飲料、運動飲料等", 5]] },
      4: { t: "吃飯的時候，你比較像哪一種？", o: [["吃菜配飯", 7], ["吃飯配菜", 8]] },
      5: { t: "喜歡洋芋片、可樂果、薯條這類零食嗎？", o: [["喜歡", "A"], ["還好", 7]] },
      6: { t: "你是那種要吃到飯才會覺得飽的人嗎？", o: [["是", 8], ["不是", 4]] },
      7: { t: "喜歡牛排、香雞排、排骨這類大塊肉骨嗎？", o: [["喜歡", 9], ["還好", 11]] },
      8: { t: "正餐沒吃到大塊的肉（爌肉、排骨、雞腿等），會覺得怪怪的嗎？", o: [["會", 10], ["不會", 11]] },
      9: { t: "喜歡吃青菜水果嗎？", o: [["喜歡", "C"], ["還好", "B"]] },
      10: { t: "每天都有吃到大約一滿碗量的青菜嗎？", o: [["有", 13], ["沒有", 14]] },
      11: { t: "幾乎每天都有喝到牛奶或羊奶嗎？", o: [["有", 10], ["沒有", 12]] },
      12: { t: "常吃到蛋和豆製品嗎？（豆腐、豆乾、豆包、素雞等）", o: [["常吃", 14], ["很少", "D"]] },
      13: { t: "吃正餐時，你常常會再添飯或加點，吃到很飽嗎？", o: [["常常", "E"], ["不會", 14]] },
      14: { t: "每天都會吃到至少一顆水果嗎？", o: [["會", "G"], ["不一定", "F"]] },
    },
    results: {
      A: {
        level: "o", nm: "食物種類偏少型",
        msg: "你吃的食物種類比較集中，零食佔的比例偏高。長期下來，六大類食物容易有幾類補不太到，身體要用的原料就會不夠齊全。",
        tip: "從正餐開始補：一餐裡至少出現三種顏色的食物，零食改成水果或無糖乳品。",
      },
      B: {
        level: "y", nm: "蛋白質偏多型",
        msg: "你的肉類吃得比較多，蔬果相對少。蛋白質吃太多時，心血管和腎臟的工作量會比較大。",
        tip: "一餐的肉大約一個掌心大小就夠了，空出來的位置給蔬菜。",
      },
      C: {
        level: "y", nm: "主食偏少型",
        msg: "你的蔬果吃得不錯，但主食類偏少。全穀雜糧（飯、麵、饅頭、地瓜、芋頭）是身體最主要的能量來源，少了會容易累、注意力不集中。",
        tip: "每餐至少吃到一碗左右的主食，全穀類（糙米、地瓜）比精緻澱粉更耐撐。",
      },
      D: {
        level: "y", nm: "蛋白質偏少型",
        msg: "你的乳品、蛋、豆製品吃得比較少。這幾類是蛋白質的主要來源，對成長期的肌肉、免疫力和頭髮皮膚都有直接影響。",
        tip: "早餐加一顆蛋或一杯無糖豆漿，是最容易補起來的一餐。",
      },
      E: {
        level: "y", nm: "種類均衡・份量偏多型",
        msg: "六大類食物你都有吃到，比較不容易營養素缺乏，這點很好。要留意的是份量——吃到很飽和吃夠是兩件事。",
        tip: "試試看「先菜、再肉、後飯」的順序，吃到七、八分飽就停，過十分鐘再判斷還餓不餓。",
      },
      F: {
        level: "y", nm: "蔬果偏少型",
        msg: "其他類別都有顧到，蔬菜水果是目前最明顯的缺口。蔬果提供的維生素、礦物質和纖維，是其他類食物補不太回來的。",
        tip: "先設一個小目標：午餐便當的菜全部吃完，或每天多一顆水果。",
      },
      G: {
        level: "g", nm: "均衡一族",
        msg: "六大類食物你都有顧到，份量也拿捏得不錯。這是很難維持的狀態，你已經做到了。",
        tip: "接下來可以往品質調整：白飯換成糙米、含糖飲料再減少一些。",
      },
    },
  },

  sleep: {
    no: 4, nm: "睡眠檢測", short: "睡眠",
    src: "均悅版 U2 Ch1 P.73・衛福部心理及口腔健康司《失眠手冊》",
    kind: "likert", mins: "約 2 分鐘",
    lead: "評估最近 2 週內失眠問題的嚴重程度",
    groups: [
      {
        opts: [
          "無",
          "輕度",
          "中度",
          "重度",
          "非常嚴重",
        ],
        qs: [
          "入睡困難",
          "無法維持較長的睡眠",
          "太早醒",
        ],
      },
      {
        opts: [
          "非常滿意",
          "滿意",
          "中等",
          "不滿意",
          "非常不滿意",
        ],
        qs: [
          "你滿意自己最近的睡眠狀態嗎？",
        ],
      },
      {
        opts: [
          "完全無干擾",
          "一點",
          "稍微",
          "很多",
          "非常多",
        ],
        qs: [
          { t: "睡眠問題是否有干擾到你的日常生活功能？", sub: "（如：學習表現／日常瑣事、專注力、記憶力、情緒等）" },
        ],
      },
    ],
    bands: [
      { max: 9, level: "g", label: "9 分以下",
        msg: "無明顯失眠困擾，建議維持良好的睡眠習慣，減少失眠發生的機會！" },
      { max: 20, level: "y", label: "10 分以上",
        msg: "有明顯失眠困擾。睡不好通常有三個原因疊在一起：個性與習慣（前置）、最近發生的事（觸發）、以及擔心睡不好本身（持續）。下一節課我們會一起拆這三個。" },
    ],
    tail: "本測驗僅為簡易失眠自我篩檢，若需進一步了解自身睡眠問題，請諮詢專業醫護人員。",
  },

  mood: {
    no: 5, nm: "心情溫度計", short: "心情溫度計",
    src: "課本 P.224・簡式健康量表 BSRS-5（李明濱醫師）",
    kind: "likert", mins: "約 2 分鐘", flag: true,
    lead: "請回想最近一週內（包括今天），下列各問題使你感到困擾或苦惱的程度",
    note224: "這份量表原本還有第 6 題（★），那一題我們會在課堂上用紙本一起做。",
    groups: [
      {
        opts: [
          "完全沒有",
          "輕微",
          "中等程度",
          "嚴重",
          "非常嚴重",
        ],
        qs: [
          "睡眠困難，譬如難以入睡、易醒或早醒。",
          "感覺緊張不安。",
          "覺得容易動怒。",
          "感覺憂鬱、心情低落。",
          "覺得比不上別人。",
        ],
      },
    ],
    bands: [
      { max: 5, level: "g", label: "一般範圍",
        msg: "最近的情緒狀態大致穩定。" },
      { max: 9, level: "y", label: "輕度情緒困擾",
        msg: "有些事情正在困擾你。找親友談談、把它說出來，通常就會鬆一點。" },
      { max: 14, level: "o", label: "中度情緒困擾", flag: true },
      { max: 20, level: "o", label: "重度情緒困擾", flag: true },
    ],
  },

  stress: {
    no: 6, nm: "壓力偵測站", short: "壓力偵測站",
    src: "課本 P.232・衛生福利部國民健康署 健康九九+",
    kind: "check", mins: "約 2 分鐘", flag: true,
    ask: "最近有這些情況的請打勾",
    qs: [
      "你最近是否經常感到緊張，覺得課業或工作總是做不完？",
      "你最近是否老是睡不好，常常失眠或睡眠品質不佳？",
      "你最近是否經常有情緒低落、焦慮、煩躁的情況？",
      "你最近是否經常忘東忘西、變得很健忘？",
      "你最近是否經常覺得胃口不好？或胃口特別好？",
      "你最近六個月內是否生病不只一次了？",
      "你最近是否經常覺得很累，假日都在睡覺？",
      "你最近是否經常覺得頭痛、腰痠背痛？",
      "你最近是否經常意見和別人不同？",
      "你最近是否注意力經常難以集中？",
      "你最近是否經常覺得未來充滿不確定感？恐懼感？",
      "有人說你最近氣色不太好嗎？",
    ],
    bands: [
      { max: 3, level: "g", label: "3 項以下",
        msg: "你的壓力指數還在能負荷的範圍。" },
      { max: 5, level: "y", label: "4～5 項",
        msg: "壓力已經在困擾你了，雖然還應付得來，但值得認真學習壓力管理，也多跟信任的人聊一聊。" },
      { max: 8, level: "o", label: "6～8 項", flag: true },
      { max: 12, level: "o", label: "9 項以上", flag: true },
    ],
  },

  depression: {
    no: 7, nm: "情緒自我檢視表", short: "憂鬱情緒檢核",
    src: "課本 P.247・董氏基金會 心理衛生中心",
    kind: "yn", mins: "約 4 分鐘", flag: true,
    lead: "請按照你最近兩週的想法與感受，回答「是」或「否」",
    qs: [
      "我覺得現在比以前容易失去耐心。",
      "我比平常更容易煩躁。",
      "我想離開目前的生活環境。",
      "我變得比以前容易生氣。",
      "我心情變得很不好。",
      "我變得整天懶洋洋、無精打采。",
      "我覺得身體不舒服。",
      "我常覺得胸悶。",
      "最近大多數時候我覺得全身無力。",
      "我變得睡眠不安寧，很容易失眠或驚醒。",
      "我變得很不想上學。",
      "我變得對許多事都失去興趣。",
      "我變得坐立不安，靜不下來。",
      "我變得只想一個人獨處。",
      "我變得什麼事都不想做。",
      "無論我做什麼都不會讓我變得更好。",
      "我覺得自己很差勁。",
      "我變得沒有辦法集中注意力。",
      "我對自己很失望。",
      "我想要消失不見。",
    ],
    bands: [
      { max: 5, level: "g", label: "0～5 分",
        msg: "你真的不錯喔！憂鬱程度滿低的，平時就知道要如何調整情緒及紓解壓力，繼續保持下去。" },
      { max: 11, level: "y", label: "6～11 分",
        msg: "最近的心情是不是起起伏伏？試著把問題和感受向你信任的人說出來，一起討論解決的方法。也可以多做腹式深呼吸、每天運動，保持活動的習慣。" },
      { max: 20, level: "o", label: "12～20 分", flag: true },
    ],
    critical: 19,
  },

}

/**
 * 紅旗門檻。交接文件第 5 節明定不可更動。
 * depression 的第 20 題另計，見 Scale.critical。
 */
export const FOLLOWUP: Partial<Record<ScaleKey, (score: number) => boolean>> = {
  mood: (s) => s >= 10,       // 心情溫度計 ≥10 分（中度以上）
  stress: (s) => s >= 6,      // 壓力偵測站 ≥6 項
  depression: (s) => s >= 12, // 憂鬱情緒檢核 ≥12 分
}

/** 題數；決策樹題數不固定，回傳 null */
export function questionCount(key: ScaleKey): number | null {
  const s = SCALES[key]
  if (s.kind === 'tree') return null
  return s.groups ? s.groups.reduce((a, g) => a + g.qs.length, 0) : (s.qs?.length ?? 0)
}

/** 卡片上的副標，例：「10 題・約 3 分鐘」 */
export function subLine(key: ScaleKey): string {
  const s = SCALES[key]
  const n = questionCount(key)
  return `${n === null ? s.qcount : `${n} 題`}・${s.mins}`
}

/** 首頁最底下的題目出處列 */
export const SOURCE_LINE =
  '題目出處：' +
  SCALE_KEYS.map((k) => `${SCALES[k].short}／${SCALES[k].src.split('・')[1]}`).join('；') +
  '。'
