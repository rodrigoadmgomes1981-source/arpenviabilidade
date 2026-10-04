import { useState } from 'react'
import { Card, Field, NumInput } from './ui'
import { IMPOSTOS, CONFIG_PADRAO, totalImpostosPct } from '../lib/calc'
import { fmtPct } from '../lib/format'

export default function ConfigPage({ db, acoes, notify }) {
  const [cfg, setCfg] = useState(() => ({ ...CONFIG_PADRAO, ...(db.config || {}) }))
  const [salvando, setSalvando] = useState(false)

  const salvar = async () => {
    setSalvando(true)
    try {
      const novo = await acoes.salvarConfig(cfg)
      setCfg(novo)
      notify('Configurações salvas')
    } catch (e) {
      notify(e.message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="config">
      <Card
        title="Configurações padrão"
        subtitle="Valores que já vêm preenchidos em toda nova viabilidade. Cada viabilidade ainda pode ser ajustada."
        actions={
          <button className="btn primary" disabled={salvando} onClick={salvar}>
            {salvando ? 'Salvando…' : 'Salvar configurações'}
          </button>
        }
      >
        <h3 className="sec-title">Alíquotas de impostos</h3>
        <div className="tax-grid">
          {IMPOSTOS.map((i) => (
            <Field key={i.key} label={i.label}>
              <NumInput
                id={`cfg-${i.key}`}
                value={cfg.impostos[i.key]}
                onChange={(v) => setCfg((c) => ({ ...c, impostos: { ...c.impostos, [i.key]: v } }))}
                suffix="%"
                placeholder="0"
              />
            </Field>
          ))}
          <div className="tax-total">
            <span className="muted">Total de tributos</span>
            <strong>{fmtPct(totalImpostosPct(cfg.impostos))}</strong>
          </div>
        </div>

        <h3 className="sec-title">Faixas de margem</h3>
        <div className="row-3">
          <Field label="Variação entre faixas">
            <NumInput id="cfg-variacao" value={cfg.variacao} onChange={(v) => setCfg((c) => ({ ...c, variacao: v }))} />
          </Field>
          <Field label="Tipo de variação">
            <select id="cfg-modo" value={cfg.modo} onChange={(e) => setCfg((c) => ({ ...c, modo: e.target.value }))}>
              <option value="pp">Soma em pontos percentuais (+1,2 p.p.)</option>
              <option value="mult">Multiplicador (×1,2)</option>
            </select>
          </Field>
          <Field label="Validade padrão da proposta">
            <NumInput
              id="cfg-validade"
              value={String(cfg.validadeDias)}
              onChange={(v) => setCfg((c) => ({ ...c, validadeDias: v.replace(/\D/g, '') }))}
              suffix="dias"
              placeholder="30"
            />
          </Field>
        </div>
      </Card>
    </div>
  )
}
