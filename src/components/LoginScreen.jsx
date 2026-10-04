import { useState } from 'react'
import logo from '../assets/arpen-logo.png'
import { Field } from './ui'
import { post } from '../lib/api'

/** Tela de entrada. Com `setup`, cria o primeiro administrador do sistema. */
export default function LoginScreen({ setup, onEntrou }) {
  const [f, setF] = useState({ nome: '', login: '', email: '', senha: '', senha2: '' })
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const enviar = async (e) => {
    e.preventDefault()
    setErro('')
    if (setup) {
      if (!f.nome.trim() || !f.login.trim()) return setErro('Informe nome e login')
      if (f.senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres')
      if (f.senha !== f.senha2) return setErro('As senhas não conferem')
    }
    setEnviando(true)
    try {
      const r = setup
        ? await post('/auth/setup', { nome: f.nome, login: f.login, email: f.email, senha: f.senha })
        : await post('/auth/login', { login: f.login, senha: f.senha })
      onEntrou(r.usuario)
    } catch (err) {
      setErro(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={enviar}>
        <img src={logo} alt="Arpen" className="login-logo" />
        <h1>{setup ? 'Configuração inicial' : 'Viabilidade & Propostas'}</h1>
        <p className="muted">
          {setup
            ? 'Crie o primeiro administrador. Depois ele cadastra os demais usuários.'
            : 'Entre com o login e a senha fornecidos pelo administrador.'}
        </p>
        {setup && (
          <Field label="Nome completo">
            <input id="setup-nome" value={f.nome} onChange={set('nome')} autoComplete="name" />
          </Field>
        )}
        <Field label={setup ? 'Login' : 'Login ou e-mail'}>
          <input id="login" value={f.login} onChange={set('login')} autoComplete="username" autoFocus />
        </Field>
        {setup && (
          <Field label="E-mail (opcional)">
            <input id="setup-email" type="email" value={f.email} onChange={set('email')} autoComplete="email" />
          </Field>
        )}
        <Field label="Senha">
          <input
            id="senha"
            type="password"
            value={f.senha}
            onChange={set('senha')}
            autoComplete={setup ? 'new-password' : 'current-password'}
          />
        </Field>
        {setup && (
          <Field label="Confirme a senha">
            <input id="senha2" type="password" value={f.senha2} onChange={set('senha2')} autoComplete="new-password" />
          </Field>
        )}
        {erro && <div className="alert">{erro}</div>}
        <button className="btn primary full" disabled={enviando}>
          {enviando ? 'Aguarde…' : setup ? 'Criar administrador e entrar' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
