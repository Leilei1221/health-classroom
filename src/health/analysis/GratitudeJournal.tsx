import { useEffect, useState } from 'react'

const STORAGE_KEY = 'hc_gratitude_journal_v1'

interface Entry {
  date: string
  grateful: string
  helped: string
  tomorrow: string
}

const today = () => new Date().toISOString().slice(0, 10)

export default function GratitudeJournal() {
  const [entry, setEntry] = useState<Entry>({
    date: today(),
    grateful: '',
    helped: '',
    tomorrow: '',
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const entries = JSON.parse(raw) as Entry[]
      const latest = entries.find((e) => e.date === today()) ?? entries[0]
      if (latest) setEntry(latest)
    } catch { /* localStorage 失敗不影響頁面 */ }
  }, [])

  const set = (key: keyof Entry, value: string) => {
    setSaved(false)
    setEntry((prev) => ({ ...prev, [key]: value }))
  }

  const save = () => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      const entries = raw ? JSON.parse(raw) as Entry[] : []
      const next = [entry, ...entries.filter((e) => e.date !== entry.date)].slice(0, 14)
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setSaved(true)
    } catch {
      setSaved(false)
    }
  }

  return (
    <section className="mx-3 my-3.5 overflow-hidden rounded-2xl border border-[#C7E2DC] bg-white">
      <div className="border-b border-[#C7E2DC] bg-[#F7FCFB] px-4 pb-3 pt-3.5">
        <h3 className="text-base font-bold">感恩日記</h3>
        <p className="mt-0.5 text-[13px] text-[#4A6461]">
          寫一點點就好，資料只存在這台裝置，不會送到資料庫
        </p>
      </div>
      <div className="space-y-3 px-4 py-4">
        <Field
          label="今天有一件值得感謝的小事"
          value={entry.grateful}
          onChange={(v) => set('grateful', v)}
          placeholder="例如：朋友借我筆記、今天午餐很好吃、我有把一題弄懂"
        />
        <Field
          label="今天誰或什麼幫助了我"
          value={entry.helped}
          onChange={(v) => set('helped', v)}
          placeholder="可以是人、環境，也可以是自己做的一個選擇"
        />
        <Field
          label="明天我想對自己做的一件善意小事"
          value={entry.tomorrow}
          onChange={(v) => set('tomorrow', v)}
          placeholder="例如：睡前 3 輪呼吸、下課去裝水、先寫 10 分鐘"
        />
        <button
          type="button"
          onClick={save}
          className="w-full rounded-xl bg-[#12776E] py-3 text-[15px] font-bold text-white"
        >
          儲存在這台裝置
        </button>
        {saved && (
          <p className="text-center text-[13px] font-medium text-[#12776E]">已儲存今天的紀錄</p>
        )}
      </div>
    </section>
  )
}

function Field({ label, value, onChange, placeholder }: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="block">
      <span className="text-[13.5px] font-bold">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        maxLength={160}
        placeholder={placeholder}
        className="mt-1.5 w-full resize-none rounded-xl border border-[#C7E2DC] bg-[#F7FCFB] px-3 py-2 text-[14px] leading-relaxed outline-none focus:border-[#12776E]"
      />
    </label>
  )
}
