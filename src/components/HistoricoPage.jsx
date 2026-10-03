import { useMemo, useState } from 'react'
import { Card, Confirm, Empty } from './ui'
import { calcular, metasSelecionadas, nomeItem } from '../lib/calc'
import { removeViabilidade } from '../lib/storage'
import { fmtBRL, fmtData, fmtNum } from '../lib/format'

export default function HistoricoPage({
  db,
  setDb,
  notify,
  filtroCliente,
  setFiltroCliente,
  onEditar,
  onProposta,
  onNova,
}) {
  const [excluir, setExcluir] = useState(null)
  const [aberto, setAberto] = useState(null)
  const [baixando, setBaixando] = useState(null)

  const clientesById = useMemo(() => Object.fromEntries(db.clientes.map((c) => [c.id, c])), [db.clientes])
  const lista = useMemo(
    () =>
      db.viabilidades
        .filter((v) => !filtroCliente || v.clienteId === filtroCliente)
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
    [db.viabilidades, filtroCliente],
  )
  const clienteSel = clientesById[filtroCliente]

  const baixar = async (v) => {
    setBaixando(v.id)
    try {
      await (await import('../lib/excel')).exportarViabilidadeExcel(v, clientesById[v.clienteId])
      notify('Excel gerado')
    } catch (e) {
      console.error(e)
      notify('Não foi possível gerar o Excel', 'erro')
    } finally {
      setBaixando(null)
    }
  }

  return (
    <Card
      title={clienteSel ? `Histórico – ${clienteSel.nome}` : 'Histórico de viabilidades'}
      subtitle={clienteSel ? clienteSel.setor : 'Todas as viabilidades salvas e confirmadas.'}
      actions={
        <>
          <select value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)}>
            <option value="">Todos os clientes</option>
            {[...db.clientes]
              .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
          </select>
          <button className="btn primary sm" onClick={() => onNova(filtroCliente || null)}>
            + Nova viabilidade
          </button>
        </>
      }
    >
      {lista.length === 0 ? (
        <Empty title="Nenhuma viabilidade salva">Conclua uma viabilidade e clique em “Salvar e confirmar”.</Empty>
      ) : (
        <div className="hist-list">
          {lista.map((v) => {
            const c = clientesById[v.clienteId]
            const calc = calcular(v)
            const metas = metasSelecionadas(v)
            const open = aberto === v.id
            return (
              <article key={v.id} className="hist-item">
                <div className="hist-top">
                  <div className="hist-id">
                    <span className="hist-num">Nº {String(v.numero).padStart(4, '0')}</span>
                    <span className="pill">v{v.versao}</span>
                    <span className="pill ok">Confirmada</span>
                  </div>
                  <div className="hist-main">
                    <strong>{c?.nome || 'Cliente removido'}</strong>
                    <span className="muted">
                      {c?.setor} · {v.itens.length} especialidade(s) · {fmtNum(calc.totalHoras)} h · atualizado{' '}
                      {fmtData(v.updatedAt)}
                    </span>
                  </div>
                  <div className="hist-vals">
                    <div>
                      <span className="tiny muted">Custo</span>
                      <strong>{fmtBRL(calc.custoTotal)}</strong>
                    </div>
                    {metas.map((m) => (
                      <div key={m.key}>
                        <span className={`tiny dot dot-${m.key}`}>{m.label}</span>
                        <strong>{fmtBRL(calc.metas[m.key].faturamento)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="hist-actions">
                  <button className="btn ghost sm" onClick={() => setAberto(open ? null : v.id)}>
                    {open ? 'Ocultar detalhes' : 'Detalhes'}
                  </button>
                  <button className="btn ghost sm" onClick={() => onEditar(v)}>
                    Editar
                  </button>
                  <button className="btn ghost sm" disabled={baixando === v.id} onClick={() => baixar(v)}>
                    {baixando === v.id ? 'Gerando…' : 'Download Excel'}
                  </button>
                  <button className="btn primary sm" onClick={() => onProposta(v)}>
                    Emitir proposta
                  </button>
                  <button className="btn ghost sm danger-text" onClick={() => setExcluir(v)}>
                    Excluir
                  </button>
                </div>
                {open && (
                  <div className="table-wrap">
                    <table className="tbl compact">
                      <thead>
                        <tr>
                          <th>Especialidade</th>
                          <th className="num">Horas</th>
                          <th className="num">Hora a pagar</th>
                          <th className="num">Custo</th>
                          {metas.map((m) => (
                            <th key={m.key} className="num">
                              Hora faturar – {m.label.replace('Meta ', '')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {calc.itens.map((it, i) => (
                          <tr key={it.id}>
                            <td>{nomeItem(it)}</td>
                            <td className="num">{fmtNum(it.horasN)}</td>
                            <td className="num">{fmtBRL(it.valorHoraN)}</td>
                            <td className="num">{fmtBRL(it.custo)}</td>
                            {metas.map((m) => (
                              <td key={m.key} className="num">
                                {fmtBRL(calc.metas[m.key].linhas[i].valorHoraFaturar)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {v.observacoes && <p className="muted pad">Obs.: {v.observacoes}</p>}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {excluir && (
        <Confirm
          title="Excluir viabilidade"
          danger
          confirmLabel="Excluir"
          message={`Excluir a viabilidade nº ${String(excluir.numero).padStart(4, '0')}? Esta ação não pode ser desfeita.`}
          onCancel={() => setExcluir(null)}
          onConfirm={() => {
            setDb((d) => removeViabilidade(d, excluir.id))
            notify('Viabilidade excluída')
            setExcluir(null)
          }}
        />
      )}
    </Card>
  )
}
