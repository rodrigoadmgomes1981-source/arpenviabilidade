import { useMemo, useState } from 'react'
import { Card, Empty } from './ui'
import { calcular, metaPrincipal } from '../lib/calc'
import { fmtBRL, fmtNum, fmtPct } from '../lib/format'
import { hojeISO, somaDias, fmtISO, dataElaboracao, diasEntre } from '../lib/proposta'

const COR = { elab: '#3d6bc4', emit: '#2a9d7c' } // validadas (contraste e daltonismo) para fundo claro

const pad = (n) => String(n).padStart(2, '0')
const isoDe = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const dataLocal = (ts) => (ts ? isoDe(new Date(ts)) : null)
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function periodo(preset) {
  const hoje = hojeISO()
  const [y, m] = hoje.split('-').map(Number)
  switch (preset) {
    case 'mes':
      return { de: `${y}-${pad(m)}-01`, ate: hoje }
    case '30':
      return { de: somaDias(hoje, -29), ate: hoje }
    case 'tri': {
      const ini = Math.floor((m - 1) / 3) * 3 + 1
      return { de: `${y}-${pad(ini)}-01`, ate: hoje }
    }
    case '12m':
      return { de: `${y - 1}-${pad(m)}-01`, ate: hoje }
    default:
      return { de: `${y}-01-01`, ate: hoje }
  }
}

const PRESETS = [
  ['mes', 'Este mês'],
  ['30', 'Últimos 30 dias'],
  ['tri', 'Este trimestre'],
  ['ano', 'Este ano'],
  ['12m', 'Últimos 12 meses'],
]

/** Agrupa por semana (períodos curtos) ou por mês */
function buckets(de, ate) {
  const dias = diasEntre(de, ate)
  const out = []
  if (dias <= 62) {
    // semanas começando na segunda-feira
    const d0 = new Date(...de.split('-').map((v, i) => (i === 1 ? v - 1 : +v)))
    d0.setDate(d0.getDate() - ((d0.getDay() + 6) % 7))
    let ini = isoDe(d0)
    while (ini <= ate) {
      const fim = somaDias(ini, 6)
      out.push({ ini, fim, label: `${ini.slice(8)}/${ini.slice(5, 7)}` })
      ini = somaDias(ini, 7)
    }
  } else {
    let [y, m] = de.split('-').map(Number)
    const [ye, me] = ate.split('-').map(Number)
    while (y < ye || (y === ye && m <= me)) {
      const ini = `${y}-${pad(m)}-01`
      const fimD = new Date(y, m, 0)
      out.push({ ini, fim: isoDe(fimD), label: `${MESES[m - 1]}/${String(y).slice(2)}` })
      m++
      if (m > 12) {
        m = 1
        y++
      }
    }
  }
  return out
}

export default function DashboardPage({ db, onAbrirCliente }) {
  const [preset, setPreset] = useState('ano')
  const [{ de, ate }, setPer] = useState(() => periodo('ano'))
  const [usuario, setUsuario] = useState('')
  const [hover, setHover] = useState(null)

  const clientes = useMemo(() => Object.fromEntries(db.clientes.map((c) => [c.id, c])), [db.clientes])
  const usuariosNomes = useMemo(
    () => [...new Set(db.viabilidades.map((v) => v.criadoPorNome).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [db.viabilidades],
  )

  const dados = useMemo(() => {
    const dentro = (iso) => iso && iso >= de && iso <= ate
    const base = db.viabilidades
      .filter((v) => !usuario || v.criadoPorNome === usuario)
      .map((v) => {
        const c = calcular(v)
        return {
          v,
          elab: dataElaboracao(v),
          emit: dataLocal(v.emitidaEm),
          valor: c.metas[metaPrincipal(v)].faturamento,
        }
      })
    const elaboradas = base.filter((x) => dentro(x.elab))
    const emitidas = base.filter((x) => dentro(x.emit))
    const hoje = hojeISO()
    const vencendo = base.filter(
      (x) => x.v.emitidaEm && x.v.proposta?.validade && x.v.proposta.validade >= hoje && diasEntre(hoje, x.v.proposta.validade) <= 7,
    )
    const bs = buckets(de, ate).map((b) => ({
      ...b,
      elab: elaboradas.filter((x) => x.elab >= b.ini && x.elab <= b.fim).length,
      emit: emitidas.filter((x) => x.emit >= b.ini && x.emit <= b.fim).length,
    }))
    const porUsuario = {}
    for (const x of elaboradas) {
      const k = x.v.criadoPorNome || '—'
      porUsuario[k] ??= { nome: k, elab: 0, emit: 0, valor: 0 }
      porUsuario[k].elab++
    }
    for (const x of emitidas) {
      const k = x.v.emitidaPorNome || '—'
      porUsuario[k] ??= { nome: k, elab: 0, emit: 0, valor: 0 }
      porUsuario[k].emit++
      porUsuario[k].valor += x.valor
    }
    const recentes = [...new Map([...elaboradas, ...emitidas].map((x) => [x.v.id, x])).values()].sort((a, b) =>
      (b.emit || b.elab).localeCompare(a.emit || a.elab),
    )
    return {
      elaboradas: elaboradas.length,
      emitidas: emitidas.length,
      conversao: elaboradas.length ? (elaboradas.filter((x) => x.v.emitidaEm).length / elaboradas.length) * 100 : 0,
      valorEmitido: emitidas.reduce((s, x) => s + x.valor, 0),
      vencendo,
      buckets: bs,
      porUsuario: Object.values(porUsuario).sort((a, b) => b.elab + b.emit - (a.elab + a.emit)),
      recentes: recentes.slice(0, 12),
    }
  }, [db.viabilidades, de, ate, usuario])

  const max = Math.max(1, ...dados.buckets.flatMap((b) => [b.elab, b.emit]))
  const ticks = [...new Set([0, Math.ceil(max / 2), max])]

  return (
    <div className="dash">
      <div className="dash-filters">
        <div className="filter-chips">
          {PRESETS.map(([k, l]) => (
            <button
              key={k}
              className={`chip ${preset === k ? 'on' : ''}`}
              onClick={() => {
                setPreset(k)
                setPer(periodo(k))
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <label className="inline-field">
          <span>De</span>
          <input
            id="dash-de"
            type="date"
            value={de}
            max={ate}
            onChange={(e) => e.target.value && (setPreset(''), setPer((p) => ({ ...p, de: e.target.value })))}
          />
        </label>
        <label className="inline-field">
          <span>Até</span>
          <input
            id="dash-ate"
            type="date"
            value={ate}
            min={de}
            onChange={(e) => e.target.value && (setPreset(''), setPer((p) => ({ ...p, ate: e.target.value })))}
          />
        </label>
        <label className="inline-field">
          <span>Usuário</span>
          <select id="dash-usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)}>
            <option value="">Todos</option>
            {usuariosNomes.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="kpis">
        <div className="kpi">
          <span>Propostas elaboradas</span>
          <strong>{fmtNum(dados.elaboradas)}</strong>
          <em>pela data de elaboração</em>
        </div>
        <div className="kpi">
          <span>Propostas emitidas</span>
          <strong>{fmtNum(dados.emitidas)}</strong>
          <em>pela data de emissão</em>
        </div>
        <div className="kpi">
          <span>Taxa de emissão</span>
          <strong>{fmtPct(dados.conversao)}</strong>
          <em>das elaboradas no período já foram emitidas</em>
        </div>
        <div className="kpi">
          <span>Valor mensal emitido</span>
          <strong>{fmtBRL(dados.valorEmitido)}</strong>
          <em>soma da meta principal das emitidas</em>
        </div>
      </div>

      <div className="dash-grid">
        <Card title="Elaboradas × emitidas" subtitle={`${fmtISO(de)} a ${fmtISO(ate)} · por ${diasEntre(de, ate) <= 62 ? 'semana' : 'mês'}`}>
          <div className="legend">
            <span><i style={{ background: COR.elab }} /> Elaboradas</span>
            <span><i style={{ background: COR.emit }} /> Emitidas</span>
          </div>
          <div className="chart-wrap" onMouseLeave={() => setHover(null)}>
            <div className="chart">
              <div className="chart-grid">
                {ticks
                  .slice()
                  .reverse()
                  .map((t) => (
                    <div key={t} className="gl" style={{ bottom: `${(t / max) * 100}%` }}>
                      <span>{t}</span>
                    </div>
                  ))}
              </div>
              <div className="chart-bars">
                {dados.buckets.map((b, i) => (
                  <div
                    key={b.ini}
                    className={`grp ${hover === i ? 'hov' : ''}`}
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    tabIndex={0}
                    aria-label={`${b.label}: ${b.elab} elaboradas, ${b.emit} emitidas`}
                  >
                    <div className="bars">
                      <div className="bar" style={{ height: `${(b.elab / max) * 100}%`, background: COR.elab }} />
                      <div className="bar" style={{ height: `${(b.emit / max) * 100}%`, background: COR.emit }} />
                    </div>
                    <span className="xl">{b.label}</span>
                    {hover === i && (
                      <div className={`tip ${i > dados.buckets.length / 2 ? 'left' : ''}`}>
                        <strong>
                          {fmtISO(b.ini)} a {fmtISO(b.fim > ate ? ate : b.fim)}
                        </strong>
                        <span><i style={{ background: COR.elab }} /> Elaboradas: {b.elab}</span>
                        <span><i style={{ background: COR.emit }} /> Emitidas: {b.emit}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card title="Por usuário" subtitle="Elaboradas por quem criou · emitidas por quem emitiu">
          {dados.porUsuario.length === 0 ? (
            <Empty title="Sem movimento no período" />
          ) : (
            <div className="table-wrap">
              <table className="tbl compact">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th className="num">Elaboradas</th>
                    <th className="num">Emitidas</th>
                    <th className="num">Valor emitido</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.porUsuario.map((u) => (
                    <tr key={u.nome}>
                      <td>{u.nome}</td>
                      <td className="num">{u.elab}</td>
                      <td className="num">{u.emit}</td>
                      <td className="num">{fmtBRL(u.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {dados.vencendo.length > 0 && (
            <div className="alert soft">
              <strong>{dados.vencendo.length} proposta(s) emitida(s) vencem nos próximos 7 dias:</strong>{' '}
              {dados.vencendo
                .map((x) => `nº ${String(x.v.numero).padStart(4, '0')} (${clientes[x.v.clienteId]?.nome || '—'}, ${fmtISO(x.v.proposta.validade)})`)
                .join('; ')}
            </div>
          )}
        </Card>
      </div>

      <Card title="Propostas do período" subtitle="Elaboradas ou emitidas entre as datas escolhidas (mais recentes primeiro)">
        {dados.recentes.length === 0 ? (
          <Empty title="Nenhuma proposta no período" />
        ) : (
          <div className="table-wrap">
            <table className="tbl compact">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Cliente</th>
                  <th>Elaboração</th>
                  <th>Emissão</th>
                  <th>Situação</th>
                  <th className="num">Valor mensal (meta principal)</th>
                </tr>
              </thead>
              <tbody>
                {dados.recentes.map((x) => (
                  <tr key={x.v.id}>
                    <td>{String(x.v.numero).padStart(4, '0')}</td>
                    <td>
                      <button className="as-link" onClick={() => onAbrirCliente(x.v.clienteId)}>
                        {clientes[x.v.clienteId]?.nome || '—'}
                      </button>
                    </td>
                    <td>{fmtISO(x.elab)}</td>
                    <td>{x.emit ? fmtISO(x.emit) : '—'}</td>
                    <td>
                      <span className={`pill ${x.v.emitidaEm ? 'ok' : 'warn'}`}>{x.v.emitidaEm ? 'Emitida' : 'Elaborada'}</span>
                    </td>
                    <td className="num">{fmtBRL(x.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
