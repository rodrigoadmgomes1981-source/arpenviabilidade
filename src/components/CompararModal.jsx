import { useState } from 'react'
import { Modal, Markdown } from './ui'
import { calcular, metaPrincipal, metasSelecionadas, nomeItem, TIPOS_META } from '../lib/calc'
import { fmtBRL, fmtNum, fmtPct } from '../lib/format'
import { fmtISO, dataElaboracao } from '../lib/proposta'

export default function CompararModal({ cliente, viabs, acoes, onClose }) {
  const [ia, setIa] = useState(null)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState('')
  const calcs = viabs.map((v) => ({ v, c: calcular(v), principal: metaPrincipal(v) }))
  const base = calcs[0]

  const linhas = [
    ['Versão', ({ v }) => `v${v.versao}`],
    ['Tipo', ({ v }) => TIPOS_META[v.tipoMeta || 'faixas']],
    ['Elaboração', ({ v }) => fmtISO(dataElaboracao(v))],
    ['Data da proposta', ({ v }) => (v.proposta ? fmtISO(v.proposta.data) : '—')],
    ['Válida até', ({ v }) => (v.proposta ? fmtISO(v.proposta.validade) : '—')],
    ['Situação', ({ v }) => (v.emitidaEm ? 'Emitida' : 'Elaborada')],
    ['Tributos', ({ c }) => fmtPct(c.taxPct)],
    ['Despesas adm.', ({ c }) => fmtBRL(c.despAdm), ({ c }) => c.despAdm],
    ['Horas/mês', ({ c }) => fmtNum(c.totalHoras), ({ c }) => c.totalHoras],
    ['Especialidades', ({ c }) => String(c.itens.length)],
    ['Custo médico', ({ c }) => fmtBRL(c.custoTotal), ({ c }) => c.custoTotal],
  ]
  const metasLinhas = [
    ['Margem (meta principal)', ({ c, principal }) => fmtPct(c.metas[principal].margemPct)],
    ['Faturamento (meta principal)', ({ c, principal }) => fmtBRL(c.metas[principal].faturamento), ({ c, principal }) => c.metas[principal].faturamento],
    ['Lucro (meta principal)', ({ c, principal }) => fmtBRL(c.metas[principal].lucro), ({ c, principal }) => c.metas[principal].lucro],
    [
      'Outras metas',
      ({ v, c }) =>
        metasSelecionadas(v)
          .filter((m) => m.key !== 'minima' && m.key !== 'unica')
          .map((m) => `${m.label.replace('Meta ', '')}: ${fmtBRL(c.metas[m.key].faturamento)}`)
          .join(' · ') || '—',
    ],
  ]

  // matriz de especialidades
  const nomes = [...new Set(calcs.flatMap(({ c }) => c.itens.map(nomeItem)))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const celula = ({ c }, nome) => {
    const its = c.itens.filter((i) => nomeItem(i) === nome)
    if (!its.length) return null
    return { horas: its.reduce((s, i) => s + i.horasN, 0), valor: its[0].valorHoraN }
  }

  const variacao = (fn, x) => {
    if (!fn || x === base) return null
    const a = fn(base)
    const b = fn(x)
    if (!a || a === b) return null
    const p = ((b - a) / a) * 100
    return <span className={`delta ${p > 0 ? 'up' : 'down'}`}>{p > 0 ? '▲' : '▼'} {fmtPct(Math.abs(p))}</span>
  }

  const gerar = async () => {
    setGerando(true)
    setErro('')
    try {
      setIa(await acoes.comparar(viabs.map((v) => v.id)))
    } catch (e) {
      setErro(e.message)
    } finally {
      setGerando(false)
    }
  }

  return (
    <Modal title={`Comparar propostas – ${cliente.nome}`} onClose={onClose} wide>
      <div className="table-wrap">
        <table className="tbl cmp">
          <thead>
            <tr>
              <th />
              {calcs.map(({ v }) => (
                <th key={v.id} className="num">
                  Nº {String(v.numero).padStart(4, '0')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...linhas, ...metasLinhas].map(([label, fn, numFn]) => (
              <tr key={label}>
                <td className="strong">{label}</td>
                {calcs.map((x) => (
                  <td key={x.v.id} className="num">
                    {fn(x)} {variacao(numFn, x)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="cmp-sep">
              <td colSpan={calcs.length + 1}>Especialidades (horas/mês × valor hora a pagar)</td>
            </tr>
            {nomes.map((n) => (
              <tr key={n}>
                <td>{n}</td>
                {calcs.map((x) => {
                  const cel = celula(x, n)
                  const b = celula(base, n)
                  const mudou = x !== base && (!b || !cel || b.horas !== cel.horas || b.valor !== cel.valor)
                  return (
                    <td key={x.v.id} className={`num ${mudou ? 'diff' : ''}`}>
                      {cel ? `${fmtNum(cel.horas)} h × ${fmtBRL(cel.valor)}` : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tiny muted">Variações (▲▼) e destaques em relação à primeira proposta da esquerda.</p>

      <div className="ia-box">
        <div className="ia-head">
          <div>
            <h3>Insights</h3>
            <p className="tiny muted">A IA analisa as propostas selecionadas e as observações recentes do cliente.</p>
          </div>
          <button className="btn primary" disabled={gerando} onClick={gerar}>
            {gerando ? 'Analisando…' : ia ? 'Gerar de novo' : 'Gerar insights com IA'}
          </button>
        </div>
        {erro && <div className="alert">{erro}</div>}
        {gerando && <p className="muted">Analisando as propostas. Isso leva alguns segundos…</p>}
        {ia && !gerando && (
          <>
            {ia.aviso && <div className="alert">{ia.aviso}</div>}
            <Markdown texto={ia.texto} />
            <p className="tiny muted">
              {ia.fonte === 'ia' ? `Gerado por IA (${ia.modelo}). Confira os números antes de usar.` : 'Gerado por regras automáticas.'}
            </p>
          </>
        )}
      </div>
    </Modal>
  )
}
