import { createContext, useCallback, useContext, useRef, useState } from 'react'

/**
 * Sistema de notificaciones flotantes (toasts) reusable.
 *
 * Uso desde cualquier componente:
 *   const { mostrarToast } = useToast()
 *   mostrarToast('Producto agregado al carrito')        // tipo por defecto: 'success'
 *   mostrarToast('Stock agotado', 'error')
 *   mostrarToast('Sincronizando...', 'info', 5000)      // duración personalizada en ms
 *
 * Renderiza con <ToastViewport /> debajo del árbol envuelto.
 */

const ToastContext = createContext(null)

let idCounter = 0
const nuevoId = () => ++idCounter

const DURACION_DEFAULT_MS = 5000

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef(new Map())

  const cerrar = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const mostrarToast = useCallback((mensaje, tipo = 'success', duracion = DURACION_DEFAULT_MS) => {
    if (!mensaje) return
    const id = nuevoId()
    setToasts((prev) => [...prev, { id, mensaje, tipo }])
    const timer = setTimeout(() => cerrar(id), duracion)
    timersRef.current.set(id, timer)
    return id
  }, [cerrar])

  return (
    <ToastContext.Provider value={{ mostrarToast, cerrar, toasts }}>
      {children}
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  // Si el provider no envuelve este árbol (poco común), degradamos silenciosamente.
  if (!ctx) return { mostrarToast: () => {}, cerrar: () => {}, toasts: [] }
  return ctx
}
