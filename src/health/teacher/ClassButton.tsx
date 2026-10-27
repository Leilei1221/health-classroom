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
      className={`cute-chip ${on ? 'bg-cute-yellow' : 'bg-white'}`}
    >
      {cls.row.name}
      {!cls.enabled && (
        <span className="ml-1.5 text-xs text-cute-mute">
          已停用
        </span>
      )}
    </button>
  )
}
