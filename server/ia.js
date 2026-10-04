// Insights de comparação de propostas com a API do Claude (com alternativa por regras)
import { calcular, metasSelecionadas, metaPrincipal, nomeItem, TIPOS_META } from '../src/lib/calc.js'
import { fmtBRL, fmtNum, fmtPct } from '../src/lib/format.js'

const MODELO = () => process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5'
const br = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—')

function resumo(v) {
  const c = calcular(v)
  const metas = metasSelecionadas(v)
  const principal = c.metas[metaPrincipal(v)]
  return {
    numero: String(v.numero).padStart(4, '0'),
    versao: v.versao,
    tipo: TIPOS_META[v.tipoMeta || 'faixas'],
    elaboracao: br(v.dataElaboracao),
    proposta: v.proposta ? `${br(v.proposta.data)} (válida até ${br(v.proposta.validade)})` : 'não definida',
    emitida: v.emitidaEm ? `sim, em ${br(String(v.emitidaEm).slice(0, 10))}` : 'não',
    tributos: fmtPct(c.taxPct),
    despAdm: fmtBRL(c.despAdm),
    horas: c.totalHoras,
    custo: c.custoTotal,
    metas: metas.map((m) => ({
      meta: m.label,
      margem: fmtPct(c.metas[m.key].margemPct),
      faturamento: c.metas[m.key].faturamento,
      lucro: c.metas[m.key].lucro,
    })),
    fatorPrincipal: principal.fator,
    itens: c.itens.map((it, i) => ({
      especialidade: nomeItem(it),
      horas: it.horasN,
      horaPagar: it.valorHoraN,
      horaFaturar: principal.linhas[i]?.valorHoraFaturar || 0,
    })),
    observacoes: v.observacoes || '',
  }
}

function textoResumo(r) {
  const linhas = [
    `Proposta nº ${r.numero} (v${r.versao}) – ${r.tipo}`,
    `Elaboração: ${r.elaboracao} | Data/validade da proposta: ${r.proposta} | Emitida: ${r.emitida}`,
    `Tributos: ${r.tributos} | Despesas adm.: ${r.despAdm} | Total de horas/mês: ${fmtNum(r.horas)} | Custo médico/mês: ${fmtBRL(r.custo)}`,
    ...r.metas.map((m) => `  ${m.meta} (margem ${m.margem}): faturamento ${fmtBRL(m.faturamento)} | lucro ${fmtBRL(m.lucro)}`),
    '  Especialidades (horas/mês | hora a pagar | hora a faturar na meta principal):',
    ...r.itens.map((i) => `   - ${i.especialidade}: ${fmtNum(i.horas)} h | ${fmtBRL(i.horaPagar)} | ${fmtBRL(i.horaFaturar)}`),
  ]
  if (r.observacoes) linhas.push(`  Observações da proposta: ${r.observacoes}`)
  return linhas.join('\n')
}

function insightsPorRegras(resumos) {
  const ordenado = [...resumos]
  const a = ordenado[0]
  const b = ordenado[ordenado.length - 1]
  const out = ['## Principais diferenças']
  const fatA = a.metas[0]?.faturamento || 0
  const fatB = b.metas[0]?.faturamento || 0
  const varFat = fatA ? ((fatB - fatA) / fatA) * 100 : 0
  out.push(
    `- Faturamento da meta principal foi de ${fmtBRL(fatA)} (nº ${a.numero}) para ${fmtBRL(fatB)} (nº ${b.numero}), variação de ${fmtPct(varFat)}.`,
  )
  out.push(`- Horas mensais: ${fmtNum(a.horas)} h → ${fmtNum(b.horas)} h. Custo médico: ${fmtBRL(a.custo)} → ${fmtBRL(b.custo)}.`)
  const espA = new Set(a.itens.map((i) => i.especialidade))
  const espB = new Set(b.itens.map((i) => i.especialidade))
  const novas = [...espB].filter((e) => !espA.has(e))
  const saiu = [...espA].filter((e) => !espB.has(e))
  if (novas.length) out.push(`- Especialidades incluídas: ${novas.join(', ')}.`)
  if (saiu.length) out.push(`- Especialidades retiradas: ${saiu.join(', ')}.`)
  out.push('', '## Pontos de atenção')
  for (const r of resumos) {
    const baixa = r.metas.find((m) => m.lucro <= 0)
    if (baixa) out.push(`- Proposta nº ${r.numero}: ${baixa.meta} sem lucro. Revise margem ou valores.`)
    if (r.proposta === 'não definida') out.push(`- Proposta nº ${r.numero} ainda sem data e validade definidas.`)
  }
  if (out[out.length - 1] === '## Pontos de atenção') out.push('- Nenhum ponto crítico encontrado pelas regras automáticas.')
  out.push('', '## Observação', '- Insights gerados por regras automáticas. Configure ANTHROPIC_API_KEY no servidor para usar a IA.')
  return out.join('\n')
}

export async function gerarInsights({ cliente, viabilidades, observacoes }) {
  const resumos = viabilidades.map(resumo)
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return { fonte: 'regras', texto: insightsPorRegras(resumos) }

  const contexto = [
    `Cliente: ${cliente?.nome} – setor: ${cliente?.setor}`,
    observacoes?.length
      ? `Observações recentes registradas sobre o cliente:\n${observacoes.map((o) => `- ${br(o.criado_em?.toISOString?.() || o.criado_em)}: ${o.texto}`).join('\n')}`
      : 'Sem observações registradas sobre o cliente.',
    '',
    ...resumos.map(textoResumo),
  ].join('\n')

  const prompt = `Você é analista comercial da Arpen, empresa que faz gestão de serviços médicos (pronto atendimento, plantões e especialidades) para hospitais e operadoras como a Unimed.
Compare as propostas abaixo, todas do mesmo cliente. Faturamento = (custo médico + despesas administrativas) ÷ (1 − tributos − margem).

${contexto}

Escreva em português do Brasil, direto e objetivo, usando somente os dados fornecidos (não invente números). Use exatamente estas seções em Markdown simples:
## Principais diferenças
## Pontos de atenção
## Recomendações para negociação
Use listas com "- ". No máximo 5 itens por seção. Cite números das propostas (nº) e valores em R$ quando ajudar.`

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODELO(),
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!r.ok) {
    const detalhe = await r.text().catch(() => '')
    console.error('Erro na API do Claude', r.status, detalhe.slice(0, 500))
    return {
      fonte: 'regras',
      aviso: `A IA não respondeu (erro ${r.status}). Mostrando análise por regras.`,
      texto: insightsPorRegras(resumos),
    }
  }
  const data = await r.json()
  const textoIA = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim()
  return { fonte: 'ia', modelo: MODELO(), texto: textoIA || insightsPorRegras(resumos) }
}
