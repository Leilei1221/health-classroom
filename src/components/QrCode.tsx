import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/**
 * 把選位連結畫成 QR code。
 * 投影在螢幕上讓全班掃，因此預設尺寸偏大、容錯等級用 M。
 */
export default function QrCode({ value, size = 240 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => { if (!cancelled) { setDataUrl(url); setError('') } })
      .catch(() => { if (!cancelled) setError('QR code 產生失敗') })
    return () => { cancelled = true }
  }, [value, size])

  if (error) return <p className="text-sm text-red-700">{error}</p>
  if (!dataUrl) return <div className="h-[240px] w-[240px] animate-pulse rounded-lg bg-slate-100" />

  return (
    <img
      src={dataUrl}
      alt="選位連結 QR code"
      width={size}
      height={size}
      className="rounded-lg border border-slate-200"
    />
  )
}
