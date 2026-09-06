import type { StudentProfile } from '../lib/types'

/**
 * 教師預覽用的假學生。
 *
 * 刻意不使用真實學生資料：預覽只是要看版面與互動，
 * 借用真人的姓名與數值沒有必要，也會讓人誤以為畫面上的數字是他填的。
 * student_id / class_id 用 preview 字樣，萬一哪天被誤傳到後端也不會對到任何一列。
 */
export const PREVIEW_STUDENT: StudentProfile = {
  student_id: 'preview',
  class_id: 'preview',
  class_name: '309',
  academic_year: 115,
  semester: 1,
  student_no: '310000',
  seat_no: 1,
  name: '王小明（範例）',
  email: 'spreview@hlhs.hlc.edu.tw',
}
