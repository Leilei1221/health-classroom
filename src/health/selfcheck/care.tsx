/**
 * 關懷文案。
 *
 * 交接文件第 5 節鐵則 1：這是固定文字，絕不接 AI 生成，
 * 也不要在這個情境給任何生活習慣建議。內容原封不動照抄原型的 careHTML()。
 *
 * 鐵則 2：不要對求助專線做保密性或通報與否的保證。
 * 原型的文案刻意避開了這點，不要「補上」。
 *
 * 花中實況：學生不打分機，直接走過去或找老師。
 */

/** critical：第 20 題「我想要消失不見」勾選時，換掉中間那一段 */
export default function Care({ critical }: { critical: boolean }) {
  return (
    <div className="mx-3 my-3.5 rounded-2xl border border-[#E2C9A6] bg-[#FDF3E3] px-4 py-4 text-[#7A4A08]">
      <h4 className="mb-1.5 text-[15.5px] font-bold">謝謝你照實回答</h4>
      <p className="mb-2 text-[14px] leading-relaxed">
        願意誠實勾選，本身就需要一點勇氣。這份量表不是診斷，它只是說：你最近可能過得比較辛苦。
      </p>
      {critical ? (
        <p className="mb-2 text-[14px] leading-relaxed">
          剛剛有一題，是關於「想要消失不見」。會有這種念頭的人比你想像的多，而且這種時候找人談，不是因為不夠堅強，是因為這件事本來就不該一個人扛。
        </p>
      ) : (
        <p className="mb-2 text-[14px] leading-relaxed">
          這種時候找人談，不是因為你不夠堅強，而是因為這本來就不是一個人扛的事。
        </p>
      )}
      <p className="mb-1.5 text-[14px]">你可以：</p>
      <ul className="ml-5 list-disc space-y-1 text-[14px] leading-relaxed">
        <li><b>直接去輔導室</b>——不用先打電話、不用預約，走過去就可以</li>
        <li><b>來找健護課的黃老師</b>——下課來找我，或上課結束留一下都行</li>
        <li>你信任的導師、家人或朋友</li>
        <li>安心專線 <Tel>1925</Tel>（24 小時、免費）</li>
        <li>生命線 <Tel>1995</Tel>、張老師 <Tel>1980</Tel></li>
      </ul>
    </div>
  )
}

function Tel({ children }: { children: string }) {
  return (
    <a href={`tel:${children}`} className="font-bold tabular-nums text-[#B26A12] underline">
      {children}
    </a>
  )
}
