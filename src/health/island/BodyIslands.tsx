import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { ISLANDS, LINKS, islandById, type Building, type Island, type IslandId } from './islands'

/**
 * 身體島：學生入口的另一種樣子，把作業依身體系統放在一座座島上。
 *
 * 這一頁是另開的新頁（/health/island），學生現在用的入口頁 StudentHome 完全沒動。
 * 不讀也不寫資料庫，只是換一種方式把作業連結排出來。
 *
 * 三種模式：
 * - live：學生登入後看到的，點建築會進作業頁
 * - preview：教師預覽，連到各作業的 /preview 頁
 * - demo：給蕾蕾老師看版面的獨立示範檔，不連任何地方
 *
 * 地圖下面有一份文字清單，內容和點島看到的一樣：
 * 不想看地圖、或用螢幕報讀的學生，從清單也能做完所有事。
 */
export type IslandMode = 'live' | 'preview' | 'demo'

/**
 * ChatGPT 畫好的圖放這裡（id → 圖片網址）。沒有的島用下面的向量圖。
 * 例：import cardioPng from '../../assets/island/cardio.png'，再寫 cardio: cardioPng
 */
const ISLAND_ART: Partial<Record<IslandId, string>> = {}

/** 人體輪廓：畫成海面上的虛線「礁岸」，讓學生看出群島排成一個人 */
const BODY_OUTLINE =
  'M162,124 L198,124 Q205,140 230,146 Q262,154 270,180 L292,300 Q296,318 282,320 Q270,322 266,306 L250,214 ' +
  'L248,330 Q250,350 244,366 L236,540 Q234,560 214,560 Q200,560 198,540 L186,390 L174,390 L162,540 ' +
  'Q160,560 146,560 Q126,560 124,540 L116,366 Q110,350 112,330 L110,214 L94,306 Q90,322 78,320 ' +
  'Q64,318 68,300 L90,180 Q98,154 130,146 Q155,140 162,124 Z'

/** 用固定的種子產生不規則的島形，每次畫出來都一樣 */
function blob(cx: number, cy: number, r: number, seed: number, squash = 0.62): string {
  const n = 10
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const wobble = 0.86 + 0.14 * Math.sin(seed * 12.9898 + i * 78.233) ** 2
    pts.push([cx + Math.cos(a) * r * wobble, cy + Math.sin(a) * r * wobble * squash])
  }
  // 用相鄰點的中點做二次曲線，邊緣才會圓滑
  const mid = (p: [number, number], q: [number, number]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
  const start = mid(pts[n - 1], pts[0])
  let d = `M${start[0].toFixed(1)},${start[1].toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const m = mid(p, pts[(i + 1) % n])
    d += ` Q${p[0].toFixed(1)},${p[1].toFixed(1)} ${m[0].toFixed(1)},${m[1].toFixed(1)}`
  }
  return d + 'Z'
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    setReduced(mq.matches)
    const on = () => setReduced(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return reduced
}

/** 兩座島之間的弧線，往外彎一點才不會穿過別的島 */
function arc(a: Island, b: Island): string {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const bend = 34
  const cx = mx + (-dy / len) * bend
  const cy = my + (dx / len) * bend
  return `M${a.x},${a.y} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b.x},${b.y}`
}

function IslandShape({ island, index, active, dimmed, onPick }: {
  island: Island
  index: number
  active: boolean
  dimmed: boolean
  onPick: () => void
}) {
  const { x, y, r } = island
  const art = ISLAND_ART[island.id]
  const top = blob(x, y, r, index + 1)
  const cliff = blob(x, y + 9, r, index + 1)
  const shallow = blob(x, y + 6, r + 13, index + 7)
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${island.name}（${island.system}）`}
      aria-pressed={active}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick() }
      }}
      className="island-g cursor-pointer outline-none"
      style={{
        opacity: dimmed ? 0.45 : 1,
        transform: active ? 'translateY(-5px)' : undefined,
        transformOrigin: `${x}px ${y}px`,
        transition: 'opacity .25s, transform .25s',
      }}
    >
      {art ? (
        <image href={art} x={x - r * 1.35} y={y - r * 1.35} width={r * 2.7} height={r * 2.7} />
      ) : (
        <>
          <path d={shallow} fill="#BFE0E8" opacity={0.75} />
          <path d={cliff} fill="#C9A878" />
          <path d={blob(x, y + 2, r, index + 1)} fill="#EED9B0" />
          <path d={blob(x, y - 2, r * 0.84, index + 3)} fill={island.tint} />
          <circle cx={x} cy={y - 4} r={17} fill="#fff" opacity={0.92} />
          <g transform={`translate(${x - 11} ${y - 15}) scale(0.92)`}>
            <path
              d={island.icon} fill="none" stroke="#3B5878" strokeWidth={1.9}
              strokeLinecap="round" strokeLinejoin="round"
            />
          </g>
        </>
      )}
      {/* 選中時的外框，鍵盤 focus 也看得到 */}
      <path d={top} fill="none" stroke="#3B5878" strokeWidth={2.5} strokeDasharray="5 4"
        className="island-ring" opacity={active ? 1 : 0} />
      <g transform={`translate(${x} ${y + r * 0.62 + 14})`}>
        <rect x={-38} y={-11} width={76} height={22} rx={11} fill="#fff" opacity={0.94} />
        <text textAnchor="middle" dy="0.35em" fontSize={12.5} fontWeight={700} fill="#2B3A4A">
          {island.name}
        </text>
      </g>
    </g>
  )
}

function groupByLink(list: Building[]): Building[][] {
  const out: Building[][] = []
  for (const b of list) {
    const last = out[out.length - 1]
    if (last && b.to && last[0].to === b.to) last.push(b)
    else out.push([b])
  }
  return out
}

function BuildingLink({ to, label, mode }: { to: string; label: string; mode: IslandMode }) {
  const cls = 'mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#4F6F92] px-3 py-1.5 text-[12.5px] font-bold text-white'
  if (mode === 'demo') {
    return <span className={`${cls} opacity-60`} title="示範版不連到作業">{label}（示範）</span>
  }
  return <RouterLink to={mode === 'preview' ? `${to}/preview` : to} className={cls}>{label} →</RouterLink>
}

function IslandCard({ island, mode, onClose, onPick }: {
  island: Island
  mode: IslandMode
  onClose: () => void
  onPick: (id: IslandId) => void
}) {
  const links = LINKS.filter((l) => l.from === island.id || l.to === island.id)
  return (
    <div
      role="dialog"
      aria-label={island.name}
      className="glass fixed inset-x-0 bottom-0 z-20 mx-auto max-h-[72vh] max-w-[520px] overflow-y-auto rounded-t-[28px] px-5 pb-8 pt-4"
    >
      <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-mist-main/30" />
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold tracking-[0.12em] text-mist-mute">{island.system}</div>
          <h2 className="text-[22px] font-bold leading-tight">{island.name}</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-mist-mute">{island.intro}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="關閉"
          className="glass flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
        >
          ×
        </button>
      </div>

      <h3 className="mt-4 text-[14px] font-bold tracking-[0.1em] text-mist-deep">島上有什麼</h3>
      {/* 連到同一頁的相鄰項目併成一張卡，按鈕只出現一次，不會一連三個「到身體數值登記」 */}
      <ul className="mt-2 space-y-2">
        {groupByLink(island.buildings).map((g) => (
          <li key={g[0].name} className="rounded-2xl bg-white/55 px-3.5 py-3">
            {g.map((b) => (
              <div key={b.name} className="mb-1.5 last:mb-0">
                <div className="text-[15px] font-bold">{b.name}</div>
                <p className="text-[13px] leading-normal text-mist-mute">{b.note}</p>
              </div>
            ))}
            {g[0].to && g[0].toLabel && <BuildingLink to={g[0].to} label={g[0].toLabel} mode={mode} />}
          </li>
        ))}
      </ul>

      {links.length > 0 && (
        <>
          <h3 className="mt-5 text-[14px] font-bold tracking-[0.1em] text-mist-deep">和其他島的連線</h3>
          <ul className="mt-2 space-y-2">
            {links.map((l) => {
              const other = islandById(l.from === island.id ? l.to : l.from)
              return (
                <li key={`${l.from}-${l.to}`} className="rounded-2xl border border-dashed border-mist-main/40 px-3.5 py-3">
                  <button onClick={() => onPick(other.id)} className="text-[14px] font-bold text-[#3F5F82] underline-offset-2 hover:underline">
                    {islandById(l.from).name} → {islandById(l.to).name}
                  </button>
                  <p className="mt-0.5 text-[13.5px] leading-relaxed">{l.text}</p>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

export default function BodyIslands({ mode, studentName }: { mode: IslandMode; studentName?: string }) {
  const [picked, setPicked] = useState<IslandId | null>(null)
  const [showLinks, setShowLinks] = useState(true)
  const [explored, setExplored] = useState(false)
  const reduced = usePrefersReducedMotion()
  const pick = (id: IslandId) => { setPicked(id); setExplored(true) }
  const island = picked ? islandById(picked) : null

  const related = useMemo(() => {
    if (!picked) return null
    const s = new Set<IslandId>([picked])
    LINKS.forEach((l) => {
      if (l.from === picked) s.add(l.to)
      if (l.to === picked) s.add(l.from)
    })
    return s
  }, [picked])

  useEffect(() => {
    if (!picked) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPicked(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picked])

  const home = mode === 'preview' ? '/health/preview' : '/health'

  return (
    <div className="glass-page-mesh min-h-screen text-mist-ink">
      <div className="mx-auto flex max-w-[520px] flex-col gap-4 px-4 pb-24 pt-5">
        <header className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-mist-mute">{studentName ? `${studentName}的` : '我的'}</div>
            <h1 className="text-[24px] font-bold leading-tight">身體群島</h1>
          </div>
          {mode !== 'demo' && (
            <RouterLink to={home} className="glass flex h-11 items-center rounded-[22px] px-4 text-[13px] font-medium">
              回首頁
            </RouterLink>
          )}
        </header>

        <p className="text-[14px] leading-relaxed text-mist-mute">
          你的身體像一座群島：每座島是一個身體系統，島上放著跟它有關的作業。島和島之間的線，是系統之間互相幫忙的關係。
        </p>

        <div className="glass relative overflow-hidden rounded-[28px]">
          <svg viewBox="0 0 360 600" className="block w-full" role="group" aria-label="身體群島地圖，完整內容也可以用下方的文字清單操作">
            <style>{'.island-g:focus-visible .island-ring{opacity:1}'}</style>
            <defs>
              <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#CFE4EC" />
                <stop offset="1" stopColor="#A9CCDA" />
              </linearGradient>
              <pattern id="waves" width="40" height="22" patternUnits="userSpaceOnUse">
                <path d="M2 14q6-5 12 0t12 0" fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={1.2} />
              </pattern>
            </defs>
            <rect width="360" height="600" fill="url(#sea)" />
            <rect width="360" height="600" fill="url(#waves)" />

            {/* 人體輪廓：頭是一個圓，其餘是一條虛線礁岸 */}
            <g fill="#fff" fillOpacity={0.18} stroke="#fff" strokeOpacity={0.85} strokeWidth={2} strokeDasharray="3 6" strokeLinecap="round">
              <circle cx={180} cy={78} r={46} />
              <path d={BODY_OUTLINE} />
            </g>

            {showLinks && LINKS.map((l, i) => {
              const a = islandById(l.from)
              const b = islandById(l.to)
              const d = arc(a, b)
              const on = !picked || l.from === picked || l.to === picked
              return (
                <g key={i} opacity={on ? 1 : 0.2} style={{ transition: 'opacity .25s' }}>
                  <path d={d} fill="none" stroke="#fff" strokeWidth={2.4} strokeDasharray="1 7" strokeLinecap="round" />
                  {!reduced && (
                    <circle r={4} fill="#F8D768" stroke="#fff" strokeWidth={1.5}>
                      <animateMotion dur={`${5 + (i % 3)}s`} repeatCount="indefinite" path={d} />
                    </circle>
                  )}
                </g>
              )
            })}

            {ISLANDS.map((isl, i) => (
              <IslandShape
                key={isl.id}
                island={isl}
                index={i}
                active={picked === isl.id}
                dimmed={!!related && !related.has(isl.id)}
                onPick={() => pick(isl.id)}
              />
            ))}
          </svg>

          {!explored && (
            <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
              <span className="rounded-full bg-white/90 px-3.5 py-1.5 text-[13px] font-bold text-mist-deep shadow">
                點一座島，開始探索
              </span>
            </div>
          )}

          <div className="absolute bottom-3 left-3">
            <button
              onClick={() => setShowLinks((v) => !v)}
              aria-pressed={showLinks}
              className="rounded-full bg-white/90 px-3 py-1.5 text-[12.5px] font-bold text-mist-deep shadow"
            >
              {showLinks ? '隱藏連線' : '顯示連線'}
            </button>
          </div>
        </div>

        <section className="flex flex-col gap-2">
          <h2 className="px-1.5 text-[15px] font-bold tracking-[0.12em] text-mist-deep">所有島嶼（文字清單）</h2>
          {ISLANDS.map((isl) => (
            <button
              key={isl.id}
              onClick={() => pick(isl.id)}
              className="glass flex items-center gap-3 rounded-3xl p-3.5 text-left"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: isl.tint }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#3B5878" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={isl.icon} />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold leading-snug">{isl.name}</span>
                <span className="block text-[13px] leading-normal text-mist-mute">{isl.system}・{isl.buildings.length} 項</span>
              </span>
            </button>
          ))}
        </section>
      </div>

      {island && (
        <>
          <div className="fixed inset-0 z-10 bg-[#2B3A4A]/20" onClick={() => setPicked(null)} aria-hidden />
          <IslandCard island={island} mode={mode} onClose={() => setPicked(null)} onPick={pick} />
        </>
      )}
    </div>
  )
}
