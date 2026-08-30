import readXlsxFile, { type Row } from 'read-excel-file/browser'
import type { RosterRow } from './types'

/** 允許的欄位標題別名，容忍常見的寫法差異 */
const HEADERS: Record<keyof RosterRow, string[]> = {
  class_name: ['班級', '班別', '班', 'class'],
  seat_no: ['座號', '座位號', 'seat'],
  student_no: ['學號', '學生證號', 'id', 'student_no'],
  name: ['姓名', '學生姓名', '名字', 'name'],
}

const norm = (v: unknown) => String(v ?? '').replace(/\s+/g, '').toLowerCase()

function findColumns(header: Row): Record<keyof RosterRow, number> {
  const idx = {} as Record<keyof RosterRow, number>
  for (const key of Object.keys(HEADERS) as (keyof RosterRow)[]) {
    idx[key] = header.findIndex((h) => HEADERS[key].some((alias) => norm(h) === norm(alias)))
  }
  return idx
}

export interface ParsedRoster {
  rows: RosterRow[]
  classNames: string[]
  skipped: number
}

/** 讀取 .xlsx／.csv 名單，回傳整理後的列與偵測到的班級 */
export async function parseRosterFile(file: File): Promise<ParsedRoster> {
  const table: Row[] = file.name.toLowerCase().endsWith('.csv')
    ? await parseCsv(file)
    : asRows(await readXlsxFile(file))

  if (table.length < 2) {
    throw new Error('檔案內容不足，至少需要標題列與一列資料。')
  }

  const idx = findColumns(table[0])
  const missing = (Object.keys(idx) as (keyof RosterRow)[])
    .filter((k) => idx[k] < 0)
    .filter((k) => k !== 'seat_no') // 座號可缺
  if (missing.length > 0) {
    const label: Record<string, string> = {
      class_name: '班級', student_no: '學號', name: '姓名',
    }
    throw new Error(`找不到欄位：${missing.map((m) => label[m]).join('、')}。請確認第一列是標題列。`)
  }

  const cell = (r: Row, i: number) => (i < 0 ? '' : String(r[i] ?? '').trim())

  const rows: RosterRow[] = []
  let skipped = 0
  for (const r of table.slice(1)) {
    const row: RosterRow = {
      class_name: cell(r, idx.class_name),
      seat_no: cell(r, idx.seat_no),
      student_no: cell(r, idx.student_no),
      name: cell(r, idx.name),
    }
    if (!row.class_name || !row.student_no || !row.name) { skipped++; continue }
    rows.push(row)
  }

  if (rows.length === 0) throw new Error('沒有可匯入的資料列。')

  const classNames = [...new Set(rows.map((r) => r.class_name))].sort()
  return { rows, classNames, skipped }
}

/**
 * read-excel-file 的型別多載在未指定 getSheets 時無法自動收斂
 * （會是 Row[] | Sheet[] 的聯集）。實際上只有 getSheets: true 才回傳工作表物件，
 * 這裡以執行期檢查確認確實是資料列，再收斂型別。
 */
function asRows(raw: unknown): Row[] {
  if (!Array.isArray(raw)) throw new Error('無法解析試算表內容。')
  if (raw.length > 0 && !Array.isArray(raw[0])) {
    throw new Error('無法解析試算表內容：未預期的格式。')
  }
  return raw as Row[]
}

async function parseCsv(file: File): Promise<Row[]> {
  const text = await file.text()
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((line) => line.split(',').map((c) => c.trim().replace(/^"|"$/g, '')))
}

/** 308 這類班級慣例上開 8 組，其餘用預設值；仍可在畫面上逐班調整 */
export function suggestGroupCount(className: string, fallback: number): number {
  return className.includes('308') ? 8 : fallback
}
