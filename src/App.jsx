import { useCallback, useEffect, useState } from 'react'
import logo from './assets/arpen-logo.png'
import { get, post, setOnUnauthorized } from './lib/api'
import { useStore } from './lib/store'
import LoginScreen from './components/LoginScreen'
import DashboardPage from './components/DashboardPage'
import ClientesPage from './components/ClientesPage'
import ViabilidadeWizard from './components/ViabilidadeWizard'
import EspecialidadesPage from './components/EspecialidadesPage'
import HistoricoPage from './components/HistoricoPage'
import UsuariosPage from './components/UsuariosPage'
import ConfigPage from './components/ConfigPage'
import PropostaView from './components/PropostaView'
import TrocarSenha from './components/TrocarSenha'
import { Toast, PERFIS } from './components/ui'

const TABS = [
  { key: 'dashboard', label: 'Dashboard', admin: true },
  { key: 'clientes', label: 'Clientes' },
  { key: 'viabilidade', label: 'Viabilidade' },
  { key: 'historico', label: 'Histórico' },
  { key: 'especialidades', label: 'Especialidades', admin: true },
  { key: 'usuarios', label: 'Usuários', admin: true },
  { key: 'config', label: 'Configurações', admin: true },
]

export default function App() {
  const [auth, setAuth] = useState({ estado: 'carregando' }) // carregando | setup | login | ok | erro
  const { db, carregado, acoes } = useStore()
  const [tab, setTab] = useState('clientes')
  const [editando, setEditando] = useState(null)
  const [wizardKey, setWizardKey] = useState(0)
  const [proposta, setProposta] = useState(null)
  const [toast, setToast] = useState(null)
  const [filtroCliente, setFiltroCliente] = useState('')
  const [clienteAberto, setClienteAberto] = useState(null)
  const [menu, setMenu] = useState(false)
  const [trocarSenha, setTrocarSenha] = useState(false)

  const notify = useCallback((msg, tipo = 'ok') => setToast({ msg, tipo, t: Date.now() }), [])
  const usuario = auth.usuario
  const isAdmin = usuario?.perfil === 'admin'

  const entrar = useCallback(
    async (u) => {
      setAuth({ estado: 'ok', usuario: u })
      setTab(u.perfil === 'admin' ? 'dashboard' : 'clientes')
      try {
        await acoes.carregar()
      } catch (e) {
        notify(e.message, 'erro')
      }
    },
    [acoes, notify],
  )

  useEffect(() => {
    setOnUnauthorized(() => {
      acoes.limpar()
      setAuth({ estado: 'login' })
    })
    get('/auth/status')
      .then((s) => {
        if (s.precisaConfigurar) setAuth({ estado: 'setup' })
        else if (s.usuario) entrar(s.usuario)
        else setAuth({ estado: 'login' })
      })
      .catch((e) => setAuth({ estado: 'erro', erro: e.message }))
  }, [acoes, entrar])

  const sair = async () => {
    await post('/auth/logout').catch(() => {})
    acoes.limpar()
    setMenu(false)
    setAuth({ estado: 'login' })
  }

  if (auth.estado === 'carregando') return <div className="splash"><img src={logo} alt="Arpen" /></div>
  if (auth.estado === 'erro')
    return (
      <div className="splash">
        <img src={logo} alt="Arpen" />
        <p className="alert">Não foi possível conectar ao servidor: {auth.erro}</p>
        <button className="btn primary" onClick={() => location.reload()}>Tentar de novo</button>
      </div>
    )
  if (auth.estado === 'setup' || auth.estado === 'login')
    return <LoginScreen setup={auth.estado === 'setup'} onEntrou={entrar} />

  const tabs = TABS.filter((t) => !t.admin || isAdmin)
  const ir = (key) => {
    setTab(key)
    if (key === 'historico') setFiltroCliente('')
    if (key === 'clientes') setClienteAberto(null)
  }
  const iniciarViabilidade = (clienteId) => {
    setEditando(clienteId ? { clienteId } : null)
    setWizardKey((k) => k + 1)
    setTab('viabilidade')
  }
  const editarViabilidade = (v) => {
    setEditando(v)
    setWizardKey((k) => k + 1)
    setTab('viabilidade')
  }
  const abrirCliente = (id) => {
    setClienteAberto(id)
    setTab('clientes')
  }

  const ctx = { db, acoes, notify, usuario, isAdmin }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <img src={logo} alt="Arpen" className="brand-logo" />
            <span className="brand-sep" />
            <span className="brand-title">Viabilidade &amp; Propostas</span>
          </div>
          <nav className="tabs">
            {tabs.map((t) => (
              <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => ir(t.key)}>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="user-menu">
            <button className="user-btn" onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
              <span className="avatar">{usuario.nome.slice(0, 1).toUpperCase()}</span>
              <span className="user-txt">
                <strong>{usuario.nome.split(' ')[0]}</strong>
                <span>{PERFIS[usuario.perfil]}</span>
              </span>
            </button>
            {menu && (
              <div className="user-pop" onMouseLeave={() => setMenu(false)}>
                <div className="user-pop-head">
                  <strong>{usuario.nome}</strong>
                  <span className="muted tiny">
                    {usuario.login} · {PERFIS[usuario.perfil]}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setTrocarSenha(true)
                    setMenu(false)
                  }}
                >
                  Alterar minha senha
                </button>
                <button onClick={sair}>Sair</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container">
        {!carregado ? (
          <p className="muted">Carregando dados…</p>
        ) : (
          <>
            {tab === 'dashboard' && isAdmin && <DashboardPage {...ctx} onAbrirCliente={abrirCliente} />}
            {tab === 'clientes' && (
              <ClientesPage
                {...ctx}
                aberto={clienteAberto}
                setAberto={setClienteAberto}
                onIniciar={iniciarViabilidade}
                onEditar={editarViabilidade}
                onProposta={setProposta}
              />
            )}
            {tab === 'viabilidade' && (
              <ViabilidadeWizard
                key={wizardKey}
                {...ctx}
                inicial={editando}
                onIrClientes={() => ir('clientes')}
                onIrEspecialidades={() => ir('especialidades')}
                onNova={() => iniciarViabilidade(null)}
                onSalvo={(v) => {
                  setEditando(null)
                  setFiltroCliente(v.clienteId)
                  setTab('historico')
                }}
              />
            )}
            {tab === 'historico' && (
              <HistoricoPage
                {...ctx}
                filtroCliente={filtroCliente}
                setFiltroCliente={setFiltroCliente}
                onEditar={editarViabilidade}
                onProposta={setProposta}
                onNova={iniciarViabilidade}
                onAbrirCliente={abrirCliente}
              />
            )}
            {tab === 'especialidades' && isAdmin && <EspecialidadesPage {...ctx} />}
            {tab === 'usuarios' && isAdmin && <UsuariosPage {...ctx} />}
            {tab === 'config' && isAdmin && <ConfigPage {...ctx} />}
          </>
        )}
      </main>

      {proposta && (
        <PropostaView
          {...ctx}
          viab={db.viabilidades.find((v) => v.id === proposta.id) || proposta}
          cliente={db.clientes.find((c) => c.id === proposta.clienteId)}
          onClose={() => setProposta(null)}
        />
      )}
      {(trocarSenha || usuario.trocarSenha) && (
        <TrocarSenha
          obrigatoria={usuario.trocarSenha}
          acoes={acoes}
          notify={notify}
          onClose={() => {
            setTrocarSenha(false)
            if (usuario.trocarSenha) setAuth((a) => ({ ...a, usuario: { ...a.usuario, trocarSenha: false } }))
          }}
          onSair={sair}
        />
      )}
      {toast && <Toast {...toast} onDone={() => setToast(null)} />}
    </div>
  )
}
