import { useMemo, useState } from 'react'
import { Card, Field, NumInput, Modal, Empty } from './ui'
import { catalogoEspecialidades, existeEspecialidade } from '../data/especialidades'
import {
  IMPOSTOS,
  METAS,
  TIPOS_META,
  calcular,
  novaViabilidade,
  totalImpostosPct,
  nomeItem,
  metasSelecionadas,
  metaPrincipal,
  faixasMargem,
  isUnica,
} from '../lib/calc'
import { fmtBRL, fmtNum, fmtPct, parseNum, uid } from '../lib/format'
import { fmtISO, hojeISO, dataElaboracao } from '../lib/proposta'

const STEPS = [
  { key: 'cliente', label: 'Cliente' },
  { key: 'impostos', label: 'Impostos' },
  { key: 'despesas', label: 'Despesas adm.' },
  { key: 'margens', label: 'Margens' },
  { key: 'especialidades', label: 'Especialidades' },
  { key: 'resultado', label: 'Resultado' },
]

export default function ViabilidadeWizard({
  db,
  acoes,
  isAdmin,
  inicial,
  notify,
  onIrClientes,
  onIrEspecialidades,
  onNova,
  onSalvo,
}) {
  const [viab, setViab] = useState(() =>
    inicial?.id
      ? { ...structuredClone(inicial), dataElaboracao: dataElaboracao(inicial) }
      : novaViabilidade(inicial?.clienteId || '', db.config),
  )
  const [step, setStep] = useState(0)
  const [margemBase, setMargemBase] = useState(() => (inicial?.id ? inicial.margem?.minima : ''))
  const irPara = (n) => {
    if (step === 3 || !margemBase) setMargemBase(viab.margem.minima)
    setStep(n)
  }
  const [confirmar, setConfirmar] = useState(false)
  const [aceite, setAceite] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const calc = useMemo(() => calcular(viab), [viab])
  const cliente = db.clientes.find((c) => c.id === viab.clienteId)
  const editando = Boolean(viab.id)

  const upd = (patch) => setViab((v) => ({ ...v, ...patch }))

  const validacao = useMemo(() => {
    const e = {}
    if (!viab.clienteId) e.cliente = 'Selecione um cliente'
    else if (!viab.dataElaboracao) e.cliente = 'Informe a data de elaboração da proposta'
    if (totalImpostosPct(viab.impostos) <= 0) e.impostos = 'Informe as alíquotas'
    if (parseNum(viab.margem.minima) <= 0) e.margens = isUnica(viab) ? 'Informe a margem' : 'Informe a margem mínima'
    if (!viab.itens.length) e.especialidades = 'Inclua ao menos uma especialidade'
    else if (viab.itens.some((i) => parseNum(i.horas) <= 0 || parseNum(i.valorHora) <= 0))
      e.especialidades = 'Preencha horas e valor/hora de todas as linhas'
    const metasInvalidas = metasSelecionadas(viab)
      .map((m) => m.key)
      .filter((k) => !calc.metas[k].valido)
    if (!e.especialidades && metasInvalidas.length) e.resultado = calc.metas[metasInvalidas[0]].erro
    return e
  }, [viab, calc])

  const stepErro = (k) => validacao[k]
  const podeSalvar = Object.keys(validacao).length === 0

  const salvar = async () => {
    setSalvando(true)
    try {
      const saved = await acoes.salvarViabilidade(viab)
      setConfirmar(false)
      notify(editando ? `Viabilidade atualizada (v${saved.versao})` : 'Viabilidade salva no histórico')
      onSalvo(saved)
    } catch (e) {
      notify(e.message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  if (!db.clientes.length) {
    return (
      <Card title="Viabilidade">
        <Empty title="Cadastre um cliente primeiro">
          <p>A viabilidade é sempre vinculada a um cliente do banco interno.</p>
          <button className="btn primary" onClick={onIrClientes}>
            Ir para Clientes
          </button>
        </Empty>
      </Card>
    )
  }

  return (
    <div className="wizard">
      <div className="wizard-head">
        <div>
          <h1>{editando ? `Editando viabilidade nº ${String(viab.numero).padStart(4, '0')}` : 'Nova viabilidade'}</h1>
          <p className="muted">
            {cliente ? `${cliente.nome} · ${cliente.setor}` : 'Selecione o cliente para começar'}
            {editando && ` · versão atual v${viab.versao}`}
          </p>
        </div>
        {editando && (
          <button className="btn ghost" onClick={onNova}>
            Iniciar nova
          </button>
        )}
      </div>

      <ol className="stepper">
        {STEPS.map((s, i) => (
          <li key={s.key}>
            <button
              className={`step ${i === step ? 'current' : ''} ${i < step && !stepErro(s.key) ? 'done' : ''} ${
                i < step && stepErro(s.key) ? 'warn' : ''
              }`}
              onClick={() => irPara(i)}
            >
              <span className="step-n">{i + 1}</span>
              <span className="step-l">{s.label}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="wizard-body">
        <div className="wizard-main">
          {step === 0 && <StepCliente db={db} viab={viab} upd={upd} onIrClientes={onIrClientes} />}
          {step === 1 && <StepImpostos viab={viab} upd={upd} />}
          {step === 2 && <StepDespesas viab={viab} upd={upd} />}
          {step === 3 && <StepMargens viab={viab} upd={upd} calc={calc} />}
          {step === 4 && (
            <StepEspecialidades
              viab={viab}
              setViab={setViab}
              calc={calc}
              db={db}
              acoes={acoes}
              isAdmin={isAdmin}
              notify={notify}
              onIrEspecialidades={onIrEspecialidades}
              margemBase={margemBase}
            />
          )}
          {step === 5 && (
            <StepResultado viab={viab} upd={upd} setViab={setViab} calc={calc} erro={validacao.resultado} margemBase={margemBase} />
          )}

          {stepErro(STEPS[step].key) && <div className="alert">{stepErro(STEPS[step].key)}</div>}

          <div className="wizard-nav">
            <button className="btn ghost" disabled={step === 0} onClick={() => irPara(step - 1)}>
              ← Voltar
            </button>
            {step < STEPS.length - 1 ? (
              <button className="btn primary" onClick={() => irPara(step + 1)}>
                Avançar →
              </button>
            ) : (
              <button
                className="btn success"
                disabled={!podeSalvar}
                title={podeSalvar ? '' : Object.values(validacao)[0]}
                onClick={() => {
                  setAceite(false)
                  setConfirmar(true)
                }}
              >
                Salvar e confirmar
              </button>
            )}
          </div>
        </div>

        <aside className="wizard-side">
          <Resumo viab={viab} calc={calc} cliente={cliente} />
        </aside>
      </div>

      {confirmar && (
        <Modal
          title="Confirmar dados da viabilidade"
          onClose={() => setConfirmar(false)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setConfirmar(false)}>
                Revisar
              </button>
              <button className="btn success" disabled={!aceite || salvando} onClick={salvar}>
                {salvando ? 'Salvando…' : 'Confirmar e salvar'}
              </button>
            </>
          }
        >
          <dl className="kv">
            <dt>Cliente</dt>
            <dd>
              {cliente?.nome} – {cliente?.setor}
            </dd>
            <dt>Elaboração da proposta</dt>
            <dd>{fmtISO(viab.dataElaboracao)}</dd>
            <dt>Tipo</dt>
            <dd>{TIPOS_META[viab.tipoMeta]}</dd>
            <dt>Tributos</dt>
            <dd>{fmtPct(calc.taxPct)}</dd>
            <dt>Despesas adm.</dt>
            <dd>{fmtBRL(calc.despAdm)}</dd>
            <dt>Especialidades</dt>
            <dd>
              {viab.itens.length} linha(s) · {fmtNum(calc.totalHoras)} h
            </dd>
            <dt>Custo total</dt>
            <dd>{fmtBRL(calc.custoTotal)}</dd>
            {metasSelecionadas(viab).map((m) => (
              <FragmentMeta key={m.key} m={calc.metas[m.key]} />
            ))}
          </dl>
          {editando && (
            <p className="tiny muted">
              Ao salvar, a viabilidade passa para a versão v{(viab.versao || 1) + 1} e as alterações ficam registradas no log
              com o seu usuário.
            </p>
          )}
          <label className="check">
            <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
            Conferi os dados e confirmo o salvamento no histórico do cliente.
          </label>
        </Modal>
      )}
    </div>
  )
}

function FragmentMeta({ m }) {
  return (
    <>
      <dt>{m.label}</dt>
      <dd>
        <strong>{fmtBRL(m.faturamento)}</strong> <span className="muted">(margem {fmtPct(m.margemPct)})</span>
      </dd>
    </>
  )
}

/* ----------------------------- Etapas ----------------------------- */

function StepCliente({ db, viab, upd, onIrClientes }) {
  const [q, setQ] = useState('')
  const lista = db.clientes
    .filter((c) => !q || `${c.nome} ${c.setor}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  return (
    <Card
      title="1. Cliente"
      subtitle="Informe a data de elaboração, o tipo de viabilidade e o cliente."
      actions={
        <button className="btn ghost sm" onClick={onIrClientes}>
          + Novo cliente
        </button>
      }
    >
      <div className="elab-row">
        <Field label="Data de Elaboração da Proposta *" hint="Data em que esta viabilidade/proposta está sendo elaborada.">
          <input
            id="data-elaboracao"
            type="date"
            value={viab.dataElaboracao || ''}
            max="2100-12-31"
            onChange={(e) => upd({ dataElaboracao: e.target.value })}
          />
        </Field>
        {viab.dataElaboracao !== hojeISO() && (
          <button type="button" className="btn ghost sm" onClick={() => upd({ dataElaboracao: hojeISO() })}>
            Usar hoje
          </button>
        )}
      </div>
      <div className="field tipo-meta">
        <span className="field-label">Tipo de viabilidade *</span>
        <div className="perfil-opts">
          {[
            ['faixas', 'Três faixas de margem: mínima, mediana e máxima (variação de 1,2 entre elas).'],
            ['unica', 'Uma única margem e um único valor na proposta.'],
          ].map(([k, d]) => (
            <label key={k} className={`perfil-opt ${viab.tipoMeta === k ? 'on' : ''}`}>
              <input
                type="radio"
                name="tipoMeta"
                value={k}
                checked={viab.tipoMeta === k}
                onChange={() => upd({ tipoMeta: k })}
              />
              <strong>{TIPOS_META[k]}</strong>
              <span className="tiny muted">{d}</span>
            </label>
          ))}
        </div>
      </div>
      <input
        id="busca-cliente"
        className="search full"
        placeholder="Buscar cliente…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="pick-list">
        {lista.map((c) => (
          <button
            key={c.id}
            className={`pick ${viab.clienteId === c.id ? 'selected' : ''}`}
            onClick={() => upd({ clienteId: c.id })}
          >
            <strong>{c.nome}</strong>
            <span className="muted">
              {c.setor}
              {c.contato && ` · ${c.contato}`}
              {c.telefone && ` · ${c.telefone}`}
            </span>
          </button>
        ))}
      </div>
    </Card>
  )
}

function StepImpostos({ viab, upd }) {
  const set = (k) => (v) => upd({ impostos: { ...viab.impostos, [k]: v } })
  return (
    <Card title="2. Alíquotas de impostos" subtitle="Informe cada alíquota em % sobre o faturamento.">
      <div className="tax-grid">
        {IMPOSTOS.map((i) => (
          <Field key={i.key} label={i.label}>
            <NumInput value={viab.impostos[i.key]} onChange={set(i.key)} suffix="%" placeholder="0" />
          </Field>
        ))}
        <div className="tax-total">
          <span className="muted">Total de tributos</span>
          <strong>{fmtPct(totalImpostosPct(viab.impostos))}</strong>
        </div>
      </div>
    </Card>
  )
}

function StepDespesas({ viab, upd }) {
  return (
    <Card title="3. Despesas administrativas" subtitle="Valor mensal em R$ que será incorporado ao preço.">
      <div className="narrow">
        <Field label="Despesas administrativas (mensal)" hint="Ex.: coordenação, sistemas, deslocamentos, estrutura.">
          <NumInput value={viab.despAdm} onChange={(v) => upd({ despAdm: v })} prefix="R$" />
        </Field>
        <p className="big-number">{fmtBRL(parseNum(viab.despAdm))}</p>
      </div>
    </Card>
  )
}

function StepMargens({ viab, upd, calc }) {
  const set = (k) => (v) => upd({ margem: { ...viab.margem, [k]: v } })
  if (isUnica(viab))
    return (
      <Card title="4. Margem" subtitle="Viabilidade com meta única: informe a margem desejada.">
        <div className="narrow">
          <Field label="Margem da proposta">
            <NumInput id="margem-unica" value={viab.margem.minima} onChange={set('minima')} suffix="%" placeholder="0" />
          </Field>
        </div>
        <div className="faixas one">
          <div className="faixa faixa-unica">
            <span>Meta Única</span>
            <strong>{fmtPct(calc.faixas.unica)}</strong>
          </div>
        </div>
        <p className="tiny muted">
          Margem = lucro ÷ faturamento, após tributos, custo médico e despesas administrativas.
        </p>
      </Card>
    )
  return (
    <Card
      title="4. Margem aceitável"
      subtitle="Três faixas – mínima, mediana e máxima – com variação de 1,2 entre elas."
    >
      <div className="row-3">
        <Field label="Margem mínima aceitável">
          <NumInput id="margem-minima" value={viab.margem.minima} onChange={set('minima')} suffix="%" placeholder="0" />
        </Field>
        <Field label="Variação entre faixas">
          <NumInput value={viab.margem.variacao} onChange={set('variacao')} placeholder="1,2" />
        </Field>
        <Field label="Tipo de variação">
          <select value={viab.margem.modo} onChange={(e) => set('modo')(e.target.value)}>
            <option value="pp">Soma em pontos percentuais (+1,2 p.p.)</option>
            <option value="mult">Multiplicador (×1,2)</option>
          </select>
        </Field>
      </div>
      <div className="faixas">
        {METAS.map((m) => (
          <div key={m.key} className={`faixa faixa-${m.key}`}>
            <span>{m.label}</span>
            <strong>{fmtPct(calc.faixas[m.key])}</strong>
          </div>
        ))}
      </div>
      <p className="tiny muted">
        Margem = lucro ÷ faturamento, após tributos, custo médico e despesas administrativas.
      </p>
    </Card>
  )
}

function StepEspecialidades({ viab, setViab, calc, db, acoes, isAdmin, notify, onIrEspecialidades, margemBase }) {
  const [q, setQ] = useState('')
  const [custom, setCustom] = useState('')
  const [salvarCadastro, setSalvarCadastro] = useState(true)
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const catalogo = catalogoEspecialidades(db)
  const lista = catalogo.filter((e) => norm(e.nome).includes(norm(q)))
  const nProprias = catalogo.filter((e) => e.origem === 'PROPRIA').length

  const add = (especialidade, qualificacao) =>
    setViab((v) => ({
      ...v,
      itens: [...v.itens, { id: uid(), especialidade, qualificacao, horas: '', valorHora: '' }],
    }))
  const updItem = (id, patch) =>
    setViab((v) => ({ ...v, itens: v.itens.map((i) => (i.id === id ? { ...i, ...patch } : i)) }))
  const rmItem = (id) => setViab((v) => ({ ...v, itens: v.itens.filter((i) => i.id !== id) }))
  const principal = calc.metas[metaPrincipal(viab)]
  const count = (esp, ql) => viab.itens.filter((i) => i.especialidade === esp && i.qualificacao === ql).length

  return (
    <>
      <Card
        title="5. Especialidades"
        subtitle={`${catalogo.length} especialidades disponíveis (CFM${nProprias ? ` + ${nProprias} cadastrada(s)` : ''}). Clique em “Com RQE” ou “Com Pós” para incluir.`}
        actions={
          isAdmin && (
            <button className="btn ghost sm" onClick={onIrEspecialidades}>
              Gerenciar especialidades
            </button>
          )
        }
      >
        <input
          className="search full"
          placeholder="Buscar especialidade…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="esp-list">
          {lista.map(({ nome: e, origem }) => (
            <div key={e} className="esp-row">
              <span>
                {e}
                {origem === 'PROPRIA' && <span className="pill ok inline">Cadastrada</span>}
              </span>
              <div className="esp-btns">
                {['RQE', 'POS'].map((ql) => (
                  <button
                    key={ql}
                    className={`chip ${count(e, ql) ? 'on' : ''}`}
                    onClick={() => add(e, ql)}
                    title={`Adicionar ${e} ${ql === 'RQE' ? 'com RQE' : 'com Pós'}`}
                  >
                    {ql === 'RQE' ? 'COM RQE' : 'COM PÓS'}
                    {count(e, ql) > 0 && <b>{count(e, ql)}</b>}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {!lista.length && <p className="muted pad">Nenhuma especialidade encontrada.</p>}
        </div>
        <div className="custom-add">
          <input
            id="esp-custom"
            placeholder="Não achou? Digite outra especialidade ou serviço (ex.: Coordenação Clínica)…"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
          <button
            className="btn ghost sm"
            disabled={!custom.trim()}
            onClick={() => {
              const nome = custom.trim()
              add(nome, 'LIVRE')
              if (isAdmin && salvarCadastro && !existeEspecialidade(catalogoEspecialidades(db, { incluirOcultas: true }), nome)) {
                acoes
                  .salvarEspecialidade({ nome, descricao: '' })
                  .then(() => notify(`“${nome}” cadastrada nas especialidades`))
                  .catch((e) => notify(e.message, 'erro'))
              }
              setCustom('')
            }}
          >
            + Adicionar
          </button>
        </div>
        {isAdmin && (
          <label className="check small">
            <input
              id="esp-salvar-cadastro"
              type="checkbox"
              checked={salvarCadastro}
              onChange={(e) => setSalvarCadastro(e.target.checked)}
            />
            Salvar também no cadastro de especialidades
          </label>
        )}
      </Card>

      <Card title="Especialidades selecionadas" subtitle="Uma linha por especialidade: horas e valor a pagar por hora.">
        {viab.itens.length > 0 && <MargemSimulador viab={viab} setViab={setViab} calc={calc} base={margemBase} />}
        {viab.itens.length === 0 ? (
          <Empty title="Nenhuma especialidade incluída">Use os botões COM RQE / COM PÓS acima.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Especialidade</th>
                  <th>Titulação</th>
                  <th className="num">Horas (mês)</th>
                  <th className="num">Valor hora a pagar</th>
                  <th className="num">Custo total</th>
                  <th className="num sim-col">Hora a faturar*</th>
                  <th className="num sim-col">Faturamento*</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {viab.itens.map((it, idx) => (
                  <tr key={it.id}>
                    <td>{it.especialidade}</td>
                    <td>
                      <div className="seg">
                        {['RQE', 'POS'].map((ql) => (
                          <button
                            key={ql}
                            className={it.qualificacao === ql ? 'on' : ''}
                            onClick={() => updItem(it.id, { qualificacao: it.qualificacao === ql ? 'LIVRE' : ql })}
                          >
                            {ql === 'RQE' ? 'RQE' : 'Pós'}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="num">
                      <NumInput value={it.horas} onChange={(v) => updItem(it.id, { horas: v })} suffix="h" placeholder="0" />
                    </td>
                    <td className="num">
                      <NumInput value={it.valorHora} onChange={(v) => updItem(it.id, { valorHora: v })} prefix="R$" />
                    </td>
                    <td className="num strong">{fmtBRL(calc.itens[idx]?.custo)}</td>
                    <td className="num sim-col">{fmtBRL(principal.linhas[idx]?.valorHoraFaturar)}</td>
                    <td className="num sim-col">{fmtBRL(principal.linhas[idx]?.faturamento)}</td>
                    <td>
                      <button
                        className="btn-del"
                        onClick={() => rmItem(it.id)}
                        aria-label={`Excluir ${nomeItem(it)}`}
                        title="Excluir esta especialidade da viabilidade"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm-3 6h12l-1 12H7L6 9zm4 2v8h2v-8h-2zm4 0v8h2v-8h-2z" />
                        </svg>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Total</td>
                  <td className="num">{fmtNum(calc.totalHoras)} h</td>
                  <td />
                  <td className="num">{fmtBRL(calc.custoTotal)}</td>
                  <td />
                  <td className="num sim-col">{fmtBRL(principal.faturamento)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
            <p className="tiny muted pad">
              * Calculado com a {principal.label.toLowerCase()} ({fmtPct(principal.margemPct)}). Ajuste a margem acima e o valor
              hora a pagar na tabela para simular.
            </p>
          </div>
        )}
      </Card>
    </>
  )
}

function StepResultado({ viab, upd, setViab, calc, erro, margemBase }) {
  const sel = metasSelecionadas(viab)
  const updItem = (id, patch) =>
    setViab((v) => ({ ...v, itens: v.itens.map((i) => (i.id === id ? { ...i, ...patch } : i)) }))
  const proxima = isUnica(viab)
    ? null
    : !viab.metas.includes('mediana')
      ? 'mediana'
      : !viab.metas.includes('maxima')
        ? 'maxima'
        : null
  const remover = (k) =>
    upd({ metas: k === 'mediana' ? ['minima'] : viab.metas.filter((m) => m !== k) })

  return (
    <>
      <Card
        title="6. Custo e faturamento"
        subtitle="Faturamento = (custo + despesas adm.) ÷ (1 − tributos − margem)."
        actions={
          <div className="meta-btns">
            {proxima && (
              <button className="btn ghost sm" onClick={() => upd({ metas: [...viab.metas, proxima] })}>
                + Adicionar meta {proxima === 'mediana' ? 'mediana' : 'máxima'}
              </button>
            )}
          </div>
        }
      >
        <MargemSimulador viab={viab} setViab={setViab} calc={calc} base={margemBase} />
        <div className="meta-cards">
          {sel.map((m) => {
            const r = calc.metas[m.key]
            return (
              <div key={m.key} className={`meta-card faixa-${m.key}`}>
                <div className="meta-card-head">
                  <span>{m.label}</span>
                  {m.key !== 'minima' && m.key !== 'unica' && (
                    <button className="icon-btn sm" onClick={() => remover(m.key)} aria-label={`Remover ${m.label}`}>
                      ×
                    </button>
                  )}
                </div>
                <div className="meta-pct">margem {fmtPct(r.margemPct)}</div>
                <dl>
                  <dt>Faturamento</dt>
                  <dd className="strong">{fmtBRL(r.faturamento)}</dd>
                  <dt>Custo total</dt>
                  <dd>{fmtBRL(calc.custoTotal)}</dd>
                  <dt>Tributos</dt>
                  <dd>{fmtBRL(r.impostos)}</dd>
                  <dt>Desp. adm.</dt>
                  <dd>{fmtBRL(calc.despAdm)}</dd>
                  <dt>Lucro</dt>
                  <dd className="pos">{fmtBRL(r.lucro)}</dd>
                </dl>
              </div>
            )
          })}
        </div>
        {erro && <div className="alert">{erro}</div>}

        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th rowSpan={2}>Especialidade</th>
                <th rowSpan={2} className="num">Horas</th>
                <th rowSpan={2} className="num">Hora a pagar</th>
                <th rowSpan={2} className="num">Custo total</th>
                {sel.map((m) => (
                  <th key={m.key} colSpan={2} className={`center grp faixa-${m.key}`}>
                    {m.label}
                  </th>
                ))}
              </tr>
              <tr>
                {sel.map((m) => (
                  <FragmentHead key={m.key} />
                ))}
              </tr>
            </thead>
            <tbody>
              {calc.itens.map((it, idx) => (
                <tr key={it.id}>
                  <td>{nomeItem(it)}</td>
                  <td className="num">{fmtNum(it.horasN)}</td>
                  <td className="num">
                    <NumInput
                      value={viab.itens[idx].valorHora}
                      onChange={(v) => updItem(it.id, { valorHora: v })}
                      prefix="R$"
                      aria-label={`Valor hora a pagar – ${nomeItem(it)}`}
                    />
                  </td>
                  <td className="num">{fmtBRL(it.custo)}</td>
                  {sel.map((m) => (
                    <FragmentCells key={m.key} l={calc.metas[m.key].linhas[idx]} />
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="num">{fmtNum(calc.totalHoras)}</td>
                <td />
                <td className="num">{fmtBRL(calc.custoTotal)}</td>
                {sel.map((m) => (
                  <FragmentTot key={m.key} v={calc.metas[m.key].faturamento} />
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card title="Observações">
        <textarea
          id="obs-proposta"
          rows={3}
          value={viab.observacoes}
          onChange={(e) => upd({ observacoes: e.target.value })}
          placeholder="Condições, premissas, escalas… (aparece na proposta)"
        />
      </Card>
    </>
  )
}

const FragmentHead = () => (
  <>
    <th className="num">Hora a faturar</th>
    <th className="num">Faturamento</th>
  </>
)
const FragmentCells = ({ l }) => (
  <>
    <td className="num">{fmtBRL(l?.valorHoraFaturar)}</td>
    <td className="num">{fmtBRL(l?.faturamento)}</td>
  </>
)
const FragmentTot = ({ v }) => (
  <>
    <td />
    <td className="num">{fmtBRL(v)}</td>
  </>
)

function Resumo({ viab, calc, cliente }) {
  return (
    <div className="resumo">
      <h3>Resumo</h3>
      <dl>
        <dt>Cliente</dt>
        <dd>{cliente?.nome || '—'}</dd>
        <dt>Elaboração</dt>
        <dd>{fmtISO(viab.dataElaboracao)}</dd>
        <dt>Tributos</dt>
        <dd>{fmtPct(calc.taxPct)}</dd>
        <dt>Desp. adm.</dt>
        <dd>{fmtBRL(calc.despAdm)}</dd>
        <dt>Tipo</dt>
        <dd>{isUnica(viab) ? 'Meta única' : 'Três faixas'}</dd>
        <dt>{isUnica(viab) ? 'Margem' : 'Margens'}</dt>
        <dd>
          {isUnica(viab)
            ? fmtPct(calc.faixas.unica)
            : `${fmtPct(calc.faixas.minima)} · ${fmtPct(calc.faixas.mediana)} · ${fmtPct(calc.faixas.maxima)}`}
        </dd>
        <dt>Especialidades</dt>
        <dd>
          {viab.itens.length} · {fmtNum(calc.totalHoras)} h
        </dd>
        <dt>Custo total</dt>
        <dd className="strong">{fmtBRL(calc.custoTotal)}</dd>
      </dl>
      <div className="resumo-metas">
        {metasSelecionadas(viab).map((m) => (
          <div key={m.key} className={`resumo-meta faixa-${m.key}`}>
            <span>{m.label}</span>
            <strong>{calc.metas[m.key].valido ? fmtBRL(calc.metas[m.key].faturamento) : '—'}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------- Simulador de margem ------------------------- */
const arred = (n) => Math.round(n * 100) / 100
const txt = (n) => String(arred(n)).replace('.', ',')

/** Ajuste rápido da margem, com o resultado recalculado na hora */
function MargemSimulador({ viab, setViab, calc, base }) {
  const unica = isUnica(viab)
  const atual = parseNum(viab.margem.minima)
  const baseN = parseNum(base)
  const setMargem = (v) => setViab((x) => ({ ...x, margem: { ...x.margem, minima: v } }))
  const passo = (d) => setMargem(txt(Math.max(0, atual + d)))
  const principal = calc.metas[metaPrincipal(viab)]
  const faixas = faixasMargem(viab.margem)
  const mudou = base !== '' && base !== undefined && arred(baseN) !== arred(atual)
  const difFat =
    mudou && principal.valido
      ? principal.faturamento - calcularFat(calc, faixas, baseN)
      : 0

  return (
    <div className="sim">
      <div className="sim-ctrl">
        <label className="sim-label" htmlFor="sim-margem">
          {unica ? 'Margem' : 'Margem mínima'}
        </label>
        <div className="sim-input">
          <button type="button" className="btn ghost sm" onClick={() => passo(-0.5)} aria-label="Diminuir 0,5 ponto">
            −
          </button>
          <NumInput id="sim-margem" value={viab.margem.minima} onChange={setMargem} suffix="%" placeholder="0" />
          <button type="button" className="btn ghost sm" onClick={() => passo(0.5)} aria-label="Aumentar 0,5 ponto">
            +
          </button>
        </div>
        <input
          type="range"
          min="0"
          max="40"
          step="0.5"
          value={Math.min(40, atual)}
          onChange={(e) => setMargem(txt(Number(e.target.value)))}
          aria-label="Margem"
          className="sim-range"
        />
        {!unica && (
          <span className="tiny muted">
            Mediana {fmtPct(faixas.mediana)} · Máxima {fmtPct(faixas.maxima)}
          </span>
        )}
      </div>
      <div className="sim-res">
        <div>
          <span>Faturamento ({unica ? 'meta única' : 'mínima'})</span>
          <strong>{principal.valido ? fmtBRL(principal.faturamento) : '—'}</strong>
          {mudou && principal.valido && (
            <em className={difFat >= 0 ? 'up' : 'down'}>
              {difFat >= 0 ? '+' : '−'}
              {fmtBRL(Math.abs(difFat))} vs. {fmtPct(baseN)}
            </em>
          )}
        </div>
        <div>
          <span>Lucro</span>
          <strong>{principal.valido ? fmtBRL(principal.lucro) : '—'}</strong>
        </div>
        <div>
          <span>Custo médico</span>
          <strong>{fmtBRL(calc.custoTotal)}</strong>
        </div>
      </div>
      {mudou && (
        <button type="button" className="link sim-reset" onClick={() => setMargem(base)}>
          Voltar para a margem informada ({fmtPct(baseN)})
        </button>
      )}
      {!principal.valido && principal.erro && <div className="alert">{principal.erro}</div>}
    </div>
  )
}

/** Faturamento com outra margem, para mostrar a diferença */
function calcularFat(calc, _faixas, margemPct) {
  const div = 1 - calc.taxPct / 100 - margemPct / 100
  return div > 0 && calc.custoTotal > 0 ? (calc.custoTotal + calc.despAdm) / div : 0
}
