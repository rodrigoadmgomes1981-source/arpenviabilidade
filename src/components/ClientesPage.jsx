import { useMemo, useState } from 'react'
import { Card, Field, Confirm, Empty } from './ui'
import { maskTelefone, fmtDataCurta } from '../lib/format'
import ClienteDetalhe from './ClienteDetalhe'

const vazio = { nome: '', setor: '', telefone: '', contato: '' }

export default function ClientesPage(props) {
  const { db, acoes, notify, isAdmin, aberto, setAberto, onIniciar } = props
  const [form, setForm] = useState(vazio)
  const [erros, setErros] = useState({})
  const [busca, setBusca] = useState('')
  const [excluir, setExcluir] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return [...db.clientes]
      .filter((c) => !q || [c.nome, c.setor, c.contato, c.telefone].join(' ').toLowerCase().includes(q))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [db.clientes, busca])

  const cliente = aberto && db.clientes.find((c) => c.id === aberto)
  if (cliente) return <ClienteDetalhe {...props} cliente={cliente} onVoltar={() => setAberto(null)} onEditarCliente={(c) => { setAberto(null); setForm({ ...c }) }} />

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: k === 'telefone' ? maskTelefone(e.target.value) : e.target.value }))

  const salvar = async (e) => {
    e.preventDefault()
    const er = {}
    if (!form.nome.trim()) er.nome = 'Informe o nome do cliente'
    if (!form.setor.trim()) er.setor = 'Informe o setor do hospital'
    setErros(er)
    if (Object.keys(er).length) return
    setSalvando(true)
    try {
      await acoes.salvarCliente(form)
      notify(form.id ? 'Cliente atualizado' : 'Cliente cadastrado')
      setForm(vazio)
    } catch (err) {
      notify(err.message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  const qtdViab = (id) => db.viabilidades.filter((v) => v.clienteId === id).length

  return (
    <div className="grid-2">
      <Card title={form.id ? 'Editar cliente' : 'Novo cliente'} subtitle="Os clientes ficam no banco central do sistema.">
        <form onSubmit={salvar} className="form">
          <Field label="Nome do cliente *">
            <input id="c-nome" value={form.nome} onChange={set('nome')} placeholder="Ex.: Hospital Unimed Central" />
            {erros.nome && <span className="err">{erros.nome}</span>}
          </Field>
          <Field label="Setor do hospital *">
            <input id="c-setor" value={form.setor} onChange={set('setor')} placeholder="Ex.: Pronto Atendimento" />
            {erros.setor && <span className="err">{erros.setor}</span>}
          </Field>
          <div className="row-2">
            <Field label="Telefone do cliente">
              <input id="c-tel" value={form.telefone} onChange={set('telefone')} placeholder="(00) 00000-0000" />
            </Field>
            <Field label="Contato">
              <input id="c-contato" value={form.contato} onChange={set('contato')} placeholder="Nome / cargo" />
            </Field>
          </div>
          <div className="actions">
            {form.id && (
              <button type="button" className="btn ghost" onClick={() => setForm(vazio)}>
                Cancelar
              </button>
            )}
            <button className="btn primary" disabled={salvando}>
              {form.id ? 'Salvar alterações' : 'Cadastrar cliente'}
            </button>
          </div>
        </form>
      </Card>

      <Card
        title="Clientes"
        subtitle={`${db.clientes.length} cliente(s) cadastrado(s)`}
        actions={
          <input
            id="c-busca"
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
                <button className="client-main as-link" onClick={() => setAberto(c.id)}>
                  <strong>{c.nome}</strong>
                  <span className="muted">
                    {c.setor}
                    {c.contato && ` · ${c.contato}`}
                    {c.telefone && ` · ${c.telefone}`}
                  </span>
                  <span className="tiny muted">
                    Desde {fmtDataCurta(c.createdAt)} · {qtdViab(c.id)} viabilidade(s)
                  </span>
                </button>
                <div className="client-actions">
                  <button className="btn primary sm" onClick={() => setAberto(c.id)}>
                    Abrir cliente
                  </button>
                  <button className="btn ghost sm" onClick={() => onIniciar(c.id)}>
                    Iniciar viabilidade
                  </button>
                  {isAdmin && (
                    <>
                      <button className="btn ghost sm" onClick={() => setForm({ ...c })}>
                        Editar
                      </button>
                      <button className="btn ghost sm danger-text" onClick={() => setExcluir(c)}>
                        Excluir
                      </button>
                    </>
                  )}
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
          message={`Excluir "${excluir.nome}", as ${qtdViab(excluir.id)} viabilidade(s) e todo o histórico de interações? Esta ação não pode ser desfeita.`}
          onCancel={() => setExcluir(null)}
          onConfirm={async () => {
            try {
              await acoes.excluirCliente(excluir.id)
              notify('Cliente excluído')
            } catch (e) {
              notify(e.message, 'erro')
            }
            setExcluir(null)
          }}
        />
      )}
    </div>
  )
}
