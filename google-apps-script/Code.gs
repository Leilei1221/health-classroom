/**
 * 花蓮高中 健護課 — Supabase → Google Sheets 點名同步
 *
 * 把 hc_attendance（出缺席）與 hc_performance_records（上課表現）
 * 寫進課室紀錄試算表，每班一個分頁。
 *
 * 設定放在最上方 CONFIG；service_role key 放 Script Properties，不寫在程式碼裡。
 */

// =============================================================================
// CONFIG
// =============================================================================

const CONFIG = {
  SUPABASE_URL: 'https://fcstpyiggvhduaztwlrf.supabase.co',
  SPREADSHEET_ID: '1aB3z7xke9KmiVFJ0zcD2TPLjGAT9HGcLSUh4H5a2QkM',

  /** service_role key 的 Script Property 名稱 */
  KEY_PROPERTY: 'SUPABASE_SERVICE_KEY',

  /** 只同步這些班級；留空陣列表示同步全部有課的班級 */
  CLASS_FILTER: ['305', '306', '307', '308', '309'],

  /** 第 1 列為合併主標題、第 2 列為子標題、第 3 列起為學生資料 */
  HEADER_ROW: 1,
  SUBHEADER_ROW: 2,
  FIRST_DATA_ROW: 3,

  /** 固定前 4 欄 */
  FIXED_HEADERS: ['座號', '姓名', '組別', '座位'],

  /** 右側「上課表現」統計區的子標題 */
  STAT_HEADERS: ['曠課', '遲到', '玩手機', '睡覺', '聊天', '其他', '成績'],
  STAT_GROUP_TITLE: '上課表現',

  /**
   * 成績基準分。
   * 由現有分頁反推：0曠0遲=90、2曠=80、1曠1遲=83、4曠=70、1曠2遲=81，
   * 全部符合「90 − 曠課×5 − 遲到×2」，且 5／2 即資料庫的扣分值。
   * 因此成績 = BASE_SCORE + 出缺席扣分 + 上課表現加扣分。
   */
  BASE_SCORE: 90,

  /**
   * 節次對應時間，用於子標題「第X節 HH:MM」。
   * 由現有分頁確認第6節=14:10、第7節=15:10；其餘依此推。
   * 若與實際鐘點不符，改這裡即可。
   */
  PERIOD_TIMES: {
    1: '8:10', 2: '9:10', 3: '10:10', 4: '11:10',
    5: '13:10', 6: '14:10', 7: '15:10', 8: '16:10',
  },

  /** 出缺席在試算表上的寫法；出席留空白 */
  ATTENDANCE_TEXT: {
    present: '', late: '遲到', absent: '曠課', leave: '請假', official: '公假',
  },

  /** 上課表現項目 → 試算表用語；未列出者歸入「其他」 */
  PERF_ALIAS: {
    '使用手機': '玩手機',
    '趴睡': '睡覺',
    '講話干擾': '聊天',
  },

  /** 統計欄的分桶：試算表用語 → 統計欄名稱 */
  PERF_BUCKET: {
    '玩手機': '玩手機', '睡覺': '睡覺', '聊天': '聊天',
  },
}

// =============================================================================
// 選單與觸發器
// =============================================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('健護課同步')
    .addItem('同步今天的點名', 'syncToday')
    .addItem('同步指定日期…', 'promptSyncDate')
    .addItem('重算所有統計欄', 'recalcAllStats')
    .addSeparator()
    .addItem('安裝每日 18:00 自動同步', 'installDailyTrigger')
    .addItem('移除自動同步', 'removeDailyTrigger')
    .addToUi()
}

/** 每日 18:00 由觸發器呼叫 */
function dailySync() {
  const result = syncDate_(todayStr_())
  console.log(formatResult_(result))
}

function syncToday() {
  const result = syncDate_(todayStr_())
  toast_(formatResult_(result))
}

function promptSyncDate() {
  const ui = SpreadsheetApp.getUi()
  const res = ui.prompt('同步指定日期', '請輸入日期（YYYY-MM-DD）', ui.ButtonSet.OK_CANCEL)
  if (res.getSelectedButton() !== ui.Button.OK) return
  const date = res.getResponseText().trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    ui.alert('日期格式不正確，請用 YYYY-MM-DD。')
    return
  }
  toast_(formatResult_(syncDate_(date)))
}

function installDailyTrigger() {
  removeDailyTrigger()
  ScriptApp.newTrigger('dailySync').timeBased().atHour(18).everyDays(1).create()
  toast_('已安裝每日 18:00 自動同步。')
}

function removeDailyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'dailySync' })
    .forEach(function (t) { ScriptApp.deleteTrigger(t) })
}

// =============================================================================
// Supabase 存取
// =============================================================================

function serviceKey_() {
  const key = PropertiesService.getScriptProperties().getProperty(CONFIG.KEY_PROPERTY)
  if (!key) {
    throw new Error(
      '找不到 service_role key。請到「專案設定 → 指令碼屬性」新增一筆：' +
      CONFIG.KEY_PROPERTY,
    )
  }
  return key
}

/** 對 Supabase REST 發 GET；query 為 PostgREST 查詢字串 */
function sbGet_(table, query) {
  const key = serviceKey_()
  const url = CONFIG.SUPABASE_URL + '/rest/v1/' + table + '?' + query
  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      Accept: 'application/json',
    },
  })
  const code = res.getResponseCode()
  const body = res.getContentText()
  if (code < 200 || code >= 300) {
    throw new Error('Supabase ' + table + ' 回應 ' + code + '：' + body.slice(0, 300))
  }
  return JSON.parse(body)
}

/** PostgREST 的 in.(...) 需要把值用逗號串起來 */
function inList_(values) {
  return '(' + values.map(function (v) { return '"' + v + '"' }).join(',') + ')'
}

// =============================================================================
// 主流程
// =============================================================================

/**
 * 同步某一天的所有課堂。
 * 一個「日期 × 班級」寫成 4 欄（兩個節次，各佔 出缺席 + 特殊狀況）。
 */
function syncDate_(dateStr) {
  const result = { date: dateStr, written: [], skipped: [], empty: [], errors: [] }

  const lessons = sbGet_('hc_lessons',
    'lesson_date=eq.' + dateStr + '&select=id,class_id,lesson_date,period,topic&order=period')

  if (lessons.length === 0) {
    result.empty.push('這一天沒有任何課堂紀錄')
    return result
  }

  // 依班級分組
  const byClass = {}
  lessons.forEach(function (l) {
    (byClass[l.class_id] = byClass[l.class_id] || []).push(l)
  })

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)

  Object.keys(byClass).forEach(function (classId) {
    try {
      const cls = sbGet_('hc_classes',
        'id=eq.' + classId + '&select=id,name,group_count,group_capacity')[0]
      if (!cls) throw new Error('找不到班級 ' + classId)

      if (CONFIG.CLASS_FILTER.length > 0 && CONFIG.CLASS_FILTER.indexOf(cls.name) < 0) {
        result.skipped.push(cls.name + '（不在同步清單）')
        return
      }

      const written = syncClassDate_(ss, cls, dateStr, byClass[classId])
      if (written) result.written.push(cls.name)
      else result.skipped.push(cls.name + '（已寫過）')
    } catch (e) {
      result.errors.push(classId + '：' + e.message)
    }
  })

  return result
}

/** 寫入單一班級某一天的課堂；已寫過則回傳 false */
function syncClassDate_(ss, cls, dateStr, dayLessons) {
  const sheet = ensureSheet_(ss, cls.name)
  const blockTitle = blockTitle_(dateStr, cls.name)

  if (findBlockColumn_(sheet, blockTitle) > 0) return false // 已寫過，不重複

  const students = sbGet_('hc_students',
    'class_id=eq.' + cls.id + '&is_active=eq.true' +
    '&select=id,student_no,seat_no,name&order=seat_no.asc')
  if (students.length === 0) throw new Error('班級沒有學生名單')

  const seats = sbGet_('hc_seat_assignments',
    'class_id=eq.' + cls.id + '&select=student_id,group_no,seat_slot')

  const cols = findFixedCols_(sheet)
  if (!cols.seatNo) throw new Error('分頁「' + cls.name + '」找不到「座號」欄，無法對應學生')

  syncRoster_(sheet, students, seats, cols)

  const periods = dayLessons.slice(0, 2) // 一個日期區塊固定兩個節次欄位
  const lessonIds = periods.map(function (l) { return l.id })

  const attendance = lessonIds.length
    ? sbGet_('hc_attendance',
        'lesson_id=in.' + inList_(lessonIds) + '&select=lesson_id,student_id,status')
    : []
  const perf = lessonIds.length
    ? sbGet_('hc_performance_records',
        'lesson_id=in.' + inList_(lessonIds) + '&select=lesson_id,student_id,label,points')
    : []

  writeLessonBlock_(sheet, students, blockTitle, periods, attendance, perf, cols)
  recalcStats_(sheet, cls, students, cols)
  return true
}

// =============================================================================
// 試算表：版面
// =============================================================================

function blockTitle_(dateStr, className) {
  const parts = dateStr.split('-')
  return Number(parts[1]) + '/' + Number(parts[2]) + ' ' + className
}

/** 讀第 1 列（主標題），回傳陣列 */
function headerRow_(sheet) {
  const n = sheet.getLastColumn()
  if (n === 0) return []
  return sheet.getRange(CONFIG.HEADER_ROW, 1, 1, n).getValues()[0]
    .map(function (v) { return String(v == null ? '' : v).trim() })
}

function subHeaderRow_(sheet) {
  const n = sheet.getLastColumn()
  if (n === 0) return []
  return sheet.getRange(CONFIG.SUBHEADER_ROW, 1, 1, n).getValues()[0]
    .map(function (v) { return String(v == null ? '' : v).trim() })
}

/** 找出某個日期區塊的起始欄（1 起算）；沒有回傳 0 */
function findBlockColumn_(sheet, blockTitle) {
  const header = headerRow_(sheet)
  for (let i = 0; i < header.length; i++) {
    if (header[i] === blockTitle) return i + 1
  }
  return 0
}

/**
 * 新的課堂欄要插在「統計區之前」。
 *
 * 現有分頁的統計區並不在最右邊：右側還有作業成績、評語、作業次數、總成績等欄，
 * 直接往最後面加會把版面接錯，因此以統計區起點作為插入位置。
 * 若分頁還沒有統計區，就接在最後一欄之後。
 */
function insertionColumn_(sheet) {
  const header = headerRow_(sheet)
  const sub = subHeaderRow_(sheet)
  for (let i = CONFIG.FIXED_HEADERS.length; i < header.length; i++) {
    if (header[i] === CONFIG.STAT_GROUP_TITLE) return i + 1
    if (header[i].indexOf('作業成績') >= 0 || header[i].indexOf('作業次數') >= 0) return i + 1
    if (CONFIG.STAT_HEADERS.indexOf(sub[i]) >= 0 && sub[i] !== '') return i + 1
  }
  return sheet.getLastColumn() + 1
}

/**
 * 找出固定欄位所在的欄號（1 起算）。
 *
 * 不能假設「座號一定在第 1 欄」：現有分頁中至少有一個在座號前面多一欄「班級」。
 * 因此一律用標題名稱定位。
 */
function findFixedCols_(sheet) {
  const header = headerRow_(sheet)
  const sub = subHeaderRow_(sheet)
  const find = function (name) {
    for (let i = 0; i < Math.max(header.length, sub.length); i++) {
      if (header[i] === name || sub[i] === name) return i + 1
    }
    return 0
  }
  return {
    seatNo: find('座號'),
    name: find('姓名'),
    group: find('組別'),
    slot: find('座位'),
  }
}

/**
 * 找出統計欄各自的欄號，回傳 { 曠課: col, ... }。
 *
 * 不假設 7 欄連續：現有分頁中有一個在「其他」與「成績」之間多一欄「留垃圾」。
 * 逐一以名稱定位，找不到的就不寫，順便保住那些額外欄位。
 */
function findStatCols_(sheet) {
  const header = headerRow_(sheet)
  const sub = subHeaderRow_(sheet)

  // 先框出「上課表現」群組的範圍，避免誤抓到其他同名欄位
  let from = 0
  let to = sub.length
  for (let i = 0; i < header.length; i++) {
    if (header[i] === CONFIG.STAT_GROUP_TITLE) { from = i; break }
  }
  if (from > 0) {
    to = from
    while (to < header.length && header[to] === CONFIG.STAT_GROUP_TITLE) to++
  }

  const cols = {}
  CONFIG.STAT_HEADERS.forEach(function (name) {
    for (let i = from; i < to; i++) {
      if (sub[i] === name) { cols[name] = i + 1; return }
    }
  })
  return cols
}

/** 分頁不存在就照標準版面建立 */
function ensureSheet_(ss, name) {
  let sheet = ss.getSheetByName(name)
  if (sheet) return sheet

  sheet = ss.insertSheet(name)

  // 固定前 4 欄（兩列合併）
  CONFIG.FIXED_HEADERS.forEach(function (h, i) {
    sheet.getRange(CONFIG.HEADER_ROW, i + 1, 2, 1).merge().setValue(h)
  })

  // 統計區
  const statStart = CONFIG.FIXED_HEADERS.length + 1
  sheet.getRange(CONFIG.HEADER_ROW, statStart, 1, CONFIG.STAT_HEADERS.length)
    .merge().setValue(CONFIG.STAT_GROUP_TITLE)
  sheet.getRange(CONFIG.SUBHEADER_ROW, statStart, 1, CONFIG.STAT_HEADERS.length)
    .setValues([CONFIG.STAT_HEADERS])

  sheet.getRange(CONFIG.HEADER_ROW, 1, 2, statStart + CONFIG.STAT_HEADERS.length - 1)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
  sheet.setFrozenRows(CONFIG.SUBHEADER_ROW)
  sheet.setFrozenColumns(2)
  return sheet
}

// =============================================================================
// 試算表：名單與課堂資料
// =============================================================================

function normSeatNo_(v) {
  const s = String(v == null ? '' : v).trim()
  if (s === '') return ''
  const n = Number(s)
  return isNaN(n) ? s : String(n) // 「01」與「1」視為同一人
}

/** 回傳 座號 → 列號 的對照 */
function seatNoRowMap_(sheet, seatNoCol) {
  const col = seatNoCol || 1
  const last = sheet.getLastRow()
  const map = {}
  if (last < CONFIG.FIRST_DATA_ROW) return map
  const n = last - CONFIG.FIRST_DATA_ROW + 1
  const values = sheet.getRange(CONFIG.FIRST_DATA_ROW, col, n, 1).getValues()
  values.forEach(function (r, i) {
    const key = normSeatNo_(r[0])
    if (key !== '') map[key] = CONFIG.FIRST_DATA_ROW + i
  })
  return map
}

/**
 * 補齊名單與組別／座位。
 * 已存在的列只更新組別與座位，不動座號與姓名（老師可能手改過）。
 */
function syncRoster_(sheet, students, seats, cols) {
  const seatOf = {}
  seats.forEach(function (s) { seatOf[s.student_id] = s })

  const rowOf = seatNoRowMap_(sheet, cols.seatNo)
  let nextRow = Math.max(sheet.getLastRow() + 1, CONFIG.FIRST_DATA_ROW)

  students.forEach(function (st) {
    const key = normSeatNo_(st.seat_no)
    const seat = seatOf[st.id]
    const patch = {}
    if (cols.group) patch[cols.group] = seat ? seat.group_no : ''
    if (cols.slot) patch[cols.slot] = seat ? seat.seat_slot : ''

    if (key !== '' && rowOf[key]) {
      patchRow_(sheet, rowOf[key], patch)
      return
    }
    if (cols.seatNo) patch[cols.seatNo] = st.seat_no == null ? '' : st.seat_no
    if (cols.name) patch[cols.name] = st.name
    patchRow_(sheet, nextRow, patch)
    if (key !== '') rowOf[key] = nextRow
    nextRow++
  })
}

/**
 * 只覆蓋指定欄位，其餘原樣寫回。
 * patch 的 key 是欄號（1 起算），value 是要寫入的值。
 * 用一次讀、一次寫完成，避免逐格呼叫 API，也不會誤刪中間不相干的欄位。
 */
function patchRow_(sheet, row, patch) {
  const cols = Object.keys(patch).map(Number).filter(function (c) { return c > 0 })
  if (cols.length === 0) return
  const min = Math.min.apply(null, cols)
  const max = Math.max.apply(null, cols)
  const range = sheet.getRange(row, min, 1, max - min + 1)
  const values = range.getValues()[0]
  cols.forEach(function (c) { values[c - min] = patch[c] })
  range.setValues([values])
}

function perfCellText_(records) {
  return records.map(function (r) {
    const name = CONFIG.PERF_ALIAS[r.label] || r.label
    const pts = Number(r.points)
    return pts > 0 ? name + '(+' + pts + ')' : name
  }).join('、')
}

/** 插入 4 欄並填入該日兩個節次的出缺席與特殊狀況 */
function writeLessonBlock_(sheet, students, blockTitle, periods, attendance, perf, cols) {
  const col = insertionColumn_(sheet)
  sheet.insertColumnsBefore(col, 4)

  // 主標題：日期 班級名，橫跨 4 欄
  sheet.getRange(CONFIG.HEADER_ROW, col, 1, 4).merge()
    .setValue(blockTitle)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')

  // 子標題：第X節 時間 / 特殊狀況 ×2
  const sub = []
  for (let i = 0; i < 2; i++) {
    const l = periods[i]
    sub.push(l ? '第' + l.period + '節 ' + (CONFIG.PERIOD_TIMES[l.period] || '') : '')
    sub.push(l ? '特殊狀況' : '')
  }
  sheet.getRange(CONFIG.SUBHEADER_ROW, col, 1, 4)
    .setValues([sub])
    .setFontWeight('bold')
    .setHorizontalAlignment('center')

  // 索引化
  const attOf = {}
  attendance.forEach(function (a) { attOf[a.lesson_id + '|' + a.student_id] = a })
  const perfOf = {}
  perf.forEach(function (p) {
    const k = p.lesson_id + '|' + p.student_id
    ;(perfOf[k] = perfOf[k] || []).push(p)
  })

  const rowOf = seatNoRowMap_(sheet, cols.seatNo)
  students.forEach(function (st) {
    const row = rowOf[normSeatNo_(st.seat_no)]
    if (!row) return
    const cells = []
    for (let i = 0; i < 2; i++) {
      const l = periods[i]
      if (!l) { cells.push('', ''); continue }
      const k = l.id + '|' + st.id
      const a = attOf[k]
      cells.push(a ? (CONFIG.ATTENDANCE_TEXT[a.status] || '') : '')
      cells.push(perfCellText_(perfOf[k] || []))
    }
    sheet.getRange(row, col, 1, 4).setValues([cells])
  })
}

// =============================================================================
// 統計欄
// =============================================================================

/** 重算某班的統計欄；資料一律從 Supabase 重讀，不做增量累加 */
function recalcStats_(sheet, cls, students, cols) {
  const statCols = findStatCols_(sheet)
  if (Object.keys(statCols).length === 0) return // 找不到統計區就不動它

  const lessons = sbGet_('hc_lessons', 'class_id=eq.' + cls.id + '&select=id')
  const ids = lessons.map(function (l) { return l.id })
  if (ids.length === 0) return

  const attendance = sbGet_('hc_attendance',
    'lesson_id=in.' + inList_(ids) + '&select=student_id,status,points')
  const perf = sbGet_('hc_performance_records',
    'lesson_id=in.' + inList_(ids) + '&select=student_id,label,points')

  const stat = {}
  students.forEach(function (st) {
    stat[st.id] = { 曠課: 0, 遲到: 0, 玩手機: 0, 睡覺: 0, 聊天: 0, 其他: 0, points: 0 }
  })

  attendance.forEach(function (a) {
    const s = stat[a.student_id]
    if (!s) return
    if (a.status === 'absent') s.曠課++
    if (a.status === 'late') s.遲到++
    s.points += Number(a.points || 0)
  })

  perf.forEach(function (p) {
    const s = stat[p.student_id]
    if (!s) return
    const name = CONFIG.PERF_ALIAS[p.label] || p.label
    const bucket = CONFIG.PERF_BUCKET[name]
    if (bucket) s[bucket]++
    else s.其他++
    s.points += Number(p.points || 0)
  })

  const rowOf = seatNoRowMap_(sheet, cols.seatNo)
  students.forEach(function (st) {
    const row = rowOf[normSeatNo_(st.seat_no)]
    if (!row) return
    const s = stat[st.id]
    const value = {
      '曠課': s.曠課, '遲到': s.遲到, '玩手機': s.玩手機, '睡覺': s.睡覺,
      '聊天': s.聊天, '其他': s.其他, '成績': CONFIG.BASE_SCORE + s.points,
    }
    const patch = {}
    Object.keys(statCols).forEach(function (name) { patch[statCols[name]] = value[name] })
    patchRow_(sheet, row, patch)
  })
}

/** 選單用：重算所有班級的統計欄，不新增課堂欄 */
function recalcAllStats() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
  const classes = sbGet_('hc_classes', 'is_active=eq.true&select=id,name')
  const done = []
  classes.forEach(function (cls) {
    if (CONFIG.CLASS_FILTER.length > 0 && CONFIG.CLASS_FILTER.indexOf(cls.name) < 0) return
    const sheet = ss.getSheetByName(cls.name)
    if (!sheet) return
    const students = sbGet_('hc_students',
      'class_id=eq.' + cls.id + '&is_active=eq.true&select=id,student_no,seat_no,name&order=seat_no.asc')
    if (students.length === 0) return
    const cols = findFixedCols_(sheet)
    if (!cols.seatNo) return
    recalcStats_(sheet, cls, students, cols)
    done.push(cls.name)
  })
  toast_(done.length ? '已重算：' + done.join('、') : '沒有可重算的分頁')
}

// =============================================================================
// 工具
// =============================================================================

function todayStr_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')
}

function formatResult_(r) {
  const parts = ['[' + r.date + ']']
  if (r.written.length) parts.push('已寫入：' + r.written.join('、'))
  if (r.skipped.length) parts.push('略過：' + r.skipped.join('、'))
  if (r.empty.length) parts.push(r.empty.join('、'))
  if (r.errors.length) parts.push('錯誤：' + r.errors.join('；'))
  if (parts.length === 1) parts.push('沒有需要同步的資料')
  return parts.join('　')
}

function toast_(msg) {
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(msg, '健護課同步', 12)
  } catch (e) {
    console.log(msg) // 由觸發器執行時沒有前景試算表
  }
}

/** 設定完先跑這個，確認金鑰與連線都正常 */
function testConnection() {
  const classes = sbGet_('hc_classes', 'select=name,academic_year,semester&order=name')
  const names = classes.map(function (c) {
    return c.name + '(' + c.academic_year + '-' + c.semester + ')'
  })
  const msg = '連線正常，讀到 ' + classes.length + ' 個班級：' + names.join('、')
  console.log(msg)
  toast_(msg)
  return msg
}
