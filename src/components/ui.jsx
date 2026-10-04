import { useEffect, useState } from 'react'

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function NumInput({ value, onChange, prefix, suffix, placeholder, ...rest }) {
  return (
    <div className="num-input">
      {prefix && <span className="affix">{prefix}</span>}
      <input
        inputMode="decimal"
        value={value ?? ''}
        placeholder={placeholder || '0,00'}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,-]/g, ''))}
        {...rest}
      />
      {suffix && <span className="affix">{suffix}</span>}
    </div>
  )
}

export function Card({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function Modal({ title, children, onClose, footer, wide }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          {onClose && (
            <button className="icon-btn" onClick={onClose} aria-label="Fechar">
              ×
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Confirm({ title, message, confirmLabel = 'Confirmar', danger, onConfirm, onCancel }) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  )
}

export function Toast({ msg, tipo, t, onDone }) {
  useEffect(() => {
    const id = setTimeout(onDone, 3200)
    return () => clearTimeout(id)
  }, [t, onDone])
  return <div className={`toast ${tipo}`}>{msg}</div>
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <div className="empty-mark" aria-hidden="true" />
      <strong>{title}</strong>
      {children && <div className="muted">{children}</div>}
    </div>
  )
}

/** Markdown simples: ## títulos, listas "- ", **negrito** */
export function Markdown({ texto }) {
  const blocos = []
  let lista = null
  const inline = (t, k) =>
    t.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
      p.startsWith('**') && p.endsWith('**') ? <strong key={`${k}-${i}`}>{p.slice(2, -2)}</strong> : p,
    )
  String(texto || '')
    .split('\n')
    .forEach((linha, i) => {
      const l = linha.trim()
      if (/^[-*•]\s+/.test(l)) {
        if (!lista) {
          lista = []
          blocos.push({ tipo: 'ul', itens: lista, k: i })
        }
        lista.push(l.replace(/^[-*•]\s+/, ''))
        return
      }
      lista = null
      if (!l) return
      if (/^#{1,4}\s+/.test(l)) blocos.push({ tipo: 'h', t: l.replace(/^#+\s+/, ''), k: i })
      else blocos.push({ tipo: 'p', t: l, k: i })
    })
  return (
    <div className="md">
      {blocos.map((b) =>
        b.tipo === 'ul' ? (
          <ul key={b.k}>
            {b.itens.map((it, j) => (
              <li key={j}>{inline(it, `${b.k}-${j}`)}</li>
            ))}
          </ul>
        ) : b.tipo === 'h' ? (
          <h4 key={b.k}>{inline(b.t, b.k)}</h4>
        ) : (
          <p key={b.k}>{inline(b.t, b.k)}</p>
        ),
      )}
    </div>
  )
}

export function CopyButton({ texto, label = 'Copiar' }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      type="button"
      className="btn ghost sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto)
          setOk(true)
          setTimeout(() => setOk(false), 1500)
        } catch {
          /* clipboard indisponível: o texto fica selecionável na tela */
        }
      }}
    >
      {ok ? 'Copiado' : label}
    </button>
  )
}

export const PERFIS = { admin: 'Administrador', operador: 'Operador' }
