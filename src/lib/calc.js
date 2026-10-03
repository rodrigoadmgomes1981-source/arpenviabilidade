import { parseNum } from './format'

export const METAS = [
  { key: 'minima', label: 'Meta Mínima' },
  { key: 'mediana', label: 'Meta Mediana' },
  { key: 'maxima', label: 'Meta Máxima' },
]

export const IMPOSTOS = [
  { key: 'iss', label: 'ISS' },
  { key: 'pis', label: 'PIS' },
  { key: 'cofins', label: 'COFINS' },
  { key: 'csll', label: 'CSLL' },
  { key: 'ir', label: 'IR' },
]

export function novaViabilidade(clienteId = '') {
  return {
    clienteId,
    impostos: { iss: '4', pis: '0,65', cofins: '3', csll: '1,08', ir: '2' },
    despAdm: '',
    margem: { minima: '', variacao: '1,2', modo: 'pp' },
    itens: [],
    metas: ['minima'],
    observacoes: '',
  }
}

/** Faixas de margem (em %) a partir da mínima e da variação 1,2 */
export function faixasMargem(margem) {
  const m = parseNum(margem.minima)
  const v = parseNum(margem.variacao || 1.2)
  if (margem.modo === 'mult') {
    return { minima: m, mediana: m * v, maxima: m * v * v }
  }
  // pontos percentuais
  return { minima: m, mediana: m + v, maxima: m + 2 * v }
}

export function totalImpostosPct(impostos) {
  return IMPOSTOS.reduce((s, i) => s + parseNum(impostos[i.key]), 0)
}

/**
 * Cálculo de viabilidade.
 * Faturamento = (Custo + Despesas adm.) / (1 − impostos − margem)
 * O valor da hora a faturar de cada especialidade = valor hora a pagar × (Faturamento / Custo).
 * Assim: Faturamento − Impostos − Custo − Desp. Adm. = Margem × Faturamento.
 */
export function calcular(viab) {
  const itens = (viab.itens || []).map((it) => {
    const horas = parseNum(it.horas)
    const valorHora = parseNum(it.valorHora)
    return { ...it, horasN: horas, valorHoraN: valorHora, custo: horas * valorHora }
  })
  const totalHoras = itens.reduce((s, i) => s + i.horasN, 0)
  const custoTotal = itens.reduce((s, i) => s + i.custo, 0)
  const despAdm = parseNum(viab.despAdm)
  const taxPct = totalImpostosPct(viab.impostos)
  const faixas = faixasMargem(viab.margem)

  const metas = {}
  for (const meta of METAS) {
    const margemPct = faixas[meta.key]
    const divisor = 1 - taxPct / 100 - margemPct / 100
    const valido = divisor > 0 && custoTotal > 0
    const faturamento = valido ? (custoTotal + despAdm) / divisor : 0
    const fator = valido ? faturamento / custoTotal : 0
    const impostosDet = IMPOSTOS.map((i) => ({
      ...i,
      aliquota: parseNum(viab.impostos[i.key]),
      valor: (faturamento * parseNum(viab.impostos[i.key])) / 100,
    }))
    const impostos = impostosDet.reduce((s, i) => s + i.valor, 0)
    const lucro = faturamento - impostos - custoTotal - despAdm
    metas[meta.key] = {
      ...meta,
      margemPct,
      valido,
      erro: divisor <= 0 ? 'Impostos + margem ≥ 100%' : custoTotal <= 0 ? 'Sem custos lançados' : null,
      faturamento,
      fator,
      impostos,
      impostosDet,
      lucro,
      taxaAdmLucro: despAdm + lucro,
      margemReal: faturamento ? (lucro / faturamento) * 100 : 0,
      linhas: itens.map((it) => ({
        id: it.id,
        valorHoraFaturar: it.valorHoraN * fator,
        faturamento: it.valorHoraN * fator * it.horasN,
      })),
    }
  }

  return { itens, totalHoras, custoTotal, despAdm, taxPct, faixas, metas }
}

export function metasSelecionadas(viab) {
  return METAS.filter((m) => (viab.metas || ['minima']).includes(m.key))
}

export function nomeItem(it) {
  const q = it.qualificacao === 'RQE' ? 'com RQE' : it.qualificacao === 'POS' ? 'com Pós' : ''
  return q ? `${it.especialidade} (${q})` : it.especialidade
}
