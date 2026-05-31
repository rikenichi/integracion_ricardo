/**
 * Botón estándar de MEDISTOCK.
 *
 * Envuelve las clases globales (.btn, .btn-primary, etc.) definidas en index.css
 * y agrega:
 *   - Estado loading con spinner inline
 *   - Variantes uniformes (primary | secondary | danger | success)
 *   - Tamaños (sm | lg) y modo block
 *   - Forwarding del resto de props nativas (type, onClick, disabled, title, ...)
 */
export default function Button({
  variant = 'primary',
  size,
  block,
  loading,
  disabled,
  children,
  className = '',
  type = 'button',
  ...rest
}) {
  const clases = [
    'btn',
    `btn-${variant}`,
    size ? `btn-${size}` : '',
    block ? 'btn-block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={clases} disabled={disabled || loading} {...rest}>
      {loading && <span className="spinner spinner-inline" aria-hidden="true" />}
      {children}
    </button>
  )
}
