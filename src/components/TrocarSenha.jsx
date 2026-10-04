import { useState } from 'react'
import { Modal, Field } from './ui'

export default function TrocarSenha({ obrigatoria, acoes, notify, onClose, onSair }) {
  const [f, setF] = useState({ atual: '', nova: '', nova2: '' })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const salvar = async () => {
    setErro('')
    if (f.nova.length < 8) return setErro('A nova senha precisa ter pelo menos 8 caracteres')
    if (f.nova !== f.nova2) return setErro('As senhas novas não conferem')
    setSalvando(true)
    try {
      await acoes.trocarMinhaSenha(f.atual, f.nova)
      notify('Senha alterada')
      onClose()
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      title={obrigatoria ? 'Crie sua senha pessoal' : 'Alterar minha senha'}
      onClose={obrigatoria ? undefined : onClose}
      footer={
        <>
          {obrigatoria ? (
            <button className="btn ghost" onClick={onSair}>
              Sair
            </button>
          ) : (
            <button className="btn ghost" onClick={onClose}>
              Cancelar
            </button>
          )}
          <button className="btn primary" disabled={salvando} onClick={salvar}>
            {salvando ? 'Salvando…' : 'Salvar senha'}
          </button>
        </>
      }
    >
      <div className="form">
        {obrigatoria && (
          <p className="muted">Você entrou com a senha gerada pelo administrador. Defina agora uma senha só sua.</p>
        )}
        <Field label={obrigatoria ? 'Senha recebida do administrador' : 'Senha atual'}>
          <input id="senha-atual" type="password" value={f.atual} onChange={set('atual')} autoComplete="current-password" />
        </Field>
        <Field label="Nova senha" hint="Mínimo de 8 caracteres.">
          <input id="senha-nova" type="password" value={f.nova} onChange={set('nova')} autoComplete="new-password" />
        </Field>
        <Field label="Confirme a nova senha">
          <input id="senha-nova2" type="password" value={f.nova2} onChange={set('nova2')} autoComplete="new-password" />
        </Field>
        {erro && <div className="alert">{erro}</div>}
      </div>
    </Modal>
  )
}
