import { useMemo, useState } from 'react'
import { Card, Field, Confirm, Empty } from './ui'
import { upsertCliente, removeCliente } from '../lib/storage'
import { maskTelefone, fmtDataCurta } from '../lib/format'

const vazio = { nome: '', setor: '', telefone: '', contato: '' }

export default function ClientesPage({ db, setDb, notify, onIniciar, onHistorico }) {
  const [form, setForm] = useState(vazio)
  const [erros, setErros] = useState({})
  const [busca, setBusca] = useState('')
  const [excluir, setExcluir] = useState(null)

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: k === 'telefone' ? maskTelefone(e.target.value) : e.target.value }))

  const salvar = (e) => {
    e.preventDefault()
    const er = {}
    if (!form.nome.trim()) er.nome = 'Informe o nome do cliente'
    if (!form.setor.trim()) er.setor = 'Informe o setor do hospital'
    setErros(er)
    if (Object.keys(er).length) return
    setDb((d) => upsertCliente(d, { ...form, nome: form.nome.trim(), setor: form.setor.trim() }))
    notify(form.id ? 'Cliente atualizado' : 'Cliente cadastrado')
    setForm(vazio)
  }

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return [...db.clientes]
      .filter((c) => !q || [c.nome, c.setor, c.contato, c.telefone].join(' ').toLowerCase().includes(q))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [db.clientes, busca])

  const qtdViab = (id) => db.viabilidades.filter((v) => v.clienteId === id).length

  return (
    <div className="grid-2">
      <Card
        title={form.id ? 'Editar cliente' : 'Novo cliente'}
        subtitle="Os clientes ficam salvos no banco interno do sistema."
      >
        <form onSubmit={salvar} className="form">
          <Field label="Nome do cliente *">
            <input value={form.nome} onChange={set('nome')} placeholder="Ex.: Hospital Unimed Central" />
            {erros.nome && <span className="err">{erros.nome}</span>}
          </Field>
          <Field label="Setor do hospital *">
            <input value={form.setor} onChange={set('setor')} placeholder="Ex.: Pronto Atendimento" />
            {erros.setor && <span className="err">{erros.setor}</span>}
          </Field>
          <div className="row-2">
            <Field label="Telefone do cliente">
              <input value={form.telefone} onChange={set('telefone')} placeholder="(00) 00000-0000" />
            </Field>
            <Field label="Contato">
              <input value={form.contato} onChange={set('contato')} placeholder="Nome / cargo" />
            </Field>
          </div>
          <div className="actions">
            {form.id && (
              <button type="button" className="btn ghost" onClick={() => setForm(vazio)}>
                Cancelar
              </button>
            )}
            <button className="btn primary">{form.id ? 'Salvar alterações' : 'Cadastrar cliente'}</button>
          </div>
        </form>
      </Card>

      <Card
        title="Banco de clientes"
        subtitle={`${db.clientes.length} cliente(s) cadastrado(s)`}
        actions={
          <input
            className="search"
            placeholder="Buscar cliente…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        }
      >
        {lista.length === 0 ? (
          <Empty title={db.clientes.length ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}>
            Cadastre o primeiro cliente ao lado.
          </Empty>
        ) : (
          <ul className="client-list">
            {lista.map((c) => (
              <li key={c.id} className="client-item">
                <div className="client-main">
                  <strong>{c.nome}</strong>
                  <span className="muted">
                    {c.setor}
                    {c.contato && ` · ${c.contato}`}
                    {c.telefone && ` · ${c.telefone}`}
                  </span>
                  <span className="tiny muted">
                    Desde {fmtDataCurta(c.createdAt)} · {qtdViab(c.id)} viabilidade(s)
                  </span>
                </div>
                <div className="client-actions">
                  <button className="btn primary sm" onClick={() => onIniciar(c.id)}>
                    Iniciar viabilidade
                  </button>
                  <button className="btn ghost sm" onClick={() => onHistorico(c.id)}>
                    Histórico
                  </button>
                  <button className="btn ghost sm" onClick={() => setForm({ ...c })}>
                    Editar
                  </button>
                  <button className="btn ghost sm danger-text" onClick={() => setExcluir(c)}>
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {excluir && (
        <Confirm
          title="Excluir cliente"
          danger
          confirmLabel="Excluir"
          message={`Excluir "${excluir.nome}" e as ${qtdViab(excluir.id)} viabilidade(s) vinculadas? Esta ação não pode ser desfeita.`}
          onCancel={() => setExcluir(null)}
          onConfirm={() => {
            setDb((d) => removeCliente(d, excluir.id))
            notify('Cliente excluído')
            setExcluir(null)
          }}
        />
      )}
    </div>
  )
}
