import { useToast } from '../context/ToastContext'
import './ToastViewport.css'

const ICONO_POR_TIPO = {
  success: '✓',
  error: '⚠',
  info: 'ℹ',
  warning: '!',
}

/**
 * Renderiza la pila de toasts en la parte inferior centrada de la pantalla.
 * Colócalo una sola vez al nivel raíz de la app (después del Navbar).
 */
export default function ToastViewport() {
  const { toasts, cerrar } = useToast()
  if (!toasts.length) return null

  return (
    <div className="toast-viewport" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tipo}`}>
          <span className="toast-icono" aria-hidden="true">{ICONO_POR_TIPO[t.tipo] || '•'}</span>
          <span className="toast-mensaje">{t.mensaje}</span>
          <button
            type="button"
            className="toast-cerrar"
            onClick={() => cerrar(t.id)}
            aria-label="Cerrar notificación"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
