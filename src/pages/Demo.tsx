import { Link } from 'react-router-dom'
import Layout from '../components/Layout'

/**
 * 示範區：上課投影時要給全班看的畫面。
 *
 * 每一條都走 /preview，用的是 src/health/preview.ts 裡的假學生（王小明），
 * 不讀也不寫資料庫——所以投影出來不會有任何一位真實學生的資料，
 * 也不會因為老師示範按了送出就在某個人的紀錄上留下東西。
 *
 * 以前這些是班級列表右上角的三顆「預覽・◯◯」按鈕，只有三頁，
 * 而且跟點名、匯入名單擠在同一排。
 */
const DEMOS: { to: string; label: string; desc: string }[] = [
  { to: '/health/preview', label: '學生入口', desc: '學生掃 QR code 進來看到的第一頁' },
  { to: '/health/register/preview', label: '身體數值登記', desc: '身高體重血壓等，量完當場填' },
  { to: '/health/selfcheck/preview', label: '課本自我檢測', desc: '課本的量表，填完看自己的結果' },
  { to: '/health/plate/preview', label: '我的餐盤', desc: '六大類食物的份數記錄' },
  { to: '/health/analysis/preview', label: '健康分析', desc: '把登記的數值換成看得懂的話' },
  { to: '/health/goal/preview', label: 'SMART 目標', desc: '訂一個做得到的目標' },
  { to: '/health/checkin/preview', label: '第一週打卡', desc: '目標訂完之後的七天紀錄' },
]

export default function Demo() {
  return (
    <Layout title="示範區" back="/">
      <div className="mb-4 rounded-lg border border-[#E2C9A6] bg-[#FDF3E3] px-4 py-3 text-sm leading-relaxed text-[#8A5310]">
        <strong>這些是示範畫面</strong>
        　用的是範例學生「王小明」，不會讀也不會寫任何學生資料，可以放心投影、
        也可以按按看每一個欄位。要回到這一頁，按畫面右上角的「離開預覽」。
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DEMOS.map((d) => (
          <Link
            key={d.to}
            to={d.to}
            className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-400 hover:shadow-sm"
          >
            <div className="font-medium">{d.label}</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{d.desc}</p>
          </Link>
        ))}
      </div>
    </Layout>
  )
}
