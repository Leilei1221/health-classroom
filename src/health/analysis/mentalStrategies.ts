import type { HealthSelfcheck } from '../../lib/types'
import type { FocusItem } from './engine'

export type MindBodyKind = 'breathing' | 'sound' | 'sleep' | 'reframe' | 'sunlight' | 'support' | 'problem'

export interface MindBodyStrategy {
  id: string
  kind: MindBodyKind
  title: string
  when: string
  why: string
  steps: string[]
}

const STRATEGIES: Record<string, MindBodyStrategy> = {
  breathing: {
    id: 'mind-breathing',
    kind: 'breathing',
    title: '全集中 3-3-6 呼吸',
    when: '緊張、心跳變快、胸口悶，或讀書前很難靜下來時',
    why: '吸 3、停 3、吐 6。吐氣比吸氣長，可以把身體從緊繃帶回比較穩定的狀態。',
    steps: [
      '坐穩，脊柱微微向上，肩膀自然下沉。',
      '吸氣 3 秒，停留 3 秒，吐氣 6 秒；不要用力憋氣。',
      '吐氣時從頸部、肩膀一路掃描到手指，把緊繃一節一節放掉。',
    ],
  },
  sound: {
    id: 'mind-sound',
    kind: 'sound',
    title: '律動聲音：用節拍把注意力拉回來',
    when: '腦袋停不下來、一直想同一件事時',
    why: '穩定的聲音節奏能提供外在錨點，讓注意力暫時離開反覆擔心的內容。',
    steps: [
      '戴耳機或把音量調小，選沒有歌詞、節奏穩定的聲音。',
      '聽 3 到 5 分鐘，只做一件事：注意聲音出現、停住、消失。',
      '結束後再回來決定下一個小步驟。',
    ],
  },
  sleep: {
    id: 'mind-sleep',
    kind: 'sleep',
    title: '睡眠策略：固定一個睡前關機點',
    when: '睡不著、睡眠品質不佳，或睡前仍在滑手機時',
    why: '充足睡眠和規律作息是恢復心理健康的重要基礎。先固定關機點，比要求自己立刻睡著更可行。',
    steps: [
      '選一個今天做得到的時間，作為手機離手時間。',
      '睡前 20 分鐘改成低刺激活動：伸展、紙本閱讀、整理明天用品。',
      '躺下 15 分鐘仍睡不著，就起來做安靜的事，想睡再回床。',
    ],
  },
  reframe: {
    id: 'mind-reframe',
    kind: 'reframe',
    title: '正向詮釋四步驟',
    when: '難過、自責、覺得都是自己不好時',
    why: '課本提醒，情緒需要被看見，也可以練習換一個比較不傷自己的角度來理解。',
    steps: [
      '面對它：寫下發生了什麼事，以及我現在的感受。',
      '接受它：提醒自己「有這種感受很正常」，先不急著責備自己。',
      '處理它：找一件自己可以改變的小事，例如傳訊息、排時間、問一個人。',
      '放下它：已經做過能做的事後，先讓這件事緩一緩。',
    ],
  },
  sunlight: {
    id: 'mind-sunlight',
    kind: 'sunlight',
    title: '戶外日光與活動',
    when: '心情悶、提不起勁，或一整天待在室內時',
    why: '課本提到日光與活動有助於穩定情緒。先去戶外 10 分鐘，比要求自己運動很久更容易開始。',
    steps: [
      '午休或放學後，到戶外走 10 分鐘。',
      '不用追求流汗，先讓身體動起來、眼睛看到自然光。',
      '如果可以，找同學一起走，讓活動變得比較容易持續。',
    ],
  },
  support: {
    id: 'mind-support',
    kind: 'support',
    title: '找一個信任的人說',
    when: '事情在心裡卡很久、自己想不出方法時',
    why: '壓力和情緒不一定要自己扛。說出來能讓問題變得比較具體，也比較容易找到下一步。',
    steps: [
      '先挑一個安全的人：同學、家人、導師或輔導老師。',
      '不知道怎麼開頭，可以只說：「我最近有點累，想講一下。」',
      '不需要一次講完整，先讓對方知道你現在不太好。',
    ],
  },
  problem: {
    id: 'mind-problem',
    kind: 'problem',
    title: '壓力問題解決五步驟',
    when: '壓力來自明確事件，例如考試、作業、社團、人際衝突時',
    why: '把壓力拆成可以處理的步驟，比只想「我壓力很大」更容易行動。',
    steps: [
      '確定問題：這件事真正卡住的是什麼？',
      '分析原因：是時間不夠、方法不會，還是需要別人協助？',
      '列出方法：先寫 2 到 3 個可行方案。',
      '決定採用：選阻力最小、今天能開始的一個。',
      '評估修正：做完後看有沒有變好，再調整下一步。',
    ],
  },
}

function push(out: MindBodyStrategy[], key: keyof typeof STRATEGIES) {
  if (!out.some((s) => s.id === STRATEGIES[key].id)) out.push(STRATEGIES[key])
}

export function mindBodyStrategies(
  selfcheck: HealthSelfcheck | null,
  focuses: FocusItem[],
): MindBodyStrategy[] {
  const out: MindBodyStrategy[] = []
  const triggers = new Set(focuses.map((f) => f.trigger))
  const lifestyleSleepFlag =
    (selfcheck?.lifestyle?.red ?? []).includes(6)
    || (selfcheck?.lifestyle?.yellow ?? []).includes(6)
    || (selfcheck?.lifestyle?.red ?? []).includes(7)
    || (selfcheck?.lifestyle?.yellow ?? []).includes(7)
  const h85210SleepFlag = selfcheck?.h85210?.sleep8 === false
  const sleepScaleFlag = selfcheck?.sleep_isi !== null && (selfcheck?.sleep_isi ?? 0) >= 10

  if (
    triggers.has('sleep_under_6')
    || triggers.has('sleep_6_7')
    || triggers.has('sleep_onset')
    || lifestyleSleepFlag
    || h85210SleepFlag
    || sleepScaleFlag
  ) {
    push(out, 'sleep')
    push(out, 'breathing')
  }
  if (triggers.has('stress_high') || (selfcheck?.stress_level !== null && (selfcheck?.stress_level ?? 0) >= 4)) {
    push(out, 'breathing')
    push(out, 'problem')
    push(out, 'sound')
  }
  if (
    triggers.has('mood_low')
    || (selfcheck?.depression !== null && (selfcheck?.depression ?? 0) >= 6)
    || (selfcheck?.mood_scale !== null && (selfcheck?.mood_scale ?? 0) >= 6)
  ) {
    push(out, 'reframe')
    push(out, 'support')
    push(out, 'sunlight')
  }

  push(out, 'breathing')
  return out.slice(0, 4)
}
