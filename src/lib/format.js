const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const pct = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const fmtBRL = (v) => brl.format(Number.isFinite(v) ? v : 0)
export const fmtNum = (v) => num.format(Number.isFinite(v) ? v : 0)
export const fmtPct = (v) => `${pct.format(Number.isFinite(v) ? v : 0)}%`
export const fmtData = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
export const fmtDataCurta = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—')

// Aceita "1.234,56", "1234.56", "12,5"
export function parseNum(v) {
  if (typeof v === 'number') return v
  if (v === null || v === undefined) return 0
  let s = String(v).trim().replace(/[R$\s%]/g, '')
  if (!s) return 0
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

export function maskTelefone(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)
