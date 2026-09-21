import { useEffect, useMemo, useRef, useState } from 'react'

type Mode = 'focus' | 'sleep'

const MODES: Record<Mode, { label: string; phases: { label: string; seconds: number; scale: string }[] }> = {
  focus: {
    label: '3-3-6 專注版',
    phases: [
      { label: '吸氣', seconds: 3, scale: 'scale-110' },
      { label: '停留', seconds: 3, scale: 'scale-110' },
      { label: '吐氣', seconds: 6, scale: 'scale-75' },
    ],
  },
  sleep: {
    label: '3-3-9 睡前版',
    phases: [
      { label: '吸氣', seconds: 3, scale: 'scale-110' },
      { label: '停留', seconds: 3, scale: 'scale-110' },
      { label: '慢慢吐氣', seconds: 9, scale: 'scale-75' },
    ],
  },
}

const RELEASE_SCAN = ['頸部', '肩膀', '胸口', '背部', '腰', '臀部', '膝蓋', '腳踝', '手肘', '手腕', '手指']
const GUIDED_SCRIPT = [
  '現在，找一個舒服的坐姿。',
  '讓脊柱微微向上，肩膀自然放鬆。',
  '我們先做三三六呼吸。',
  '吸氣，一，二，三。',
  '停留，一，二，三。',
  '慢慢吐氣，一，二，三，四，五，六。',
  '再一次，吸氣，一，二，三。',
  '停留，一，二，三。',
  '吐氣時，放鬆頸部，肩膀，胸口，背部，腰，手臂，手腕，手指。',
  '如果有念頭出現，只要知道它來了，再把注意力帶回呼吸。',
  '最後一輪，吸氣，一，二，三。',
  '停留，一，二，三。',
  '慢慢吐氣，一，二，三，四，五，六。',
  '現在，想一件今天值得感謝的小事。',
  '讓身體記住這個穩定的感覺。',
]

function beep() {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return
  const ctx = new AudioContextClass()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = 440
  gain.gain.setValueAtTime(0.001, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 0.2)
  setTimeout(() => void ctx.close(), 260)
}

export default function BreathingGuide() {
  const [mode, setMode] = useState<Mode>('focus')
  const [running, setRunning] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [phase, setPhase] = useState(0)
  const [left, setLeft] = useState(MODES.focus.phases[0].seconds)
  const soundOn = useRef(false)

  const phases = MODES[mode].phases
  const current = phases[phase]
  const total = useMemo(() => phases.reduce((sum, p) => sum + p.seconds, 0), [phases])
  const scan = current.label.includes('吐氣')
    ? RELEASE_SCAN[(current.seconds - left) % RELEASE_SCAN.length]
    : null

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setLeft((prev) => {
        if (prev > 1) return prev - 1
        setPhase((p) => {
          const next = (p + 1) % phases.length
          if (soundOn.current) beep()
          setLeft(phases[next].seconds)
          return next
        })
        return prev
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running, phases])

  const start = (nextMode: Mode, withSound: boolean) => {
    setMode(nextMode)
    soundOn.current = withSound
    setPhase(0)
    setLeft(MODES[nextMode].phases[0].seconds)
    setRunning(true)
    if (withSound) beep()
  }

  const playVoiceGuide = () => {
    if (!('speechSynthesis' in window)) return
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const utterance = new SpeechSynthesisUtterance(GUIDED_SCRIPT.join('　'))
    utterance.lang = 'zh-TW'
    utterance.rate = 0.82
    utterance.pitch = 1
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.cancel()
    setSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  return (
    <div className="mt-3 rounded-xl border border-[#C7E2DC] bg-[#F7FCFB] px-4 py-4 text-center">
      <div className="mb-3 rounded-xl bg-white px-3 py-3 text-left">
        <b className="block text-[14px]">語音引導冥想</b>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[#4A6461]">
          按下後會用瀏覽器中文語音帶你做三輪 3-3-6，最後接一個感恩覺察。
        </p>
        <button
          type="button"
          onClick={playVoiceGuide}
          className="mt-2 w-full rounded-xl bg-[#12776E] py-2.5 text-[14px] font-bold text-white"
        >
          {speaking ? '停止語音引導' : '播放語音引導'}
        </button>
      </div>
      <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-[#DDF0EC]">
        <div className={`flex h-20 w-20 items-center justify-center rounded-full bg-[#12776E] text-white transition-transform duration-1000 ${running ? current.scale : 'scale-90'}`}>
          <span className="text-lg font-bold">{running ? current.label : '準備'}</span>
        </div>
      </div>
      <p className="mt-3 text-[13.5px] text-[#4A6461]">
        {MODES[mode].label}，一輪 {total} 秒。跟著圓圈放大縮小，先做 3 輪就好。
      </p>
      {scan && (
        <p className="mt-1 text-[13.5px] font-medium text-[#12776E]">
          吐氣時放鬆：{scan}
        </p>
      )}
      {running && (
        <p className="mt-1 text-2xl font-bold tabular-nums text-[#0E2E2B]">{left}</p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => start('focus', false)}
          className="rounded-xl border border-[#12776E] bg-white py-2.5 text-[14px] font-bold text-[#12776E]"
        >
          3-3-6
        </button>
        <button
          type="button"
          onClick={() => start('sleep', false)}
          className="rounded-xl bg-[#12776E] py-2.5 text-[14px] font-bold text-white"
        >
          3-3-9
        </button>
      </div>
      <p className="mt-2 text-left text-[12px] leading-relaxed text-[#8A5310]">
        若覺得胸悶、頭暈或不舒服，先停止練習，改成自然呼吸。
      </p>
      {running && (
        <button
          type="button"
          onClick={() => setRunning(false)}
          className="mt-2 text-[13px] font-medium text-[#4A6461] underline"
        >
          暫停
        </button>
      )}
    </div>
  )
}
