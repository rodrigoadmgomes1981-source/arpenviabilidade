import { useState } from 'react'
import { Card, Field, Modal, Empty, CopyButton, PERFIS } from './ui'
import { fmtData } from '../lib/format'

const vazio = { nome: '', email: '', login: '', perfil: 'operador' }

const DESCR = {
  admin: 'Gerencia tudo: configurações, especialidades, usuários, dashboard, edição e exclusão de clientes.',
  operador: 'Faz viabilidades, emite propostas, consulta o histórico e registra observações nos clientes.',
}

export default function UsuariosPage({ db, acoes, notify, usuario }) {
  const [form, setForm] = useState(vazio)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [credencial, setCredencial] = useState(null) // { usuario, senha, nova }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const salvar = async (e) => {
    e.preventDefault()
    setErro('')
    if (!form.nome.trim()) return setErro('Informe o nome')
    setSalvando(true)
    try {
      if (form.id) {
        await acoes.atualizarUsuario(form)
        notify('Usuário atualizado')
      } else {
        const r = await acoes.criarUsuario(form)
        setCredencial({ ...r, nova: true })
      }
      setForm(vazio)
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  const alternarAtivo = async (u) => {
    try {
      await acoes.atualizarUsuario({ ...u, ativo: !u.ativo })
      notify(u.ativo ? 'Usuário desativado' : 'Usuário reativado')
    } catch (e) {
      notify(e.message, 'erro')
    }
  }

  const resetar = async (u) => {
    try {
      const r = await acoes.resetarSenha(u.id)
      setCredencial({ ...r, nova: false })
    } catch (e) {
      notify(e.message, 'erro')
    }
  }

  return (
    <div className="grid-2">
      <Card
        title={form.id ? 'Editar usuário' : 'Novo usuário'}
        subtitle={form.id ? form.login : 'O sistema gera o login e uma senha provisória.'}
      >
        <form className="form" onSubmit={salvar}>
          <Field label="Nome completo *">
            <input id="u-nome" value={form.nome} onChange={set('nome')} placeholder="Ex.: Maria da Silva" />
          </Field>
          <Field label="E-mail" hint="Opcional. Também pode ser usado para entrar.">
            <input id="u-email" type="email" value={form.email} onChange={set('email')} />
          </Field>
          {!form.id && (
            <Field label="Login" hint="Deixe em branco para gerar automaticamente (ex.: maria.silva).">
              <input id="u-login" value={form.login} onChange={set('login')} placeholder="automático" />
            </Field>
          )}
          <div className="field">
            <span className="field-label">Perfil *</span>
            <div className="perfil-opts">
              {['operador', 'admin'].map((p) => (
                <label key={p} className={`perfil-opt ${form.perfil === p ? 'on' : ''}`}>
                  <input
                    type="radio"
                    name="perfil"
                    value={p}
                    checked={form.perfil === p}
                    onChange={() => setForm((f) => ({ ...f, perfil: p }))}
                  />
                  <strong>{PERFIS[p]}</strong>
                  <span className="tiny muted">{DESCR[p]}</span>
                </label>
              ))}
            </div>
          </div>
          {erro && <div className="alert">{erro}</div>}
          <div className="actions">
            {form.id && (
              <button type="button" className="btn ghost" onClick={() => setForm(vazio)}>
                Cancelar
              </button>
            )}
            <button className="btn primary" disabled={salvando}>
              {salvando ? 'Salvando…' : form.id ? 'Salvar alterações' : 'Criar usuário e gerar senha'}
            </button>
          </div>
        </form>
      </Card>

      <Card title="Usuários" subtitle={`${db.usuarios.filter((u) => u.ativo).length} ativo(s) de ${db.usuarios.length}`}>
        {db.usuarios.length === 0 ? (
          <Empty title="Nenhum usuário" />
        ) : (
          <ul className="client-list">
            {db.usuarios.map((u) => (
              <li key={u.id} className={`client-item ${u.ativo ? '' : 'is-off'}`}>
                <div className="client-main">
                  <strong>
                    {u.nome} {u.id === usuario.id && <span className="pill">você</span>}
                  </strong>
                  <span className="muted">
                    {u.login}
                    {u.email && ` · ${u.email}`}
                  </span>
                  <span className="esp-cad-tags">
                    <span className={`pill ${u.perfil === 'admin' ? 'info' : ''}`}>{PERFIS[u.perfil]}</span>
                    {!u.ativo && <span className="pill danger">Desativado</span>}
                    {u.trocarSenha && u.ativo && <span className="pill warn">Senha provisória</span>}
                    <span className="tiny muted">
                      Último acesso: {u.ultimoAcesso ? fmtData(u.ultimoAcesso) : 'nunca'}
                    </span>
                  </span>
                </div>
                <div className="client-actions">
                  <button className="btn ghost sm" onClick={() => setForm({ ...u, email: u.email || '' })}>
                    Editar
                  </button>
                  <button className="btn ghost sm" onClick={() => resetar(u)}>
                    Gerar nova senha
                  </button>
                  {u.id !== usuario.id && (
                    <button className={`btn ghost sm ${u.ativo ? 'danger-text' : ''}`} onClick={() => alternarAtivo(u)}>
                      {u.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {credencial && (
        <Modal
          title={credencial.nova ? 'Usuário criado' : 'Nova senha gerada'}
          onClose={() => setCredencial(null)}
          footer={
            <button className="btn primary" onClick={() => setCredencial(null)}>
              Concluir
            </button>
          }
        >
          <p>
            Envie estes dados para <strong>{credencial.usuario.nome}</strong>. A senha aparece só agora; no primeiro
            acesso o sistema pede para criar uma senha pessoal.
          </p>
          <div className="cred">
            <div>
              <span>Login</span>
              <code>{credencial.usuario.login}</code>
            </div>
            <div>
              <span>Senha provisória</span>
              <code>{credencial.senha}</code>
            </div>
            <div>
              <span>Perfil</span>
              <strong>{PERFIS[credencial.usuario.perfil]}</strong>
            </div>
          </div>
          <div className="actions" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
            <CopyButton
              label="Copiar dados de acesso"
              texto={`Acesso ao sistema Arpen – Viabilidade & Propostas\nEndereço: ${location.origin}\nLogin: ${credencial.usuario.login}\nSenha provisória: ${credencial.senha}`}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
