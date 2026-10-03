// Data e validade da proposta (datas em AAAA-MM-DD, sem fuso)
const pad = (n) => String(n).padStart(2, '0')
export const hojeISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const toDate = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}
const toISO = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`

export function somaDias(iso, dias) {
  const dt = toDate(iso)
  dt.setDate(dt.getDate() + Number(dias || 0))
  return toISO(dt)
}
export function diasEntre(isoIni, isoFim) {
  return Math.round((toDate(isoFim) - toDate(isoIni)) / 86400000)
}
export const fmtISO = (iso) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export const VALIDADE_PADRAO = 30

/** Dados da proposta salvos na viabilidade, com padrão: hoje + 30 dias */
export function dadosProposta(viab) {
  const data = viab?.proposta?.data || hojeISO()
  const validade = viab?.proposta?.validade || somaDias(data, VALIDADE_PADRAO)
  return { data, validade, dias: diasEntre(data, validade) }
}

export function situacaoProposta(viab) {
  if (!viab?.proposta?.validade) return null
  return diasEntre(hojeISO(), viab.proposta.validade) < 0 ? 'vencida' : 'vigente'
}
