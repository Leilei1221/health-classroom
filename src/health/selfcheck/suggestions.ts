/**
 * 建議庫。
 *
 * 【這個檔案是從規格書「產生」出來的，不要手改】
 * 來源：docs/學生端分析頁_建議庫內容.md，用程式逐欄抽出來，不是重打的。
 * 要改內容請改那份文件再重新產生。
 *
 * 那份文件開頭寫得很清楚：
 *   **文案請原樣使用，不要改寫、不要自行新增條目。**
 *   健康建議的內容由授課教師負責，程式端只負責呈現。
 *
 * 目前只有 stress 這一組被接上去用（L1 的學生會看到，見 ScaleResult）。
 * 其餘領域、運動建議與現況文案要等學生端分析頁做出來才會用到——
 * 先整份轉好是因為分兩次抄同一份文件，就有兩次抄錯的機會。
 */

export type Domain = 'sleep' | 'diet' | 'activity' | 'stress' | 'hydration' | 'screen'

export interface Suggestion {
  id: string
  domain: Domain
  title: string
  why: string
  how: string
  /** 1-5，1 最容易 */
  difficulty: number
  timeframe: string
  /** 今天就做得到的一件事 */
  firstStep: string
}

export interface Exercise {
  id: string
  name: string
  kcal: string
  freq: string
  plan: string
}

/** 分析頁第 ② 區用。中性描述，不評價 */
export interface CurrentState {
  trigger: string
  now: string
  why: string
}

export const SUGGESTIONS: Suggestion[] = [
  {
    id: "sleep-01", domain: "sleep",
    title: "倒推計劃法",
    why: "固定起床時間比固定就寢時間更容易建立生理時鐘，因為起床受鬧鐘控制，入睡不行。",
    how: "先決定明天要幾點起床，往前推 7-8 小時就是該上床的時間，把那個時間設成「準備睡覺」的鬧鐘。",
    difficulty: 2, timeframe: "2 週",
    firstStep: "今晚設一個「準備睡覺」的鬧鐘。",
  },
  {
    id: "sleep-02", domain: "sleep",
    title: "2-2-2 法則",
    why: "睡前的重食、劇烈運動和藍光，會各自從不同方向把入睡時間往後推。",
    how: "睡前 2 小時：不吃大餐、不做劇烈運動、不看手機或電腦螢幕。三件做到一件就有差。",
    difficulty: 3, timeframe: "2 週",
    firstStep: "今天睡前 2 小時先做到「不吃大餐」這一項。",
  },
  {
    id: "sleep-03", domain: "sleep",
    title: "手機不進房間",
    why: "手機放在伸手可及的地方，平均會讓入睡時間延後 30 分鐘以上。放遠一點比靠意志力有效。",
    how: "晚上固定時間把手機放在書桌充電，不帶進床上。需要鬧鐘的話用傳統鬧鐘或手錶。",
    difficulty: 3, timeframe: "2 週",
    firstStep: "今晚把充電線從床邊移到書桌。",
  },
  {
    id: "sleep-04", domain: "sleep",
    title: "15 分鐘原則",
    why: "躺著睡不著卻一直待在床上，大腦會把「床」和「清醒」連在一起，反而更難睡。",
    how: "躺 15 分鐘還沒睡著就起來，到別的地方做低刺激的事（看紙本書、伸展），想睡了再回床上。",
    difficulty: 2, timeframe: "2 週",
    firstStep: "今晚如果翻來覆去，起來走動 5 分鐘再躺回去。",
  },
  {
    id: "sleep-05", domain: "sleep",
    title: "4-7-8 呼吸法",
    why: "延長吐氣會啟動副交感神經，是少數幾個能在幾分鐘內降低生理喚起的方法。",
    how: "吸氣 4 秒、閉氣 7 秒、吐氣 8 秒，重複 4 次。躺著做就可以。",
    difficulty: 1, timeframe: "1 週",
    firstStep: "今晚躺下後做 4 輪試試看。",
  },
  {
    id: "sleep-06", domain: "sleep",
    title: "早晨時段取代熬夜",
    why: "同樣的讀書時間，睡飽後的早晨效率高於熬夜的凌晨，記憶固化也需要睡眠完成。",
    how: "把熬夜的那段改成提早一小時起床。第一週會很痛苦，第二週開始會習慣。",
    difficulty: 4, timeframe: "1 個月",
    firstStep: "明天比平常早 20 分鐘起床，不是一小時。",
  },
  {
    id: "diet-01", domain: "diet",
    title: "買便當時多說一句",
    why: "不用多花錢就能改變一餐的組成，老闆通常願意配合，同學也不會覺得奇怪。",
    how: "點餐時說「菜多一點、飯少一點」。同一家店講過兩次之後，老闆就會記得。",
    difficulty: 1, timeframe: "2 週",
    firstStep: "今天中午的便當試著說一次。",
  },
  {
    id: "diet-02", domain: "diet",
    title: "用餐順序",
    why: "先吃蔬菜和蛋白質再吃飯，餐後血糖上升比較平緩，下午比較不會想睡。",
    how: "順序：先湯、再菜、後肉、最後飯。不用少吃，只是換順序。",
    difficulty: 2, timeframe: "2 週",
    firstStep: "今天午餐先把青菜吃完再動飯。",
  },
  {
    id: "diet-03", domain: "diet",
    title: "便利商店怎麼選",
    why: "便利商店不是只有泡麵和炸物，同樣的預算可以換到完全不同的組成。",
    how: "選：高纖飯糰、無糖茶、生菜沙拉、茶葉蛋、無糖豆漿。少選：炸物、泡麵、含糖飲料。",
    difficulty: 2, timeframe: "2 週",
    firstStep: "下次進超商，飲料先看無糖那一排。",
  },
  {
    id: "diet-04", domain: "diet",
    title: "含糖飲料減半",
    why: "一杯全糖手搖的糖分接近一天建議上限，而且液體的糖不會帶來飽足感。",
    how: "不用戒掉。先從「每次都點」改成「隔天點」，或從全糖改成半糖、無糖。",
    difficulty: 2, timeframe: "1 個月",
    firstStep: "今天這杯改成半糖。",
  },
  {
    id: "diet-05", domain: "diet",
    title: "早餐吃得到蛋白質",
    why: "只吃麵包或飯糰，血糖起落大，第二三節課容易恍神。加一份蛋白質可以撐比較久。",
    how: "早餐加一顆蛋、一杯無糖豆漿或鮮奶。不用增加太多花費。",
    difficulty: 2, timeframe: "2 週",
    firstStep: "明天早餐加一顆茶葉蛋。",
  },
  {
    id: "diet-06", domain: "diet",
    title: "80/20 法則",
    why: "要求自己餐餐完美，通常撐不過一週；允許自己有兩成的彈性，反而撐得久。",
    how: "一週 21 餐，抓 16-17 餐顧好組成，剩下的想吃什麼就吃什麼，不用有罪惡感。",
    difficulty: 1, timeframe: "1 個月",
    firstStep: "這週挑一餐當作「想吃什麼就吃」的那一餐。",
  },
  {
    id: "act-01", domain: "activity",
    title: "爬樓梯取代電梯",
    why: "不用額外時間、不用場地、不用花錢，累積量比想像中大。",
    how: "三層樓以內一律走樓梯。從一天兩三次開始。",
    difficulty: 1, timeframe: "2 週",
    firstStep: "今天回教室走樓梯。",
  },
  {
    id: "act-02", domain: "activity",
    title: "晚自習後 5 分鐘伸展",
    why: "久坐之後的肩頸和下背需要活動，5 分鐘就能明顯改善，也有助於入睡。",
    how: "在教室或回家後做：頸部繞環、擴胸、體側伸展、大腿後側伸展，各 30 秒。",
    difficulty: 1, timeframe: "2 週",
    firstStep: "今晚讀完書後做 5 分鐘。",
  },
  {
    id: "act-03", domain: "activity",
    title: "午休到操場走走",
    why: "白天照到陽光有助於晚上入睡，而且午餐後散步比趴睡更不會下午昏沉。",
    how: "午餐後走 10-15 分鐘，找同學一起比較走得下去。",
    difficulty: 2, timeframe: "2 週",
    firstStep: "明天午休出去走一圈。",
  },
  {
    id: "act-04", domain: "activity",
    title: "徒手訓練",
    why: "不需要健身房或器材，在房間就能做，對高中生來說是最沒有門檻的肌力訓練。",
    how: "深蹲、伏地挺身、棒式，各做能力所及的次數，隔天做一次。",
    difficulty: 3, timeframe: "1 個月",
    firstStep: "今天做 10 下深蹲，就這樣。",
  },
  {
    id: "act-05", domain: "activity",
    title: "通勤與等待時間",
    why: "零碎時間累積起來一週也有一兩個小時，而且不佔用讀書時間。",
    how: "等公車時做小腿提踵或深呼吸；搭車時可以做肩頸活動。",
    difficulty: 1, timeframe: "2 週",
    firstStep: "今天等車時墊腳尖 20 下。",
  },
  {
    id: "act-06", domain: "activity",
    title: "找一項會想做的運動",
    why: "靠意志力做討厭的運動撐不過一個月，找到會期待的活動才有機會持續。",
    how: "打球、跑步、游泳、重訓都可以。重點是「會想去」，不是「最有效」。",
    difficulty: 2, timeframe: "1 個月",
    firstStep: "這週約一個同學打一次球。",
  },
  {
    id: "stress-01", domain: "stress",
    title: "番茄鐘",
    why: "把大塊時間切成 25 分鐘，開始的門檻變低，也比較不會滑手機滑掉一小時。",
    how: "25 分鐘專心、5 分鐘休息，四輪後休息 20 分鐘。休息時離開座位。",
    difficulty: 2, timeframe: "2 週",
    firstStep: "今晚用一輪 25 分鐘試試。",
  },
  {
    id: "stress-02", domain: "stress",
    title: "暫時性筆記",
    why: "讀書時冒出來的雜念（要回訊息、要買東西）寫下來就能先放下，不用一直佔著腦袋。",
    how: "桌上放一張紙，想到什麼寫一行，讀完書再處理。",
    difficulty: 1, timeframe: "1 週",
    firstStep: "今晚拿一張紙放旁邊。",
  },
  {
    id: "stress-03", domain: "stress",
    title: "5 分鐘開始法",
    why: "拖延多半卡在「開始」，不是卡在「做」。先答應自己只做 5 分鐘，通常就會做下去。",
    how: "跟自己說只做 5 分鐘，做完真的可以停。多數時候會繼續。",
    difficulty: 1, timeframe: "2 週",
    firstStep: "現在挑一件拖很久的事，做 5 分鐘。",
  },
  {
    id: "stress-04", domain: "stress",
    title: "考試週降標不中斷",
    why: "習慣最怕的不是做得少，是完全停掉。降低標準比中斷好。",
    how: "考試週把目標砍半（每週 5 天改 3 天、30 分鐘改 10 分鐘），但不要歸零。",
    difficulty: 2, timeframe: "考試週",
    firstStep: "下次段考前先決定要降到多少。",
  },
  {
    id: "stress-05", domain: "stress",
    title: "找人說",
    why: "壓力講出來就會小一點，這不是軟弱，是有效的方法。",
    how: "找同學、家人、導師或輔導老師都可以。不知道從哪講起，就從「最近有點累」開始。",
    difficulty: 3, timeframe: "—",
    firstStep: "這週找一個人講一句你最近的狀況。",
  },
  {
    id: "water-01", domain: "hydration",
    title: "出門前先喝",
    why: "一天的第一杯最容易忘，補上之後總量就差不少。",
    how: "起床後或出門前喝 200-300ml 白開水。",
    difficulty: 1, timeframe: "2 週",
    firstStep: "明天出門前喝一杯。",
  },
  {
    id: "water-02", domain: "hydration",
    title: "用瓶數計算",
    why: "「今天喝幾 ml」很難記，「今天喝完幾瓶」一看就知道。",
    how: "帶一個固定容量的水壺，目標設成一天幾瓶。",
    difficulty: 1, timeframe: "2 週",
    firstStep: "明天帶水壺上學。",
  },
  {
    id: "water-03", domain: "hydration",
    title: "下課去裝水",
    why: "把喝水綁在既有的行為上，不用另外記得。",
    how: "每節下課去飲水機裝一次水，順便活動。",
    difficulty: 1, timeframe: "2 週",
    firstStep: "今天下課去裝一次。",
  },
  {
    id: "screen-01", domain: "screen",
    title: "手機放抽屜",
    why: "手機在視線內，即使沒拿起來也會佔掉一部分注意力。",
    how: "讀書時把手機放抽屜或包包，不是翻面放桌上。",
    difficulty: 2, timeframe: "2 週",
    firstStep: "今晚讀書時把手機收進抽屜。",
  },
  {
    id: "screen-02", domain: "screen",
    title: "睡前不看短影片",
    why: "短影片的節奏會讓大腦持續保持高度喚起，比看書更難平靜下來。",
    how: "睡前那段改成看紙本、聽音樂或伸展。",
    difficulty: 3, timeframe: "2 週",
    firstStep: "今晚睡前把短影片換成別的事。",
  },
  {
    id: "screen-03", domain: "screen",
    title: "設一個提醒",
    why: "滑手機最難的是察覺自己滑了多久，靠提醒比靠自覺容易。",
    how: "用手機內建的螢幕使用時間設每日提醒。",
    difficulty: 1, timeframe: "1 週",
    firstStep: "今天去設定裡把提醒打開。",
  },
]

export const EXERCISES: Exercise[] = [
  { id: "ex-01", name: "快走", kcal: "每 30 分鐘約 120-150 大卡",
    freq: "每週 5 次", plan: "第 1-2 週 15 分鐘 → 第 3-4 週 25 分鐘 → 之後 30 分鐘" },
  { id: "ex-02", name: "慢跑", kcal: "每 30 分鐘約 250-300 大卡",
    freq: "每週 3 次", plan: "先走跑交替（走 2 分跑 1 分）→ 連續跑 10 分鐘 → 連續 20 分鐘" },
  { id: "ex-03", name: "籃球", kcal: "每 30 分鐘約 200-250 大卡",
    freq: "每週 2-3 次", plan: "從半場打起，先求有去，不求打滿" },
  { id: "ex-04", name: "游泳", kcal: "每 30 分鐘約 250-300 大卡",
    freq: "每週 2 次", plan: "先 200 公尺分段游 → 400 公尺 → 連續" },
  { id: "ex-05", name: "徒手肌力", kcal: "每 20 分鐘約 80-120 大卡",
    freq: "隔天一次", plan: "深蹲/伏地挺身/棒式各一組 → 兩組 → 三組" },
  { id: "ex-06", name: "騎腳踏車", kcal: "每 30 分鐘約 200 大卡",
    freq: "每週 3 次", plan: "通勤路段先騎一半 → 全程 → 週末加長程" },
]

export const CURRENT_STATE: CurrentState[] = [
  { trigger: "sleep_under_6",
    now: "你目前的睡眠時間，比這個年齡建議的少一些。",
    why: "睡眠不足最先影響的是記憶固化和專注力，這兩件事直接關係到你讀書的效率。" },
  { trigger: "sleep_6_7",
    now: "你的睡眠時間接近建議下限，還有一點空間。",
    why: "多睡半小時到一小時，隔天的專注力差異通常很明顯。" },
  { trigger: "veg_under_3",
    now: "你的蔬果攝取目前偏少。",
    why: "蔬果提供的維生素、礦物質和纖維，是其他類食物補不太回來的。" },
  { trigger: "sugar_drink",
    now: "含糖飲料在你的日常裡出現得比較頻繁。",
    why: "液體的糖不會帶來飽足感，減下來是最省力的改變之一。" },
  { trigger: "exercise_under_1h",
    now: "你目前的每日活動量，低於這個年齡的建議。",
    why: "規律活動對睡眠品質和情緒的效果，通常比大家以為的更直接。" },
  { trigger: "screen_over_2h",
    now: "課業以外的螢幕時間偏長。",
    why: "這段時間最容易被拿走的是睡眠，往回挪一點就有感。" },
  { trigger: "stress_high",
    now: "你目前感受到的壓力偏高。",
    why: "壓力本身不是問題，有方法處理才是關鍵。" },
  { trigger: "water_under_target",
    now: "你的飲水量低於依體重估算的建議值。",
    why: "輕微脫水會先表現成注意力下降和頭痛，很容易被誤認成累。" },
  { trigger: "sleep_onset",
    now: "你躺上床之後，需要比較長的時間才能入睡。",
    why: "入睡時間拉長會直接吃掉睡眠總量，而且躺著睡不著本身就累。" },
  { trigger: "fried_food",
    now: "油炸與高熱量食物在你的日常飲食裡出現得比較頻繁。",
    why: "這類食物容易取代掉其他類別的份量，不是多吃了什麼，是少吃了什麼。" },
  { trigger: "bp_amber",
    now: "你的血壓數值接近參考範圍的上限。",
    why: "現在建立的習慣，會是未來心血管健康的資產。" },
  { trigger: "bmi_amber_high",
    now: "你的 BMI 落在這個年齡的過重範圍。",
    why: "從飲食組成和活動量著手，比單看數字有意義得多。" },
  { trigger: "bmi_amber_low",
    now: "你的 BMI 低於這個年齡的建議範圍。",
    why: "均衡吃夠三餐是這學期可以留意的方向，成長期需要足夠的原料。" },
]

/** 某個領域的建議條目，順序照規格書 */
export const byDomain = (d: Domain): Suggestion[] =>
  SUGGESTIONS.filter((s) => s.domain === d)
