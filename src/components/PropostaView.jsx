import { useEffect, useState } from 'react'
import logo from '../assets/arpen-logo.png'
import { calcular, metasSelecionadas, nomeItem } from '../lib/calc'
import { fmtBRL, fmtDataCurta, fmtNum, fmtPct } from '../lib/format'

export default function PropostaView({ viab, cliente, onClose }) {
  const calc = calcular(viab)
  const metas = metasSelecionadas(viab)
  const [gerando, setGerando] = useState(false)

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
        <strong>Proposta nº {String(viab.numero).padStart(4, '0')}</strong>
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
                await (await import('../lib/excel')).exportarPropostaExcel(viab, cliente)
              } finally {
                setGerando(false)
              }
            }}
          >
            {gerando ? 'Gerando…' : 'Baixar Excel'}
          </button>
          <button className="btn success" onClick={() => window.print()}>
            Imprimir / PDF
          </button>
        </div>
      </div>

      <div className="proposta-scroll">
        <article className="proposta-doc print-area">
          <header className="doc-head">
            <img src={logo} alt="Arpen" />
            <div className="doc-meta">
              <span>Proposta nº {String(viab.numero).padStart(4, '0')}</span>
              <span>Versão {viab.versao}</span>
              <span>{fmtDataCurta(viab.updatedAt)}</span>
            </div>
          </header>

          <h1>Proposta Comercial</h1>
          <p className="doc-sub">Gestão de serviços médicos</p>

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
              {linha('1. Custos Operacionais - Serviços Médicos', () => calc.custoTotal, 'sec')}
              {calc.itens.map((it) => (
                <tr key={it.id} className="sub">
                  <td>
                    {nomeItem(it)} – {fmtNum(it.horasN)} h
                  </td>
                  {metas.map((m) => (
                    <td key={m.key} className="num">
                      {fmtBRL(it.custo)}
                    </td>
                  ))}
                </tr>
              ))}
              {linha(`2. Taxas e Impostos (${fmtPct(calc.taxPct)})`, (k) => calc.metas[k].impostos, 'sec')}
              {linha('Custo Total', (k) => calc.custoTotal + calc.metas[k].impostos, 'tot')}
              {linha('3. Taxa de administração e lucro', (k) => calc.metas[k].taxaAdmLucro, 'sec')}
            </tbody>
            <tfoot>
              {linha('Valor Total Mensal', (k) => calc.metas[k].faturamento, 'grand')}
            </tfoot>
          </table>

          <h2>Valor hora por especialidade</h2>
          <table className="doc-tbl light">
            <thead>
              <tr>
                <th>Especialidade</th>
                <th className="num">Horas/mês</th>
                {metas.map((m) => (
                  <th key={m.key} className="num">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calc.itens.map((it, i) => (
                <tr key={it.id}>
                  <td>{nomeItem(it)}</td>
                  <td className="num">{fmtNum(it.horasN)}</td>
                  {metas.map((m) => (
                    <td key={m.key} className="num">
                      {fmtBRL(calc.metas[m.key].linhas[i].valorHoraFaturar)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {viab.observacoes && (
            <section className="doc-obs">
              <h2>Observações</h2>
              <p>{viab.observacoes}</p>
            </section>
          )}

          <footer className="doc-foot">
            Valores mensais, já incluídos tributos. Proposta válida por 30 dias a partir da data de emissão.
          </footer>
        </article>
      </div>
    </div>
  )
}
