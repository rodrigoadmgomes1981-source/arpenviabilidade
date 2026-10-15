import { useEffect, useState } from 'react'
import logo from '../assets/arpen-logo.png'
import { calcular, metasSelecionadas, TITULO_TECNOLOGIA, TEXTO_TECNOLOGIA } from '../lib/calc'
import { dadosProposta, somaDias, diasEntre, fmtISO, dataElaboracao, dadosTecnologia, linhasTexto } from '../lib/proposta'
import { Confirm } from './ui'
import { fmtBRL, fmtData } from '../lib/format'

export default function PropostaView({ viab, cliente, db, acoes, notify, onClose }) {
  const calc = calcular(viab)
  const textoPadraoTec = db?.config?.textoTecnologia || TEXTO_TECNOLOGIA
  const elab = dataElaboracao(viab)
  const [draft, setDraft] = useState(() => {
    const p = dadosProposta(viab, db?.config?.validadeDias)
    const t = dadosTecnologia(viab, textoPadraoTec)
    return { data: p.data, validade: p.validade, tecIncluir: t.incluir, tecTexto: t.texto }
  })
  const tecSalvo = viab.propostaExtra?.tecnologia
  const prop = { ...draft, dias: diasEntre(draft.data, draft.validade) }
  const alterado =
    !viab.proposta ||
    draft.data !== viab.proposta.data ||
    draft.validade !== viab.proposta.validade ||
    !tecSalvo ||
    tecSalvo.incluir !== draft.tecIncluir ||
    tecSalvo.texto !== draft.tecTexto
  const payload = () => ({
    data: draft.data,
    validade: draft.validade,
    tecnologia: { incluir: draft.tecIncluir, texto: draft.tecTexto },
  })
  const viabDoc = { ...viab, proposta: { data: draft.data, validade: draft.validade }, propostaExtra: { ...(viab.propostaExtra || {}), tecnologia: { incluir: draft.tecIncluir, texto: draft.tecTexto } } }
  const comTec = draft.tecIncluir
  const n = (i) => (comTec ? i + 1 : i)
  const setData = (data) => data && data >= elab && setDraft((d) => ({ ...d, data, validade: somaDias(data, prop.dias) }))
  const setDias = (txt) => {
    const n = Math.max(0, parseInt(String(txt).replace(/\D/g, ''), 10) || 0)
    setDraft((d) => ({ ...d, validade: somaDias(d.data, n) }))
  }
  const setValidade = (validade) => validade && diasEntre(draft.data, validade) >= 0 && setDraft((d) => ({ ...d, validade }))
  const metas = metasSelecionadas(viab)
  const [gerando, setGerando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [confirmarEmissao, setConfirmarEmissao] = useState(false)

  const salvarDatas = async () => {
    setOcupado(true)
    try {
      await acoes.salvarProposta(viab.id, payload())
      notify('Dados da proposta salvos')
      return true
    } catch (e) {
      notify(e.message, 'erro')
      return false
    } finally {
      setOcupado(false)
    }
  }

  const emitir = async () => {
    setConfirmarEmissao(false)
    if (alterado && !(await salvarDatas())) return
    setOcupado(true)
    try {
      await acoes.emitirProposta(viab.id)
      notify(viab.emitidaEm ? 'Proposta reemitida' : 'Proposta emitida')
    } catch (e) {
      notify(e.message, 'erro')
    } finally {
      setOcupado(false)
    }
  }

  useEffect(() => {
    document.body.classList.add('printing-proposta')
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => {
      document.body.classList.remove('printing-proposta')
      window.removeEventListener('keydown', h)
    }
  }, [onClose])

  const linha = (label, fn, cls = '') => (
    <tr className={cls}>
      <td>{label}</td>
      {metas.map((m) => (
        <td key={m.key} className="num">
          {fmtBRL(fn(m.key))}
        </td>
      ))}
    </tr>
  )

  return (
    <div className="proposta-overlay">
      <div className="proposta-toolbar no-print">
        <div className="tb-title">
          <strong>Proposta nº {String(viab.numero).padStart(4, '0')}</strong>
          <span className={`pill ${viab.emitidaEm ? 'ok' : 'warn'}`}>
            {viab.emitidaEm ? `Emitida em ${fmtData(viab.emitidaEm)} por ${viab.emitidaPorNome}` : 'Ainda não emitida'}
          </span>
        </div>
        <div className="actions">
          <button className="btn ghost light" onClick={onClose}>
            Fechar
          </button>
          <button
            className="btn ghost light"
            disabled={gerando}
            onClick={async () => {
              setGerando(true)
              try {
                await (await import('../lib/excel')).exportarPropostaExcel(viabDoc, cliente)
              } finally {
                setGerando(false)
              }
            }}
          >
            {gerando ? 'Gerando…' : 'Baixar Excel'}
          </button>
          <button className="btn ghost light" onClick={() => window.print()}>
            Imprimir / PDF
          </button>
          <button className="btn success" disabled={ocupado} onClick={() => setConfirmarEmissao(true)}>
            {viab.emitidaEm ? 'Reemitir proposta' : 'Emitir proposta'}
          </button>
        </div>
      </div>

      <div className="proposta-dados no-print">
        <div className="elab-info">
          <span>Elaborada em</span>
          <strong>{fmtISO(elab)}</strong>
        </div>
        <label>
          <span>Data da proposta</span>
          <input id="prop-data" type="date" min={elab} value={prop.data} onChange={(e) => setData(e.target.value)} />
        </label>
        <label>
          <span>Validade (dias)</span>
          <input
            id="prop-dias"
            inputMode="numeric"
            value={prop.dias}
            onChange={(e) => setDias(e.target.value)}
          />
        </label>
        <label>
          <span>Válida até</span>
          <input
            id="prop-validade"
            type="date"
            min={prop.data}
            value={prop.validade}
            onChange={(e) => setValidade(e.target.value)}
          />
        </label>
        <div className="prop-atalhos">
          {[15, 30, 60, 90].map((n) => (
            <button key={n} className={`chip ${prop.dias === n ? 'on' : ''}`} onClick={() => setDias(n)}>
              {n} dias
            </button>
          ))}
        </div>
        {alterado && (
          <button className="btn success sm" disabled={ocupado} onClick={salvarDatas}>
            Salvar alterações
          </button>
        )}
        <div className="tec-box">
          <label className="switch">
            <input
              id="tec-incluir"
              type="checkbox"
              checked={draft.tecIncluir}
              onChange={(e) => setDraft((d) => ({ ...d, tecIncluir: e.target.checked }))}
            />
            <span className="switch-ui" aria-hidden="true" />
            <span>
              Incluir item <strong>{TITULO_TECNOLOGIA}</strong>
            </span>
          </label>
          {draft.tecIncluir && (
            <div className="tec-edit">
              <textarea
                id="tec-texto"
                rows={4}
                value={draft.tecTexto}
                onChange={(e) => setDraft((d) => ({ ...d, tecTexto: e.target.value }))}
                aria-label="Texto do item Tecnologia"
              />
              <div className="tec-hint">
                <span>Linhas que começam com * viram tópicos.</span>
                {draft.tecTexto !== textoPadraoTec && (
                  <button type="button" className="link light" onClick={() => setDraft((d) => ({ ...d, tecTexto: textoPadraoTec }))}>
                    Restaurar texto padrão
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {confirmarEmissao && (
        <Confirm
          title={viab.emitidaEm ? 'Reemitir proposta' : 'Emitir proposta'}
          confirmLabel={viab.emitidaEm ? 'Reemitir' : 'Emitir'}
          message={`Registrar a emissão da proposta nº ${String(viab.numero).padStart(4, '0')} (v${viab.versao}) com data ${fmtISO(draft.data)} e validade até ${fmtISO(draft.validade)}? A emissão fica registrada no log e no histórico do cliente com o seu usuário.`}
          onCancel={() => setConfirmarEmissao(false)}
          onConfirm={emitir}
        />
      )}

      <div className="proposta-scroll">
        <article className="proposta-doc print-area">
          <header className="doc-head">
            <img src={logo} alt="Arpen" />
            <div className="doc-meta">
              <span>Proposta nº {String(viab.numero).padStart(4, '0')}</span>
              <span>Versão {viab.versao}</span>
              <span>Data: {fmtISO(prop.data)}</span>
            </div>
          </header>

          <h1>Proposta Comercial</h1>
          <p className="doc-sub">Gestão de serviços médicos</p>

          <div className="doc-validade">
            <div>
              <span>Data da proposta</span>
              <strong>{fmtISO(prop.data)}</strong>
            </div>
            <div>
              <span>Validade</span>
              <strong>
                {prop.dias} dias · até {fmtISO(prop.validade)}
              </strong>
            </div>
          </div>

          <section className="doc-client">
            <div>
              <span>Cliente</span>
              <strong>{cliente?.nome || '—'}</strong>
            </div>
            <div>
              <span>Setor do hospital</span>
              <strong>{cliente?.setor || '—'}</strong>
            </div>
            <div>
              <span>Contato</span>
              <strong>{cliente?.contato || '—'}</strong>
            </div>
            <div>
              <span>Telefone</span>
              <strong>{cliente?.telefone || '—'}</strong>
            </div>
          </section>

          <table className="doc-tbl">
            <thead>
              <tr>
                <th>Descrição</th>
                {metas.map((m) => (
                  <th key={m.key} className="num">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comTec && (
                <tr className="sec sec-desc sec-tec">
                  <td>
                    1. {TITULO_TECNOLOGIA}
                    <ul className="doc-topicos">
                      {linhasTexto(draft.tecTexto).map((l, i) =>
                        l.topico ? (
                          <li key={i}>{l.t}</li>
                        ) : (
                          <li key={i} className="plain">
                            {l.t}
                          </li>
                        ),
                      )}
                    </ul>
                  </td>
                  {metas.map((m) => (
                    <td key={m.key} className="num global" rowSpan={2}>
                      {fmtBRL(calc.custoTotal)}
                    </td>
                  ))}
                </tr>
              )}
              <tr className="sec sec-desc">
                <td>
                  {n(1)}. Custos Operacionais - Serviços Médicos
                  {viab.observacoes?.trim() && <p className="doc-desc">{viab.observacoes.trim()}</p>}
                </td>
                {!comTec &&
                  metas.map((m) => (
                    <td key={m.key} className="num">
                      {fmtBRL(calc.custoTotal)}
                    </td>
                  ))}
              </tr>
              {linha(`${n(2)}. Taxas e Impostos`, (k) => calc.metas[k].impostos, 'sec')}
              {linha('Custo Total', (k) => calc.custoTotal + calc.metas[k].impostos, 'tot')}
              {linha(`${n(3)}. Taxa de Administração`, (k) => calc.metas[k].taxaAdmLucro, 'sec')}
            </tbody>
            <tfoot>
              {linha('Valor Total Mensal', (k) => calc.metas[k].faturamento, 'grand')}
            </tfoot>
          </table>

          <footer className="doc-foot">
            Valores mensais, já incluídos tributos. Proposta emitida em {fmtISO(prop.data)} e válida até {fmtISO(prop.validade)} ({prop.dias} dias).
          </footer>
        </article>
      </div>
    </div>
  )
}
