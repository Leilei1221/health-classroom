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

  /**
   * 課室紀錄試算表（115成績表）。
   *
   * 可用指令碼屬性 SPREADSHEET_ID 覆寫，覆寫優先。
   * 這裡寫死過一次舊的 114 檔案 ID，導致每次重貼程式碼都把設定改回舊檔案，
   * 同步照常回報成功、資料卻進了去年的試算表。換學年度時改這裡，
   * 或直接設指令碼屬性，就不會再被重貼覆蓋。
   */
  SPREADSHEET_ID: '1-PG1fcySM_YAANO2JdJIdvDDUYrmwi3BuHFUHzjXkHQ',

  /** service_role key 的 Script Property 名稱 */
  KEY_PROPERTY: 'SUPABASE_SERVICE_KEY',

  /** 試算表 ID 的 Script Property 名稱；有設就蓋過上面的 SPREADSHEET_ID */
  SPREADSHEET_ID_PROPERTY: 'SPREADSHEET_ID',

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
    .addItem('重算上課表現統計（期末用）', 'recalcAllStats')
    .addSeparator()
    .addItem('安裝自動同步（週一～週五 12:00、16:00）', 'installSyncTriggers')
    .addItem('移除自動同步', 'removeSyncTriggers')
    .addSeparator()
    .addItem('診斷同步問題…', 'debugSync')
    .addToUi()
}

/**
 * 由定時觸發器呼叫。觸發器本身只裝在週一～週五，
 * 這裡再擋一次，避免手動補裝的觸發器在週末跑。
 */
function dailySync() {
  const day = new Date().getDay()
  if (day === 0 || day === 6) {
    console.log('週末不同步。')
    return
  }
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

/** 同步時間：中午一次、下午一次 */
const SYNC_HOURS = [12, 16]

function installSyncTriggers() {
  removeSyncTriggers()

  const days = [
    ScriptApp.WeekDay.MONDAY,
    ScriptApp.WeekDay.TUESDAY,
    ScriptApp.WeekDay.WEDNESDAY,
    ScriptApp.WeekDay.THURSDAY,
    ScriptApp.WeekDay.FRIDAY,
  ]

  let n = 0
  days.forEach(function (day) {
    SYNC_HOURS.forEach(function (hour) {
      // 週觸發器：一個時段一個觸發器，週末就不會有觸發器可跑
      ScriptApp.newTrigger('dailySync')
        .timeBased()
        .onWeekDay(day)
        .atHour(hour)
        .nearMinute(0)
        .create()
      n += 1
    })
  })

  toast_('已安裝自動同步：週一～週五 12:00、16:00（共 ' + n + ' 個觸發器）。')
}

function removeSyncTriggers() {
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

/** 實際要寫入的試算表 ID：指令碼屬性優先，其次才是 CONFIG */
function spreadsheetId_() {
  const override = PropertiesService.getScriptProperties()
    .getProperty(CONFIG.SPREADSHEET_ID_PROPERTY)
  return (override && override.trim()) || CONFIG.SPREADSHEET_ID
}

/** 對 Supabase REST 發 GET；query 為 PostgREST 查詢字串 */
function sbGet_(table, query) {
  const key = serviceKey_()
  const url = CONFIG.SUPABASE_URL + '/rest/v1/' + table + '?' + query

  // UrlFetchApp 對不合法網址只會丟「下列引數無效」，不會說是哪一個查詢，
  // 因此自己先檢查並把網址寫進訊息裡
  if (!/^https:\/\/[^\s"'<>]+$/.test(url)) {
    throw new Error('查詢 ' + table + ' 的網址不合法：' + url)
  }

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

/**
 * PostgREST 的 in.(...) 需要把值用逗號串起來。
 * 一律做 encodeURIComponent：值裡若出現引號、括號、空白等字元，
 * 未編碼的網址會被 UrlFetchApp 判定不合法而整批失敗。
 */
function inList_(values) {
  return '(' + values.map(function (v) {
    return encodeURIComponent(String(v))
  }).join(',') + ')'
}

// =============================================================================
// 主流程
// =============================================================================

/**
 * 同步某一天的所有課堂。
 * 一個「日期 × 班級」寫成 4 欄（兩個節次，各佔 出缺席 + 特殊狀況）。
 */
function syncDate_(dateStr) {
  const result = { date: dateStr, written: [], updated: [], skipped: [], empty: [], errors: [] }

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

  const ss = SpreadsheetApp.openById(spreadsheetId_())

  Object.keys(byClass).forEach(function (classId) {
    let label = classId
    try {
      const cls = sbGet_('hc_classes',
        'id=eq.' + classId + '&select=id,name,group_count,group_capacity')[0]
      if (!cls) throw new Error('找不到班級 ' + classId)
      label = cls.name

      if (CONFIG.CLASS_FILTER.length > 0 && CONFIG.CLASS_FILTER.indexOf(cls.name) < 0) {
        result.skipped.push(cls.name + '（不在同步清單）')
        return
      }

      const outcome = syncClassDate_(ss, cls, dateStr, byClass[classId])
      if (outcome === 'updated') result.updated.push(cls.name)
      else result.written.push(cls.name)
    } catch (e) {
      // 帶上班級名稱與堆疊最上面一行，否則 toast 只看得到一串 UUID，
      // 無從判斷是哪一班、卡在哪一步
      const where = (e.stack || '').split('\n')[1] || ''
      result.errors.push(label + '：' + e.message + (where ? '　@' + where.trim() : ''))
    }
  })

  return result
}

/** 寫入單一班級某一天的課堂；回傳 'created'（新建區塊）或 'updated'（重寫既有區塊） */
function syncClassDate_(ss, cls, dateStr, dayLessons) {
  const sheet = ensureSheet_(ss, cls.name)
  const blockTitle = blockTitle_(dateStr, cls.name)

  // 當天的區塊已經在就重寫它，不是跳過。
  // 一天會同步兩次（12:00、16:00），若沿用「已寫過就跳出」的做法，
  // 中午之後才點的名與加扣分永遠寫不進去，統計欄也不會重算。
  const existingCol = findBlockColumn_(sheet, blockTitle)

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

  writeLessonBlock_(sheet, students, blockTitle, periods, attendance, perf, cols, existingCol)

  // 不在這裡重算統計：「上課表現」是期末結算才需要的欄位，
  // 平時同步只寫當天的出缺席與特殊狀況。
  // 期末請用選單的「重算上課表現統計（期末用）」。
  return existingCol > 0 ? 'updated' : 'created'
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
    // 合併的群組標題只有最左邊那一格有值，右邊都是空字串，
    // 因此往右吃到「下一個非空的主標題」為止，那就是下一個群組的起點。
    // 先前寫成 while (header[to] === STAT_GROUP_TITLE)，第二格就停，
    // 結果只框到「曠課」一欄，其餘六欄的統計從來沒被寫進去。
    to = from + 1
    while (to < header.length && header[to] === '') to++
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

  // 刻意不建立「上課表現」統計區：那是期末才要的東西，
  // 平時每次同步都讓它出現在畫面上只是干擾。
  // 需要時由選單的「重算上課表現統計（期末用）」建立並填值。
  sheet.getRange(CONFIG.HEADER_ROW, 1, 2, CONFIG.FIXED_HEADERS.length)
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
function writeLessonBlock_(sheet, students, blockTitle, periods, attendance, perf, cols, existingCol) {
  let col = existingCol
  if (!col) {
    col = insertionColumn_(sheet)
    sheet.insertColumnsBefore(col, 4)

    // 主標題：日期 班級名，橫跨 4 欄。
    // 只在新建時處理：重寫既有區塊時標題內容相同，
    // 而且對已合併的範圍再呼叫一次 merge() 沒有意義。
    sheet.getRange(CONFIG.HEADER_ROW, col, 1, 4).merge()
      .setValue(blockTitle)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
  }

  // 子標題：第X節 時間 / 特殊狀況 ×2。
  // 重寫時也要更新：當天稍晚才建立第二節課的話，中午那次同步是空的
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
/**
 * 統計區該從第幾欄開始。
 *
 * 不能只用 getLastColumn() + 1：日期區塊固定佔 4 欄，但那天只有一節課時
 * 後兩欄是空的，getLastColumn() 讀不到，統計區就會蓋掉區塊的後半。
 * 因此以「最後一個有值的主標題」往右推 4 欄為準。
 */
function statBlockStart_(sheet) {
  const header = headerRow_(sheet)
  let last = 0
  for (let i = 0; i < header.length; i++) if (header[i] !== '') last = i + 1

  const afterBlocks = last > CONFIG.FIXED_HEADERS.length
    ? last + 4
    : CONFIG.FIXED_HEADERS.length + 1
  return Math.max(sheet.getLastColumn() + 1, afterBlocks)
}

/**
 * 建立「上課表現」統計區；已經有就原樣回傳欄號。
 * 接在現有內容的右邊 —— 課堂區塊會插在統計區之前，
 * 因此統計區永遠是最右邊的那一組。
 */
function ensureStatBlock_(sheet) {
  const existing = findStatCols_(sheet)
  if (Object.keys(existing).length > 0) return existing

  const col = statBlockStart_(sheet)
  sheet.getRange(CONFIG.HEADER_ROW, col, 1, CONFIG.STAT_HEADERS.length)
    .merge().setValue(CONFIG.STAT_GROUP_TITLE)
  sheet.getRange(CONFIG.SUBHEADER_ROW, col, 1, CONFIG.STAT_HEADERS.length)
    .setValues([CONFIG.STAT_HEADERS])
  sheet.getRange(CONFIG.HEADER_ROW, col, 2, CONFIG.STAT_HEADERS.length)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
  return findStatCols_(sheet)
}

function recalcStats_(sheet, cls, students, cols) {
  const statCols = ensureStatBlock_(sheet)
  if (Object.keys(statCols).length === 0) return

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

/**
 * 選單用：重算所有班級的「上課表現」統計欄，不新增課堂欄。
 * 統計區不存在時會一併建立，因此期末跑這一次就好。
 */
function recalcAllStats() {
  const ss = SpreadsheetApp.openById(spreadsheetId_())
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
  if (r.written.length) parts.push('新增：' + r.written.join('、'))
  if (r.updated.length) parts.push('更新：' + r.updated.join('、'))
  if (r.skipped.length) parts.push('略過：' + r.skipped.join('、'))
  if (r.empty.length) parts.push(r.empty.join('、'))
  if (r.errors.length) parts.push('錯誤：\n' + r.errors.map(function (e) { return '・' + e }).join('\n'))
  if (parts.length === 1) parts.push('沒有需要同步的資料')
  return parts.join('\n')
}

/**
 * 回報訊息。
 *
 * 一律先寫進執行記錄（觸發器執行時沒有前景試算表，那是唯一看得到的地方）。
 * 成功用 toast，不打斷手邊的事；但 toast 有固定高度又會自動消失，
 * 長的錯誤訊息會被截掉看不到後半，因此有錯誤時改用 alert：
 * 內容完整、可以圈選複製，也不會自己關掉。
 */
function toast_(msg) {
  console.log(msg)

  const isError = msg.indexOf('錯誤：') >= 0 || msg.indexOf('失敗') >= 0
  try {
    if (isError) {
      SpreadsheetApp.getUi().alert('健護課同步：有錯誤', msg, SpreadsheetApp.getUi().ButtonSet.OK)
    } else {
      SpreadsheetApp.getActiveSpreadsheet().toast(msg, '健護課同步', 12)
    }
  } catch (e) {
    // 由觸發器執行時沒有前景試算表，訊息已寫進執行記錄
  }
}

/**
 * 出問題時跑這個：把同步的每一步拆開各自 try/catch，
 * 印出實際發出的查詢與每一步的結果，找出到底是哪一步壞掉。
 * 執行後看「執行記錄」（View → Logs），把內容整份複製給開發者。
 */
function debugSync() {
  const ui = SpreadsheetApp.getUi()
  const res = ui.prompt('診斷同步', '要診斷哪一天？（YYYY-MM-DD）', ui.ButtonSet.OK_CANCEL)
  if (res.getSelectedButton() !== ui.Button.OK) return
  const dateStr = res.getResponseText().trim()

  const log = []
  const step = function (name, fn) {
    try {
      const out = fn()
      log.push('OK   ' + name + ' → ' + out)
      return out
    } catch (e) {
      log.push('FAIL ' + name + ' → ' + e.message)
      throw e
    }
  }

  try {
    step('0 金鑰', function () { return serviceKey_() ? '有' : '無' })

    const lessons = step('1 hc_lessons', function () {
      const r = sbGet_('hc_lessons',
        'lesson_date=eq.' + dateStr + '&select=id,class_id,lesson_date,period&order=period')
      return r.length + ' 筆'
    }) && sbGet_('hc_lessons',
      'lesson_date=eq.' + dateStr + '&select=id,class_id,lesson_date,period&order=period')

    const byClass = {}
    lessons.forEach(function (l) { (byClass[l.class_id] = byClass[l.class_id] || []).push(l) })

    const ss = step('2 開啟試算表', function () {
      const x = SpreadsheetApp.openById(spreadsheetId_())
      // 一併印出檔名與 ID：寫進錯的試算表時，同步一樣會回報成功
      return x.getName() + '（' + spreadsheetId_() + '）'
    })

    Object.keys(byClass).forEach(function (classId) {
      log.push('--- 班級 ' + classId + ' ---')
      const cls = step('3 hc_classes', function () {
        const r = sbGet_('hc_classes', 'id=eq.' + classId + '&select=id,name')
        return r.length ? r[0].name : '找不到'
      }) && sbGet_('hc_classes', 'id=eq.' + classId + '&select=id,name')[0]
      if (!cls) return

      const sheet = step('4 取得分頁 ' + cls.name, function () {
        const sh = ss.getSheetByName(cls.name)
        return sh ? '有，欄數 ' + sh.getLastColumn() + '，列數 ' + sh.getLastRow() : '不存在（會新建）'
      }) && ss.getSheetByName(cls.name)
      if (!sheet) return

      step('5 findFixedCols_', function () { return JSON.stringify(findFixedCols_(sheet)) })
      step('6 insertionColumn_', function () { return String(insertionColumn_(sheet)) })
      step('7 findStatCols_', function () { return JSON.stringify(findStatCols_(sheet)) })
      step('8 區塊是否已存在', function () {
        return String(findBlockColumn_(sheet, blockTitle_(dateStr, cls.name)))
      })
      step('9 hc_students', function () {
        return sbGet_('hc_students',
          'class_id=eq.' + cls.id + '&is_active=eq.true&select=id,student_no,seat_no,name&order=seat_no.asc'
        ).length + ' 位'
      })
      step('10 hc_seat_assignments', function () {
        return sbGet_('hc_seat_assignments',
          'class_id=eq.' + cls.id + '&select=student_id,group_no,seat_slot').length + ' 筆'
      })
      const ids = byClass[classId].slice(0, 2).map(function (l) { return l.id })
      step('11 hc_attendance（in 查詢）', function () {
        return sbGet_('hc_attendance',
          'lesson_id=in.' + inList_(ids) + '&select=lesson_id,student_id,status').length + ' 筆'
      })
      step('12 hc_performance_records（in 查詢）', function () {
        return sbGet_('hc_performance_records',
          'lesson_id=in.' + inList_(ids) + '&select=lesson_id,student_id,label,points').length + ' 筆'
      })
    })
  } catch (e) {
    log.push('（在上面那一步中斷）')
  }

  const text = log.join('\n')
  console.log(text)
  ui.alert('診斷結果（也在執行記錄裡）', text, ui.ButtonSet.OK)
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
