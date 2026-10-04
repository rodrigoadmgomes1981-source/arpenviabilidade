import { useEffect, useState } from 'react'
import { Modal, Empty } from './ui'
import { fmtBRL, fmtData, fmtNum, fmtPct } from '../lib/format'
import { fmtISO } from '../lib/proposta'

const ACOES = {
  criada: 'Viabilidade criada',
  editada: 'Viabilidade editada',
  proposta_alterada: 'Data/validade da proposta alterada',
  proposta_emitida: 'Proposta emitida',
  proposta_reemitida: 'Proposta reemitida',
  excluida: 'Viabilidade excluída',
}

const valor = (v, tipo) => {
  if (v === null || v === undefined || v === '') return '—'
  if (tipo === 'brl') return fmtBRL(Number(v))
  if (tipo === 'pct') return fmtPct(Number(v))
  if (tipo === 'num') return fmtNum(Number(v))
  if (tipo === 'data') return fmtISO(v)
  return String(v)
}

/** Log de alterações de uma viabilidade (quem alterou, quando e o quê) */
export default function LogsModal({ viab, acoes, onClose }) {
  const [logs, setLogs] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => {
    acoes.logs(viab.id).then(setLogs).catch((e) => setErro(e.message))
  }, [acoes, viab.id])

  return (
    <Modal title={`Log de alterações – nº ${String(viab.numero).padStart(4, '0')}`} onClose={onClose} wide>
      {erro && <div className="alert">{erro}</div>}
      {!logs && !erro && <p className="muted">Carregando…</p>}
      {logs && logs.length === 0 && <Empty title="Sem registros" />}
      {logs && logs.length > 0 && (
        <ol className="timeline">
          {logs.map((l) => (
            <li key={l.id} className={`tl-item tl-${l.acao.startsWith('proposta') ? 'observacao' : 'sistema'}`}>
              <span className="tl-dot" aria-hidden="true" />
              <div className="tl-body">
                <div className="tl-meta">
                  <strong>{ACOES[l.acao] || l.acao}</strong>
                  {l.detalhes?.versao && <span className="pill">v{l.detalhes.versao}</span>}
                  <span className="tiny muted">
                    {l.usuarioNome || 'Sistema'} · {fmtData(l.criadoEm)}
                  </span>
                </div>
                {l.detalhes?.mudancas?.length > 0 && (
                  <table className="tbl compact log-tbl">
                    <thead>
                      <tr>
                        <th>Campo</th>
                        <th>Antes</th>
                        <th>Depois</th>
                      </tr>
                    </thead>
                    <tbody>
                      {l.detalhes.mudancas.map((m, i) => (
                        <tr key={i}>
                          <td>{m.campo}</td>
                          <td className="muted">{valor(m.de, m.tipo)}</td>
                          <td>{valor(m.para, m.tipo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {(l.acao === 'proposta_emitida' || l.acao === 'proposta_reemitida') && (
                  <p className="tiny muted">
                    Data da proposta {fmtISO(l.detalhes?.data)} · válida até {fmtISO(l.detalhes?.validade)}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  )
}
