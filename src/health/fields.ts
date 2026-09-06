/**
 * 登記頁的欄位定義。
 * key 直接對應 hc_health_measurement 的欄位名，range 取自規格書第 4 節。
 */
export interface Field {
  key: string
  label: string
  sub?: string
  unit: string
  min?: number
  max?: number
  decimal?: boolean
  optional?: boolean
}

export interface Section {
  title: string
  hint: string
  fields: Field[]
}

export const SECTIONS: Section[] = [
  {
    title: '體脂機讀數',
    hint: '照著機器上顯示的數字抄下來就好，不用自己算',
    fields: [
      { key: 'machine_no', label: '體脂機編號', unit: '', optional: true },
      { key: 'height_cm', label: '身高', unit: 'cm', min: 130, max: 210, decimal: true },
      { key: 'weight_kg', label: '體重', unit: 'kg', min: 30, max: 150, decimal: true },
      { key: 'body_fat_pct', label: '體脂率', unit: '%', min: 3, max: 50, decimal: true },
      { key: 'visceral_fat', label: '內臟脂肪', unit: '級', min: 1, max: 30, decimal: true },
      { key: 'bmr_kcal', label: '基礎代謝率', unit: 'kcal', min: 800, max: 3000 },
      { key: 'body_age', label: '身體年齡', unit: '歲', min: 10, max: 80 },
    ],
  },
  {
    title: '圍度',
    hint: '腰圍量肚臍高度，臀圍量最寬處',
    fields: [
      { key: 'waist_cm', label: '腰圍', unit: 'cm', min: 50, max: 150, decimal: true },
      { key: 'hip_cm', label: '臀圍', unit: 'cm', min: 60, max: 160, decimal: true },
    ],
  },
  {
    title: '血壓機讀數',
    hint: '坐著休息 5 分鐘後再量，手臂與心臟同高',
    fields: [
      { key: 'sbp', label: '收縮壓', sub: '上面那個數字', unit: 'mmHg', min: 70, max: 200 },
      { key: 'dbp', label: '舒張壓', sub: '下面那個數字', unit: 'mmHg', min: 40, max: 140 },
      { key: 'pulse', label: '脈搏', unit: '次/分', min: 35, max: 160 },
      { key: 'spo2', label: '血氧濃度', unit: '%', min: 80, max: 100 },
    ],
  },
  {
    title: '各部位測量結果',
    hint: '體脂機的第二張報表，八個數字都要抄',
    fields: [
      { key: 'subcut_whole', label: '皮下脂肪率・全身', unit: '%', min: 1, max: 50, decimal: true },
      { key: 'subcut_trunk', label: '皮下脂肪率・軀幹', unit: '%', min: 1, max: 50, decimal: true },
      { key: 'subcut_arms', label: '皮下脂肪率・雙手', unit: '%', min: 1, max: 50, decimal: true },
      { key: 'subcut_legs', label: '皮下脂肪率・雙腳', unit: '%', min: 1, max: 50, decimal: true },
      { key: 'muscle_whole', label: '骨骼肌率・全身', unit: '%', min: 10, max: 70, decimal: true },
      { key: 'muscle_trunk', label: '骨骼肌率・軀幹', unit: '%', min: 10, max: 70, decimal: true },
      { key: 'muscle_arms', label: '骨骼肌率・雙手', unit: '%', min: 10, max: 70, decimal: true },
      { key: 'muscle_legs', label: '骨骼肌率・雙腳', unit: '%', min: 10, max: 70, decimal: true },
    ],
  },
]

/** 必填欄位（規格書：20 個欄位全部必填，體脂機編號除外） */
export const REQUIRED = SECTIONS.flatMap((s) => s.fields)
  .filter((f) => !f.optional)
  .map((f) => f.key)

export const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields)
