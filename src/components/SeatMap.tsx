export interface SeatCell {
  row: number
  col: number
  label?: string
  sublabel?: string
  state: 'empty' | 'taken' | 'mine' | 'disabled'
}

/**
 * 通用座位圖。第 1 列畫在最靠近講台的位置。
 * 老師端與學生端共用，差別只在 cells 的 state 與 onSelect。
 */
export default function SeatMap({
  rows, cols, cells, onSelect,
}: {
  rows: number
  cols: number
  cells: SeatCell[]
  onSelect?: (row: number, col: number) => void
}) {
  const at = (r: number, c: number) => cells.find((x) => x.row === r && x.col === c)

  const styleFor = (s: SeatCell['state']) => ({
    empty: 'border-dashed border-slate-300 bg-white hover:border-slate-500 text-slate-400',
    taken: 'border-slate-300 bg-slate-100 text-slate-700',
    mine: 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200',
    disabled: 'border-transparent bg-slate-50 text-slate-300',
  }[s])

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-slate-800 py-2 text-center text-xs font-medium tracking-widest text-white">
        講　台
      </div>
      <div className="overflow-x-auto">
        <div
          className="grid min-w-max gap-2"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(4.5rem, 1fr))` }}
        >
          {Array.from({ length: rows }, (_, ri) =>
            Array.from({ length: cols }, (_, ci) => {
              const r = ri + 1
              const c = ci + 1
              const cell = at(r, c) ?? { row: r, col: c, state: 'empty' as const }
              const clickable = onSelect && cell.state !== 'disabled'
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onSelect(r, c)}
                  className={`flex h-16 flex-col items-center justify-center rounded-lg border-2 px-1 text-center transition ${styleFor(cell.state)} ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  {cell.state === 'disabled' ? (
                    <span className="text-xs">—</span>
                  ) : cell.label ? (
                    <>
                      <span className="truncate text-sm font-medium leading-tight">{cell.label}</span>
                      {cell.sublabel && (
                        <span className="truncate text-[10px] text-slate-500">{cell.sublabel}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs">空位</span>
                  )}
                </button>
              )
            }),
          )}
        </div>
      </div>
    </div>
  )
}
