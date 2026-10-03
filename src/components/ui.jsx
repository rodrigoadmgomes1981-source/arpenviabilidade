import { useEffect } from 'react'

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
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            ×
          </button>
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
