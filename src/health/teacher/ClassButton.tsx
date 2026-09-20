import type { HealthClass } from '../api'

/**
 * 教師端三頁共用的班級切換鈕。
 *
 * 白名單關掉的班仍然列出來（只要它有資料），但標上「已停用」——
 * 期末把某個班關掉時，資料從畫面上消失會讓人以為資料不見了。
 * 資料還在，只是這個班不再收新的。
 */
export default function ClassButton({ cls, current, onPick }: {
  cls: HealthClass
  current: string | null
  onPick: (id: string) => void
}) {
  const on = cls.row.id === current
  return (
    <button
      onClick={() => onPick(cls.row.id)}
      title={cls.enabled ? undefined : '這個班的健康模組已停用，資料仍然看得到'}
      className={`rounded-lg px-3 py-1.5 text-sm ${
        on
          ? 'bg-slate-900 font-bold text-white'
          : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {cls.row.name}
      {!cls.enabled && (
        <span className={`ml-1.5 text-xs ${on ? 'opacity-70' : 'text-slate-400'}`}>
          已停用
        </span>
      )}
    </button>
  )
}
