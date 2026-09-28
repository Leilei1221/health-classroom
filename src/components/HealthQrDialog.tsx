import { useState } from 'react'
import { Button } from './ui'
import QrCode from './QrCode'

/**
 * 學生入口的 QR code。
 *
 * 網址對全校學生都是同一個（`#/health`），身分由 Google 登入決定，
 * 不像選位那樣有班級碼，所以這一張印一次可以一直用。
 */
export default function HealthQrDialog({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}${window.location.pathname}#/health`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="學生入口 QR code"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-6"
      onClick={onClose}
    >
      <div
        className="max-w-lg space-y-4 rounded-2xl bg-white p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">學生入口</h3>
        <p className="text-sm text-slate-600">
          請同學用手機掃描，並以學校的 Google 帳號登入
        </p>
        <div className="flex justify-center">
          <QrCode value={url} size={280} />
        </div>
        <p className="break-all font-mono text-xs text-slate-500">{url}</p>
        <div className="flex justify-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard?.writeText(url)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
          >
            {copied ? '已複製 ✓' : '複製連結'}
          </Button>
          <Button variant="secondary" onClick={onClose}>關閉</Button>
        </div>
      </div>
    </div>
  )
}
