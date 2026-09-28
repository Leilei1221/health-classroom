import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth'
import Layout from '../components/Layout'
import { Button, Empty, ErrorBox, Field, Spinner, inputClass } from '../components/ui'
import {
  createLink, deleteLink, listClasses, listLinkClasses, listLinks,
  setLinkClasses, updateLink,
} from '../lib/api'
import { friendlyError } from '../lib/errors'
import type { ClassRow, LinkRow } from '../lib/types'

/**
 * 學生端內容管理。
 *
 * 蕾蕾 9/27：「我今天把 CPR 節奏的 GitHub 網址加進去，它就會自動出現在學生端。」
 * 這一頁就是那件事的畫面。加一筆，學生入口的「課程活動」就多一張卡。
 *
 * 三個刻意的決定：
 * - **只存連結，不嵌內容。** 學生端一律 target="_blank" 另開分頁，
 *   外部網站維持自己的樣子（她說「不需要去更改他們的風格」）。
 * - **只收 https。** 前端擋是為了當場講清楚，真正擋住的是資料庫的 check constraint。
 * - **哪些班看得到要自己選。** 情境解謎只給多元選修，三年級那一頁不該有那張卡。
 */

/** 資料庫的 check constraint：url ~* '^https://[^[:space:]]+$' and length(url) <= 500 */
const URL_RE = /^https:\/\/\S+$/

/** Artifact 連結預設是私人的，貼進來之前要先在該頁按 Share */
const isArtifact = (url: string) => /claude\.ai\/(artifact|public\/artifacts)/i.test(url)

type Draft = {
  title: string
  url: string
  description: string
  visible: boolean
  all_classes: boolean
  classIds: string[]
}

const EMPTY: Draft = {
  title: '', url: '', description: '', visible: true, all_classes: true, classIds: [],
}

export default function Links() {
  const { teacher } = useAuth()
  const [links, setLinks] = useState<LinkRow[] | null>(null)
  const [pairs, setPairs] = useState<{ link_id: string; class_id: string }[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [editingId, setEditingId] = useState<string | null>(null)

  const active = useMemo(() => classes.filter((c) => c.is_active), [classes])
  const classById = useMemo(
    () => Object.fromEntries(classes.map((c) => [c.id, c])) as Record<string, ClassRow>,
    [classes],
  )

  const reload = () => {
    setError('')
    Promise.all([listLinks(), listLinkClasses(), listClasses()])
      .then(([ls, ps, cs]) => { setLinks(ls); setPairs(ps); setClasses(cs) })
      .catch((e) => { setLinks([]); setError(friendlyError(e)) })
  }
  useEffect(reload, [])

  const classesOf = (linkId: string) =>
    pairs.filter((p) => p.link_id === linkId).map((p) => p.class_id)

  /** 前端驗證，與資料庫的 check constraint 同一組條件 */
  function check(d: Draft): string {
    const title = d.title.trim()
    if (title.length < 1 || title.length > 60) return '標題請填 1～60 個字'
    if (!URL_RE.test(d.url.trim())) return '網址要以 https:// 開頭，而且中間不能有空白'
    if (d.url.trim().length > 500) return '網址太長了（最多 500 個字）'
    if (d.description.trim().length > 120) return '說明最多 120 個字'
    if (!d.all_classes && d.classIds.length === 0) {
      return '選了「指定班級」就要至少勾一個班，不然學生端不會出現這一張'
    }
    return ''
  }

  async function save() {
    const msg = check(draft)
    if (msg) { setError(msg); return }
    if (!teacher) { setError('找不到教師身分，請重新登入'); return }
    setBusy(true)
    setError('')
    try {
      const body = {
        title: draft.title.trim(),
        url: draft.url.trim(),
        description: draft.description.trim() || null,
        visible: draft.visible,
        all_classes: draft.all_classes,
      }
      let id = editingId
      if (id) {
        await updateLink(id, body)
      } else {
        // 新增的排在最後面；之後用上下箭頭調
        const next = (links ?? []).reduce((m, l) => Math.max(m, l.sort_order), -1) + 1
        const row = await createLink({ ...body, teacher_id: teacher.id, sort_order: next })
        id = row.id
      }
      // all_classes 時對照表清空：留著的話，之後改回「指定班級」會冒出舊設定
      await setLinkClasses(id, draft.all_classes ? [] : draft.classIds)
      setAdding(false)
      setEditingId(null)
      setDraft(EMPTY)
      reload()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  async function toggleVisible(l: LinkRow) {
    setError('')
    try {
      await updateLink(l.id, { visible: !l.visible })
      reload()
    } catch (e) { setError(friendlyError(e)) }
  }

  async function remove(l: LinkRow) {
    if (!confirm(`確定要刪掉「${l.title}」嗎？\n\n學生端就看不到這一張了。外部網站本身不受影響。`)) return
    setError('')
    try {
      await deleteLink(l.id)
      reload()
    } catch (e) { setError(friendlyError(e)) }
  }

  /**
   * 上下移動。
   * 不是只交換兩列的 sort_order —— 舊資料可能整批都是 0，交換等於沒動。
   * 直接照移動後的順序重編號，只送出真的變了的那幾列。
   */
  async function move(index: number, dir: -1 | 1) {
    const rows = [...(links ?? [])]
    const to = index + dir
    if (to < 0 || to >= rows.length) return
    ;[rows[index], rows[to]] = [rows[to], rows[index]]
    setLinks(rows)
    setError('')
    try {
      await Promise.all(
        rows.map((l, i) => (l.sort_order === i ? null : updateLink(l.id, { sort_order: i })))
          .filter(Boolean) as Promise<LinkRow>[],
      )
      reload()
    } catch (e) { setError(friendlyError(e)); reload() }
  }

  function startEdit(l: LinkRow) {
    setEditingId(l.id)
    setAdding(false)
    setDraft({
      title: l.title,
      url: l.url,
      description: l.description ?? '',
      visible: l.visible,
      all_classes: l.all_classes,
      classIds: classesOf(l.id),
    })
  }

  return (
    <Layout title="學生端內容管理" back="/">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-sm leading-relaxed text-slate-500">
          這裡加的連結會出現在學生入口的「課程活動」。學生按了是用新分頁開啟，
          外部網站維持原本的樣子。
        </p>
        <Button
          onClick={() => {
            setAdding((v) => !v); setEditingId(null); setDraft(EMPTY); setError('')
          }}
        >
          {adding ? '取消' : '+ 新增連結'}
        </Button>
      </div>

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      {(adding || editingId) && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <LinkForm
            draft={draft}
            setDraft={setDraft}
            classes={active}
            busy={busy}
            onSave={save}
            onCancel={() => { setAdding(false); setEditingId(null); setDraft(EMPTY); setError('') }}
          />
        </div>
      )}

      {links === null ? (
        <Spinner />
      ) : links.length === 0 ? (
        <Empty>還沒有任何連結。按右上角「新增連結」加第一個，例如 CPR 節奏練習。</Empty>
      ) : (
        <div className="space-y-3">
          {links.map((l, i) => {
            const ids = classesOf(l.id)
            return (
              <div
                key={l.id}
                className={`rounded-xl border bg-white p-4 ${
                  l.visible ? 'border-slate-200' : 'border-dashed border-slate-300 bg-slate-50'
                }`}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      onClick={() => void move(i, -1)}
                      disabled={i === 0}
                      aria-label="往上移"
                      className="rounded border border-slate-200 px-1.5 text-slate-500 disabled:opacity-30"
                    >↑</button>
                    <button
                      onClick={() => void move(i, 1)}
                      disabled={i === links.length - 1}
                      aria-label="往下移"
                      className="rounded border border-slate-200 px-1.5 text-slate-500 disabled:opacity-30"
                    >↓</button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{l.title}</span>
                      {!l.visible && (
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">
                          已隱藏
                        </span>
                      )}
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                        {l.all_classes
                          ? '所有班級'
                          : ids.length === 0
                            ? '沒有指定班級'
                            : ids.map((id) => classById[id]?.name ?? '（已刪除的班）').join('、')}
                      </span>
                    </div>
                    {l.description && (
                      <p className="mt-1 text-sm text-slate-600">{l.description}</p>
                    )}
                    <p className="mt-1 break-all font-mono text-xs text-slate-400">{l.url}</p>
                    {isArtifact(l.url) && (
                      <p className="mt-1 text-xs leading-relaxed text-[#8A5310]">
                        這是 Artifact 連結：要先在該頁按 Share 分享出去，學生才打得開。
                        建議用無痕視窗測一次。
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-1">
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      測試開啟
                    </a>
                    <Button variant="ghost" onClick={() => void toggleVisible(l)}>
                      {l.visible ? '隱藏' : '顯示'}
                    </Button>
                    <Button variant="ghost" onClick={() => startEdit(l)}>編輯</Button>
                    <Button variant="ghost" onClick={() => void remove(l)}>刪除</Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}

function LinkForm({ draft, setDraft, classes, busy, onSave, onCancel }: {
  draft: Draft
  setDraft: (d: Draft) => void
  classes: ClassRow[]
  busy: boolean
  onSave: () => void
  onCancel: () => void
}) {
  const toggleClass = (id: string) =>
    setDraft({
      ...draft,
      classIds: draft.classIds.includes(id)
        ? draft.classIds.filter((x) => x !== id)
        : [...draft.classIds, id],
    })

  return (
    <div className="space-y-4">
      <Field label="標題">
        <input
          className={inputClass}
          maxLength={60}
          placeholder="例：CPR 節奏練習"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </Field>

      <Field label="網址">
        <input
          className={inputClass}
          maxLength={500}
          placeholder="https://…"
          value={draft.url}
          onChange={(e) => setDraft({ ...draft, url: e.target.value })}
        />
      </Field>
      <p className="-mt-2 text-xs leading-relaxed text-slate-500">
        只收 https 開頭的網址。
        {isArtifact(draft.url) && (
          <span className="text-[#8A5310]">
            　這是 Artifact 連結：要先在該頁按 Share 分享出去，學生才打得開。
            存好之後用「測試開啟」加無痕視窗確認一次。
          </span>
        )}
      </p>

      <Field label="說明（選填）">
        <input
          className={inputClass}
          maxLength={120}
          placeholder="一行字，學生會看到"
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </Field>

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">哪些班看得到</span>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              checked={draft.all_classes}
              onChange={() => setDraft({ ...draft, all_classes: true })}
            />
            <span>我的所有班級</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              checked={!draft.all_classes}
              onChange={() => setDraft({ ...draft, all_classes: false })}
            />
            <span>只有指定的班級</span>
          </label>
          {!draft.all_classes && (
            <div className="ml-6 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {classes.length === 0 ? (
                <p className="text-xs text-slate-500">還沒有班級。</p>
              ) : classes.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.classIds.includes(c.id)}
                    onChange={() => toggleClass(c.id)}
                  />
                  <span>
                    {c.name}
                    <span className="ml-1 text-xs text-slate-400">
                      {c.academic_year}-{c.semester}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={draft.visible}
          onChange={(e) => setDraft({ ...draft, visible: e.target.checked })}
        />
        <span>
          現在就顯示給學生
          <span className="ml-1.5 text-xs text-slate-500">
            取消勾選就是先存起來，學生端不會出現；要用的時候再回來按「顯示」
          </span>
        </span>
      </label>

      <div className="flex gap-2">
        <Button onClick={onSave} disabled={busy}>{busy ? '儲存中…' : '儲存'}</Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>取消</Button>
      </div>
    </div>
  )
}
