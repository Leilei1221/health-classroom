import { CARE_COPY, TEACHER_PLACEHOLDER, type CopyBlock } from './riskCopy'
import type { RiskLevel } from '../riskLevel'

/**
 * L1–L3 的固定關懷文案。
 *
 * 文字全部來自 riskCopy.ts（由規格書產生），這裡只負責排版：
 * 把 **粗體** 標記轉成 <strong>，把清單轉成 <ul>，把「蕾蕾老師」換成授課教師。
 * **沒有任何造句邏輯**——規格書第一條鐵則是文案絕不由 AI 生成。
 *
 * 規格書「絕對不可以做的事」：
 *   2. 不出現「你可能有憂鬱症」之類的字 —— 文案本身就沒有，這裡也不加
 *   3. 不顯示分數或等第 —— 這個元件拿不到分數，只拿得到 level
 *   4. L2、L3 不顯示任何生活習慣建議 —— 由呼叫端決定要不要接建議，見 ScaleResult
 */
export default function RiskCare({ level, teacherName }: {
  /** 1–3。L0 不會走到這裡 */
  level: Exclude<RiskLevel, 0>
  /** hc_my_teacher_name() 回來的姓名；拿不到時只寫「老師」 */
  teacherName: string | null
}) {
  const who = teacherName
    ? (teacherName.endsWith('老師') ? teacherName : `${teacherName}老師`)
    : '老師'

  return (
    <div className={`mx-3 mb-3.5 rounded-2xl border px-4 py-5 ${
      level === 3
        ? 'border-[#E2C9A6] bg-[#FDF3E3] text-[#7A4A08]'
        : level === 2
          ? 'border-[#E2C9A6] bg-[#FDF3E3] text-[#7A4A08]'
          : 'border-[#C7E2DC] bg-[#F7FCFB] text-[#0E2E2B]'
    }`}>
      {CARE_COPY[level].map((b, i) => (
        <Block key={i} block={b} who={who} first={i === 0} />
      ))}
    </div>
  )
}

function Block({ block, who, first }: { block: CopyBlock; who: string; first: boolean }) {
  if (block.kind === 'list') {
    return (
      <ul className="mb-2 ml-1 list-none space-y-1">
        {block.items.map((t, i) => (
          <li key={i} className="text-[14px] leading-relaxed">
            <span className="mr-1.5">・</span><Inline text={t} who={who} />
          </li>
        ))}
      </ul>
    )
  }
  return (
    <p className={`text-[14px] leading-relaxed ${first ? 'mb-2 text-[15.5px]' : 'mb-2'}`}>
      <Inline text={block.text} who={who} />
    </p>
  )
}

/** 只處理 **粗體** 與授課教師姓名，不做其他任何加工 */
function Inline({ text, who }: { text: string; who: string }) {
  const filled = text.split(TEACHER_PLACEHOLDER).join(who)
  return (
    <>
      {filled.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i}>{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>,
      )}
    </>
  )
}
