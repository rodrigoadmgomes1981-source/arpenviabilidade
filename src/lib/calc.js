import { parseNum } from './format.js'
import { hojeISO } from './proposta.js'

/** Metas do modelo com três faixas */
export const METAS = [
  { key: 'minima', label: 'Meta Mínima' },
  { key: 'mediana', label: 'Meta Mediana' },
  { key: 'maxima', label: 'Meta Máxima' },
]
/** Meta do modelo de meta única */
export const META_UNICA = { key: 'unica', label: 'Meta Única' }

export const TIPOS_META = {
  faixas: 'Metas mínima, mediana e máxima',
  unica: 'Meta única',
}

export const IMPOSTOS = [
  { key: 'iss', label: 'ISS' },
  { key: 'pis', label: 'PIS' },
  { key: 'cofins', label: 'COFINS' },
  { key: 'csll', label: 'CSLL' },
  { key: 'ir', label: 'IR' },
]

/** Item opcional da proposta: Despesas Operacionais – Tecnologia (só texto, sem valor) */
export const TITULO_TECNOLOGIA = 'Despesas Operacionais – Tecnologia'
export const TEXTO_TECNOLOGIA = `Plataformas:
*Gestão de Performance Médica em Tempo Real
*Educadoc + Academy:
27 Especialistas 24/7 + Educação Médica Continuada`

export const CONFIG_PADRAO = {
  impostos: { iss: '4', pis: '0,65', cofins: '3', csll: '1,08', ir: '2' },
  variacao: '1,2',
  modo: 'pp',
  validadeDias: 30,
  textoTecnologia: TEXTO_TECNOLOGIA,
}

export function novaViabilidade(clienteId = '', config = CONFIG_PADRAO) {
  const c = { ...CONFIG_PADRAO, ...(config || {}) }
  return {
    clienteId,
    tipoMeta: 'faixas',
    dataElaboracao: hojeISO(),
    impostos: { ...CONFIG_PADRAO.impostos, ...(c.impostos || {}) },
    despAdm: '',
    margem: { minima: '', variacao: c.variacao, modo: c.modo },
    itens: [],
    metas: ['minima'],
    observacoes: '',
  }
}

export const isUnica = (viab) => viab?.tipoMeta === 'unica'

/** Metas que existem para o tipo da viabilidade */
export function metasDoTipo(viab) {
  return isUnica(viab) ? [META_UNICA] : METAS
}

/** Faixas de margem (em %) a partir da mínima e da variação 1,2 */
export function faixasMargem(margem) {
  const m = parseNum(margem.minima)
  const v = parseNum(margem.variacao || 1.2)
  if (margem.modo === 'mult') {
    return { minima: m, mediana: m * v, maxima: m * v * v, unica: m }
  }
  // pontos percentuais
  return { minima: m, mediana: m + v, maxima: m + 2 * v, unica: m }
}

export function totalImpostosPct(impostos) {
  return IMPOSTOS.reduce((s, i) => s + parseNum(impostos?.[i.key]), 0)
}

/**
 * Cálculo de viabilidade.
 * Faturamento = (Custo + Despesas adm.) / (1 − impostos − margem)
 * O valor da hora a faturar de cada especialidade = valor hora a pagar × (Faturamento / Custo).
 * Faixas encadeadas (mediana sobre a mínima, máxima sobre a mediana): custo médico × (1 + % da faixa)
 * e taxa de administração + o mesmo valor em R$ que o custo subiu; Faturamento = (Custo + Taxa adm.) / (1 − tributos).
 * Lucro = Faturamento − Impostos − Custo da meta − Desp. Adm.
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
  const faixas = faixasMargem(viab.margem || {})

  // 1) Faturamento de cada meta sobre o custo informado (valor hora a pagar base)
  const base = {}
  for (const meta of [...METAS, META_UNICA]) {
    const margemPct = faixas[meta.key]
    const divisor = 1 - taxPct / 100 - margemPct / 100
    const valido = divisor > 0 && custoTotal > 0
    const faturamento = valido ? (custoTotal + despAdm) / divisor : 0
    base[meta.key] = { margemPct, divisor, valido, faturamento }
  }

  // 2) A meta mínima (ou única) é a base: paga o valor informado e cobra a margem informada.
  //    Faixas encadeadas: a mediana sobe sobre a mínima e a máxima sobe sobre a mediana.
  //    Em cada faixa: custo médico (hora a pagar) × (1 + % da faixa) e a taxa de administração
  //    sobe o mesmo valor em R$ que o custo médico subiu. Tributos incidem sobre o novo faturamento.
  const metas = {}
  const tribFrac = taxPct / 100
  const montar = (meta, { fatorPagamento, custo, taxaAdmLucro, valido, erro }) => {
    const faturamento = valido ? (custo + taxaAdmLucro) / (1 - tribFrac) : 0
    const fator = valido && custoTotal ? faturamento / custoTotal : 0
    const impostosDet = IMPOSTOS.map((i) => ({
      ...i,
      aliquota: parseNum(viab.impostos?.[i.key]),
      valor: (faturamento * parseNum(viab.impostos?.[i.key])) / 100,
    }))
    const impostos = impostosDet.reduce((s, i) => s + i.valor, 0)
    const lucro = taxaAdmLucro - despAdm
    return {
      ...meta,
      margemPct: faixas[meta.key],
      acrescimoPct: meta.key === 'minima' || meta.key === 'unica' ? 0 : faixas[meta.key],
      valido,
      erro,
      faturamento,
      fator,
      fatorPagamento,
      custo,
      impostos,
      impostosDet,
      lucro,
      taxaAdmLucro,
      margemReal: faturamento ? (lucro / faturamento) * 100 : 0,
      linhas: itens.map((it) => ({
        id: it.id,
        valorHoraPagar: it.valorHoraN * fatorPagamento,
        custo: it.custo * fatorPagamento,
        valorHoraFaturar: it.valorHoraN * fator,
        faturamento: it.valorHoraN * fator * it.horasN,
      })),
    }
  }
  const erroDe = (b) => (b.divisor <= 0 ? 'Impostos + margem ≥ 100%' : custoTotal <= 0 ? 'Sem custos lançados' : null)
  const baseMeta = (k) => {
    const b = base[k]
    const taxa = b.valido ? b.faturamento * (1 - tribFrac) - custoTotal : 0
    return { fatorPagamento: 1, custo: custoTotal, taxaAdmLucro: taxa, valido: b.valido, erro: erroDe(b) }
  }
  const sobe = (ant, pct) => {
    const fatorPagamento = ant.fatorPagamento * (1 + pct / 100)
    const custo = custoTotal * fatorPagamento
    return {
      fatorPagamento,
      custo,
      taxaAdmLucro: ant.taxaAdmLucro + (custo - ant.custo),
      valido: ant.valido,
      erro: ant.erro,
    }
  }
  const pMin = baseMeta('minima')
  const pMed = sobe(pMin, faixas.mediana)
  const pMax = sobe(pMed, faixas.maxima)
  metas.minima = montar(METAS[0], pMin)
  metas.mediana = montar(METAS[1], pMed)
  metas.maxima = montar(METAS[2], pMax)
  metas.unica = montar(META_UNICA, baseMeta('unica'))

  return { itens, totalHoras, custoTotal, despAdm, taxPct, faixas, metas }
}

/** Metas ativas da viabilidade (as escolhidas, ou a meta única) */
export function metasSelecionadas(viab) {
  if (isUnica(viab)) return [META_UNICA]
  return METAS.filter((m) => (viab.metas || ['minima']).includes(m.key))
}

/** Meta principal (a mínima ou a única) — usada em resumos e no dashboard */
export const metaPrincipal = (viab) => (isUnica(viab) ? 'unica' : 'minima')

export function nomeItem(it) {
  const q = it.qualificacao === 'RQE' ? 'com RQE' : it.qualificacao === 'POS' ? 'com Pós' : ''
  return q ? `${it.especialidade} (${q})` : it.especialidade
}
