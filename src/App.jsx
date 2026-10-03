import { useEffect, useState } from 'react'
import logo from './assets/arpen-logo.png'
import { loadDB, saveDB, exportBackup } from './lib/storage'
import ClientesPage from './components/ClientesPage'
import ViabilidadeWizard from './components/ViabilidadeWizard'
import EspecialidadesPage from './components/EspecialidadesPage'
import HistoricoPage from './components/HistoricoPage'
import PropostaView from './components/PropostaView'
import { Toast } from './components/ui'

const TABS = [
  { key: 'clientes', label: 'Clientes' },
  { key: 'especialidades', label: 'Especialidades' },
  { key: 'viabilidade', label: 'Viabilidade' },
  { key: 'historico', label: 'Histórico' },
]

export default function App() {
  const [db, setDbState] = useState(loadDB)
  const [tab, setTab] = useState('clientes')
  const [editando, setEditando] = useState(null) // viabilidade em edição (ou {clienteId})
  const [wizardKey, setWizardKey] = useState(0)
  const [proposta, setProposta] = useState(null)
  const [toast, setToast] = useState(null)
  const [filtroCliente, setFiltroCliente] = useState('')

  useEffect(() => saveDB(db), [db])

  const setDb = (fn) => setDbState((prev) => (typeof fn === 'function' ? fn(prev) : fn))
  const notify = (msg, tipo = 'ok') => setToast({ msg, tipo, t: Date.now() })

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
  const abrirHistorico = (clienteId = '') => {
    setFiltroCliente(clienteId)
    setTab('historico')
  }

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
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`tab ${tab === t.key ? 'active' : ''}`}
                onClick={() => (t.key === 'historico' ? abrirHistorico('') : setTab(t.key))}
              >
                {t.label}
                {t.key === 'historico' && db.viabilidades.length > 0 && (
                  <span className="badge">{db.viabilidades.length}</span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="container">
        {tab === 'clientes' && (
          <ClientesPage
            db={db}
            setDb={setDb}
            notify={notify}
            onIniciar={iniciarViabilidade}
            onHistorico={abrirHistorico}
          />
        )}
        {tab === 'especialidades' && <EspecialidadesPage db={db} setDb={setDb} notify={notify} />}
        {tab === 'viabilidade' && (
          <ViabilidadeWizard
            key={wizardKey}
            db={db}
            setDb={setDb}
            inicial={editando}
            notify={notify}
            onIrClientes={() => setTab('clientes')}
            onIrEspecialidades={() => setTab('especialidades')}
            onNova={() => iniciarViabilidade(null)}
            onSalvo={(v) => {
              setEditando(null)
              abrirHistorico(v.clienteId)
            }}
          />
        )}
        {tab === 'historico' && (
          <HistoricoPage
            db={db}
            setDb={setDb}
            notify={notify}
            filtroCliente={filtroCliente}
            setFiltroCliente={setFiltroCliente}
            onEditar={editarViabilidade}
            onProposta={setProposta}
            onNova={iniciarViabilidade}
          />
        )}
      </main>

      <footer className="footer">
        <span>Dados salvos neste navegador (banco interno local).</span>
        <button className="link" onClick={() => exportBackup(db)}>
          Exportar backup (.json)
        </button>
      </footer>

      {proposta && (
        <PropostaView
          viab={proposta}
          cliente={db.clientes.find((c) => c.id === proposta.clienteId)}
          onClose={() => setProposta(null)}
        />
      )}
      {toast && <Toast {...toast} onDone={() => setToast(null)} />}
    </div>
  )
}
