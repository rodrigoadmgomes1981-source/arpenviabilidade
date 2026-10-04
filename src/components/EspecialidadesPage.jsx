import { useMemo, useState } from 'react'
import { Card, Field, Confirm, Empty } from './ui'
import { catalogoEspecialidades, existeEspecialidade } from '../data/especialidades'

const vazio = { nome: '', descricao: '' }
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

const FILTROS = [
  { key: 'todas', label: 'Todas' },
  { key: 'PROPRIA', label: 'Cadastradas' },
  { key: 'CFM', label: 'CFM' },
  { key: 'ocultas', label: 'Ocultas' },
]

export default function EspecialidadesPage({ db, acoes, notify }) {
  const [form, setForm] = useState(vazio)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todas')
  const [excluir, setExcluir] = useState(null)

  const todas = useMemo(() => catalogoEspecialidades(db, { incluirOcultas: true }), [db])
  const ocultas = useMemo(() => new Set(db.ocultas), [db.ocultas])

  const lista = todas.filter((e) => {
    if (busca && !norm(e.nome).includes(norm(busca))) return false
    if (filtro === 'ocultas') return ocultas.has(e.nome)
    if (filtro !== 'todas') return e.origem === filtro
    return true
  })

  const usoEm = (nome) => db.viabilidades.filter((v) => v.itens.some((i) => i.especialidade === nome)).length

  const salvar = async (e) => {
    e.preventDefault()
    const nome = form.nome.trim()
    if (!nome) return setErro('Informe o nome da especialidade')
    if (existeEspecialidade(todas, nome, form.id)) return setErro('Já existe uma especialidade com esse nome')
    setErro('')
    try {
      await acoes.salvarEspecialidade({ ...form, nome, descricao: form.descricao.trim() })
      notify(form.id ? 'Especialidade atualizada' : 'Especialidade cadastrada')
      setForm(vazio)
    } catch (err) {
      setErro(err.message)
    }
  }

  const qtdProprias = db.especialidades.length

  return (
    <div className="grid-2">
      <Card
        title={form.id ? 'Editar especialidade' : 'Nova especialidade'}
        subtitle="Cadastre especialidades, áreas de atuação ou serviços que não estão na lista do CFM."
      >
        <form onSubmit={salvar} className="form">
          <Field label="Nome *">
            <input
              id="esp-nome"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex.: Coordenação Clínica, Medicina Paliativa, Laudo de EEG"
            />
            {erro && <span className="err">{erro}</span>}
          </Field>
          <Field label="Descrição" hint="Opcional. Aparece só aqui no cadastro.">
            <textarea
              id="esp-desc"
              rows={3}
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              placeholder="Ex.: 40 h/mês de coordenação da equipe do PA"
            />
          </Field>
          <div className="actions">
            {form.id && (
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setForm(vazio)
                  setErro('')
                }}
              >
                Cancelar
              </button>
            )}
            <button className="btn primary">{form.id ? 'Salvar alterações' : 'Cadastrar especialidade'}</button>
          </div>
        </form>
        <p className="tiny muted note">
          As especialidades cadastradas aparecem na etapa “Especialidades” da viabilidade, com os botões COM RQE e
          COM PÓS. Especialidades ocultas deixam de aparecer na viabilidade, mas continuam nas viabilidades já salvas.
        </p>
      </Card>

      <Card
        title="Cadastro de especialidades"
        subtitle={`${todas.length - ocultas.size} ativas · ${qtdProprias} cadastrada(s) por você · ${ocultas.size} oculta(s)`}
        actions={
          <input
            id="esp-busca"
            className="search"
            placeholder="Buscar especialidade…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        }
      >
        <div className="filter-chips">
          {FILTROS.map((f) => (
            <button key={f.key} className={`chip ${filtro === f.key ? 'on' : ''}`} onClick={() => setFiltro(f.key)}>
              {f.label}
            </button>
          ))}
        </div>

        {lista.length === 0 ? (
          <Empty title={filtro === 'PROPRIA' && !qtdProprias ? 'Nenhuma especialidade cadastrada' : 'Nada encontrado'}>
            {filtro === 'PROPRIA' && !qtdProprias && 'Use o formulário ao lado para cadastrar a primeira.'}
          </Empty>
        ) : (
          <ul className="esp-cad-list">
            {lista.map((e) => {
              const oculta = ocultas.has(e.nome)
              return (
                <li key={`${e.origem}-${e.id || e.nome}`} className={`esp-cad ${oculta ? 'is-hidden' : ''}`}>
                  <div className="esp-cad-main">
                    <strong>{e.nome}</strong>
                    <span className="esp-cad-tags">
                      <span className={`pill ${e.origem === 'CFM' ? '' : 'ok'}`}>
                        {e.origem === 'CFM' ? 'CFM' : 'Cadastrada'}
                      </span>
                      {oculta && <span className="pill warn">Oculta</span>}
                      {e.descricao && <span className="muted tiny">{e.descricao}</span>}
                    </span>
                  </div>
                  <div className="client-actions">
                    {e.origem === 'PROPRIA' && (
                      <button
                        className="btn ghost sm"
                        onClick={() => {
                          setForm({ id: e.id, nome: e.nome, descricao: e.descricao || '' })
                          setErro('')
                        }}
                      >
                        Editar
                      </button>
                    )}
                    <button className="btn ghost sm" onClick={() => acoes.ocultar(e.nome, !oculta).catch((er) => notify(er.message, 'erro'))}>
                      {oculta ? 'Mostrar' : 'Ocultar'}
                    </button>
                    {e.origem === 'PROPRIA' && (
                      <button className="btn ghost sm danger-text" onClick={() => setExcluir(e)}>
                        Excluir
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {excluir && (
        <Confirm
          title="Excluir especialidade"
          danger
          confirmLabel="Excluir"
          message={
            usoEm(excluir.nome)
              ? `"${excluir.nome}" aparece em ${usoEm(excluir.nome)} viabilidade(s) salva(s). Elas continuam como estão; a especialidade só deixa de aparecer para novas viabilidades.`
              : `Excluir "${excluir.nome}" do cadastro?`
          }
          onCancel={() => setExcluir(null)}
          onConfirm={async () => {
            try {
              await acoes.excluirEspecialidade(excluir.id)
            } catch (er) {
              notify(er.message, 'erro')
              return setExcluir(null)
            }
            notify('Especialidade excluída')
            setExcluir(null)
          }}
        />
      )}
    </div>
  )
}
