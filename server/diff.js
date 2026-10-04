// Gera a lista de alterações entre duas versões de uma viabilidade (para o log)
import { IMPOSTOS, TIPOS_META, nomeItem } from '../src/lib/calc.js'
import { parseNum } from '../src/lib/format.js'

const META_NOMES = { minima: 'Mínima', mediana: 'Mediana', maxima: 'Máxima' }

export function diffViabilidade(antes, depois) {
  const m = []
  const add = (campo, de, para, tipo = 'texto') => m.push({ campo, de, para, tipo })

  if ((antes.tipoMeta || 'faixas') !== depois.tipoMeta)
    add('Tipo de viabilidade', TIPOS_META[antes.tipoMeta || 'faixas'], TIPOS_META[depois.tipoMeta])
  if (antes.dataElaboracao !== depois.dataElaboracao)
    add('Data de elaboração', antes.dataElaboracao, depois.dataElaboracao, 'data')

  for (const i of IMPOSTOS) {
    const a = parseNum(antes.impostos?.[i.key])
    const b = parseNum(depois.impostos?.[i.key])
    if (a !== b) add(`Alíquota ${i.label}`, a, b, 'pct')
  }
  if (parseNum(antes.despAdm) !== parseNum(depois.despAdm))
    add('Despesas administrativas', parseNum(antes.despAdm), parseNum(depois.despAdm), 'brl')

  const ma = antes.margem || {}
  const mb = depois.margem || {}
  if (parseNum(ma.minima) !== parseNum(mb.minima))
    add(depois.tipoMeta === 'unica' ? 'Margem' : 'Margem mínima', parseNum(ma.minima), parseNum(mb.minima), 'pct')
  if (depois.tipoMeta !== 'unica') {
    if (parseNum(ma.variacao) !== parseNum(mb.variacao))
      add('Variação entre faixas', parseNum(ma.variacao), parseNum(mb.variacao), 'num')
    if ((ma.modo || 'pp') !== (mb.modo || 'pp'))
      add('Tipo de variação', ma.modo === 'mult' ? 'Multiplicador' : 'Pontos percentuais', mb.modo === 'mult' ? 'Multiplicador' : 'Pontos percentuais')
    const metasA = (antes.metas || []).map((k) => META_NOMES[k]).join(', ')
    const metasB = (depois.metas || []).map((k) => META_NOMES[k]).join(', ')
    if (metasA !== metasB) add('Metas incluídas', metasA, metasB)
  }

  // Especialidades: por id da linha
  const ia = new Map((antes.itens || []).map((i) => [i.id, i]))
  const ib = new Map((depois.itens || []).map((i) => [i.id, i]))
  for (const [id, it] of ib) {
    const old = ia.get(id)
    if (!old) {
      add('Especialidade incluída', '', `${nomeItem(it)} – ${parseNum(it.horas)} h × R$ ${parseNum(it.valorHora)}`)
      continue
    }
    if (old.especialidade !== it.especialidade || old.qualificacao !== it.qualificacao)
      add('Especialidade', nomeItem(old), nomeItem(it))
    if (parseNum(old.horas) !== parseNum(it.horas)) add(`Horas – ${nomeItem(it)}`, parseNum(old.horas), parseNum(it.horas), 'num')
    if (parseNum(old.valorHora) !== parseNum(it.valorHora))
      add(`Valor hora – ${nomeItem(it)}`, parseNum(old.valorHora), parseNum(it.valorHora), 'brl')
  }
  for (const [id, it] of ia) if (!ib.has(id)) add('Especialidade removida', nomeItem(it), '')

  if ((antes.observacoes || '') !== (depois.observacoes || ''))
    add('Observações da proposta', antes.observacoes || '', depois.observacoes || '')
  return m
}
