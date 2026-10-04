import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Empty } from './ui'
import { calcular, metaPrincipal, TIPOS_META } from '../lib/calc'
import { fmtBRL, fmtData } from '../lib/format'
import { fmtISO, dataElaboracao } from '../lib/proposta'
import CompararModal from './CompararModal'

const FILTROS = [
  { key: 'todas', label: 'Tudo' },
  { key: 'observacao', label: 'Observações' },
  { key: 'sistema', label: 'Sistema' },
]

export default function ClienteDetalhe({ cliente, db, acoes, notify, isAdmin, onVoltar, onEditarCliente, onIniciar, onEditar, onProposta }) {
  const [interacoes, setInteracoes] = useState(null)
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [filtro, setFiltro] = useState('todas')
  const [sel, setSel] = useState([])
  const [comparar, setComparar] = useState(false)

  const carregar = useCallback(async () => {
    try {
      setInteracoes(await acoes.interacoes(cliente.id))
    } catch (e) {
      notify(e.message, 'erro')
      setInteracoes([])
    }
  }, [acoes, cliente.id, notify])

  // recarrega o histórico quando as viabilidades do cliente mudam (eventos do sistema)
  const assinatura = db.viabilidades
    .filter((v) => v.clienteId === cliente.id)
    .map((v) => `${v.id}:${v.versao}:${v.emitidaEm}`)
    .join('|')
  useEffect(() => {
    carregar()
  }, [carregar, assinatura])

  const viabs = useMemo(
    () => db.viabilidades.filter((v) => v.clienteId === cliente.id).sort((a, b) => b.numero - a.numero),
    [db.viabilidades, cliente.id],
  )

  const salvarObs = async () => {
    const t = texto.trim()
    if (!t) return
    setSalvando(true)
    try {
      const nova = await acoes.addObservacao(cliente.id, t)
      setInteracoes((l) => [nova, ...(l || [])])
      setTexto('')
      notify('Observação salva no histórico')
    } catch (e) {
      notify(e.message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 6 ? s : [...s, id]))
  const lista = (interacoes || []).filter((i) => filtro === 'todas' || i.tipo === filtro)

  return (
    <div className="cliente-det">
      <div className="det-head">
        <button className="btn ghost sm" onClick={onVoltar}>
          ← Clientes
        </button>
        <div className="det-title">
          <h1>{cliente.nome}</h1>
          <p className="muted">
            {cliente.setor}
            {cliente.contato && ` · ${cliente.contato}`}
            {cliente.telefone && ` · ${cliente.telefone}`}
          </p>
        </div>
        <div className="card-actions">
          {isAdmin && (
            <button className="btn ghost sm" onClick={() => onEditarCliente(cliente)}>
              Editar dados
            </button>
          )}
          <button className="btn primary sm" onClick={() => onIniciar(cliente.id)}>
            + Nova viabilidade
          </button>
        </div>
      </div>

      <div className="det-grid">
        <Card
          title="Propostas do cliente"
          subtitle="Marque duas ou mais para comparar."
          actions={
            <button className="btn success sm" disabled={sel.length < 2} onClick={() => setComparar(true)}>
              Comparar propostas{sel.length ? ` (${sel.length})` : ''}
            </button>
          }
        >
          {viabs.length === 0 ? (
            <Empty title="Nenhuma viabilidade para este cliente">Use “+ Nova viabilidade” para começar.</Empty>
          ) : (
            <ul className="prop-list">
              {viabs.map((v) => {
                const c = calcular(v)
                const m = c.metas[metaPrincipal(v)]
                return (
                  <li key={v.id} className={`prop-item ${sel.includes(v.id) ? 'on' : ''}`}>
                    <label className="prop-check">
                      <input type="checkbox" checked={sel.includes(v.id)} onChange={() => toggle(v.id)} aria-label={`Selecionar proposta ${v.numero}`} />
                    </label>
                    <div className="prop-main">
                      <div className="prop-top">
                        <strong>Nº {String(v.numero).padStart(4, '0')}</strong>
                        <span className="pill">v{v.versao}</span>
                        <span className={`pill ${v.emitidaEm ? 'ok' : 'warn'}`}>{v.emitidaEm ? 'Emitida' : 'Elaborada'}</span>
                        <span className="tiny muted">{TIPOS_META[v.tipoMeta || 'faixas']}</span>
                      </div>
                      <span className="tiny muted">
                        Elaborada em {fmtISO(dataElaboracao(v))}
                        {v.proposta && ` · proposta de ${fmtISO(v.proposta.data)}, válida até ${fmtISO(v.proposta.validade)}`}
                      </span>
                    </div>
                    <div className="prop-val">
                      <span className="tiny muted">{m.label}</span>
                      <strong>{fmtBRL(m.faturamento)}</strong>
                    </div>
                    <div className="prop-actions">
                      <button className="btn ghost sm" onClick={() => onEditar(v)}>
                        Editar
                      </button>
                      <button className="btn ghost sm" onClick={() => onProposta(v)}>
                        Proposta
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card title="Observações e histórico de interações" subtitle="Tudo o que acontece com este cliente, com autor e data.">
          <div className="obs-box">
            <textarea
              id="obs-texto"
              rows={3}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) salvarObs()
              }}
              placeholder="Escreva uma observação sobre o cliente (reunião, ligação, pedido, negociação)…"
            />
            <div className="obs-foot">
              <span className="tiny muted">Ctrl + Enter para salvar</span>
              <button className="btn primary sm" disabled={!texto.trim() || salvando} onClick={salvarObs}>
                {salvando ? 'Salvando…' : 'Salvar observação'}
              </button>
            </div>
          </div>
          <div className="filter-chips">
            {FILTROS.map((f) => (
              <button key={f.key} className={`chip ${filtro === f.key ? 'on' : ''}`} onClick={() => setFiltro(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
          {interacoes === null ? (
            <p className="muted">Carregando histórico…</p>
          ) : lista.length === 0 ? (
            <Empty title="Nada registrado ainda" />
          ) : (
            <ol className="timeline">
              {lista.map((i) => (
                <li key={i.id} className={`tl-item tl-${i.tipo}`}>
                  <span className="tl-dot" aria-hidden="true" />
                  <div className="tl-body">
                    <div className="tl-meta">
                      <strong>{i.usuarioNome || 'Sistema'}</strong>
                      <span className="tiny muted">{fmtData(i.criadoEm)}</span>
                      <span className={`pill ${i.tipo === 'observacao' ? 'info' : ''}`}>
                        {i.tipo === 'observacao' ? 'Observação' : 'Sistema'}
                      </span>
                    </div>
                    <p>{i.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {comparar && (
        <CompararModal
          cliente={cliente}
          viabs={viabs.filter((v) => sel.includes(v.id)).sort((a, b) => a.numero - b.numero)}
          acoes={acoes}
          onClose={() => setComparar(false)}
        />
      )}
    </div>
  )
}
