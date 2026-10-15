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

/** Data de elaboração da proposta (informada no início da viabilidade) */
export function dataElaboracao(viab) {
  if (viab?.dataElaboracao) return viab.dataElaboracao
  if (viab?.createdAt) {
    const d = new Date(viab.createdAt)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  return hojeISO()
}

/** Dados da proposta salvos na viabilidade, com padrão: hoje + 30 dias */
export function dadosProposta(viab, diasPadrao = VALIDADE_PADRAO) {
  const elab = dataElaboracao(viab)
  const hoje = hojeISO()
  // data de envio padrão: hoje, nunca antes da elaboração
  const data = viab?.proposta?.data || (hoje < elab ? elab : hoje)
  const validade = viab?.proposta?.validade || somaDias(data, Number(diasPadrao) || VALIDADE_PADRAO)
  return { data, validade, dias: diasEntre(data, validade) }
}

export function situacaoProposta(viab) {
  if (!viab?.proposta?.validade) return null
  return diasEntre(hojeISO(), viab.proposta.validade) < 0 ? 'vencida' : 'vigente'
}

/** Item "Despesas Operacionais – Tecnologia" da proposta (só texto). Padrão: incluído, com o texto das Configurações. */
export function dadosTecnologia(viab, textoPadrao = '') {
  const t = viab?.propostaExtra?.tecnologia
  if (t) return { incluir: Boolean(t.incluir), texto: t.texto ?? '' }
  return { incluir: true, texto: textoPadrao }
}

/** Divide o texto em linhas; linhas iniciadas por * viram tópicos */
export function linhasTexto(texto) {
  return String(texto || '')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim())
    .map((l) => (/^\s*[*•-]\s*/.test(l) ? { topico: true, t: l.replace(/^\s*[*•-]\s*/, '') } : { topico: false, t: l.trim() }))
}
