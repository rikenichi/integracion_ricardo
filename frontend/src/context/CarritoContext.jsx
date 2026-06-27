import { createContext, useContext, useState, useEffect } from 'react'
import { puedeComprar, razonNoCompra } from '../utils/permisos'
import { useToast } from './ToastContext'
import { obtenerPrecioProducto } from '../utils/format'

const CarritoContext = createContext(null)

function usuarioActualGuardado() {
  try {
    const usuarioRaw = localStorage.getItem('usuario')
    if (!usuarioRaw) return null
    return JSON.parse(usuarioRaw)
  } catch {
    return null
  }
}

// IVA Chile 19%, ya incluido en el precio del producto.
// El costo de despacho se cotiza dinamicamente con Chilexpress en el checkout
// (ConfirmacionPedidoPage), ya que depende de la comuna y el peso del pedido.
// El carrito muestra "se calcula al confirmar" en vez de un monto fijo.
export const IVA = 0.19

export function CarritoProvider({ children }) {
  const { mostrarToast } = useToast()
  const [items, setItems] = useState(() => {
    const stored = localStorage.getItem('carrito')
    return stored ? JSON.parse(stored) : []
  })

  const [tipoDespacho, setTipoDespachoEstado] = useState(() => {
    return localStorage.getItem('carrito_tipo_despacho') || 'domicilio'
  })

  useEffect(() => {
    localStorage.setItem('carrito', JSON.stringify(items))
  }, [items])

  useEffect(() => {
    localStorage.setItem('carrito_tipo_despacho', tipoDespacho)
  }, [tipoDespacho])

  const setTipoDespacho = (valor) => {
    if (valor === 'domicilio' || valor === 'retiro') setTipoDespachoEstado(valor)
  }

  const agregarItem = (producto, cantidad = 1) => {
    // Defensa central #1: solo roles autorizados pueden comprar.
    const usuario = usuarioActualGuardado()
    if (usuario && !puedeComprar(usuario)) {
      console.warn(`No se agrego al carrito: el rol "${usuario.rol || usuario.rol_backend || 'desconocido'}" no tiene permitido comprar.`)
      mostrarToast(razonNoCompra(usuario), 'error')
      return false
    }

    // Defensa central #2: nunca permitir productos sin stock en el carrito.
    const stockDisponible = Number(producto?.stock_disponible ?? producto?.stock ?? 0)
    if (stockDisponible <= 0) {
      console.warn(`No se agrego al carrito "${producto?.nombre}": stock agotado.`)
      mostrarToast(`"${producto?.nombre || 'Producto'}" esta agotado`, 'error')
      return false
    }

    setItems(prev => {
      const existe = prev.find(i => i.producto.id === producto.id)
      const cantidadActual = existe ? existe.cantidad : 0
      const cantidadFinal = Math.min(cantidadActual + cantidad, stockDisponible)
      if (existe) {
        return prev.map(i =>
          i.producto.id === producto.id ? { ...i, cantidad: cantidadFinal } : i
        )
      }
      return [...prev, { producto, cantidad: Math.min(cantidad, stockDisponible) }]
    })
    mostrarToast('Producto agregado al carrito', 'success')
    return true
  }

  const quitarItem = (productoId) => {
    setItems(prev => prev.filter(i => i.producto.id !== productoId))
  }

  const actualizarCantidad = (productoId, cantidad) => {
    if (cantidad <= 0) {
      quitarItem(productoId)
      return
    }
    setItems(prev => prev.map(i =>
      i.producto.id === productoId ? { ...i, cantidad } : i
    ))
  }

  const vaciarCarrito = () => setItems([])

  const totalItems = items.reduce((acc, i) => acc + i.cantidad, 0)

  // Subtotal con IVA incluido (el precio del backend ya viene con IVA).
  const calcularTotal = (esB2B = false) =>
    items.reduce((acc, i) => {
      const precio = obtenerPrecioProducto(i.producto, esB2B)
      return acc + parseFloat(precio || 0) * i.cantidad
    }, 0)

  // Subtotal a precio_b2c (sin descuento), para calcular el descuento real.
  const calcularTotalB2C = () =>
    items.reduce((acc, i) => {
      const precio = obtenerPrecioProducto(i.producto, false)
      return acc + parseFloat(precio || 0) * i.cantidad
    }, 0)

  const calcularResumen = ({ esB2B = false } = {}) => {
    const subtotal = calcularTotal(esB2B)
    // Descuento real: diferencia entre precio sin descuento y precio con convenio.
    const descuento = esB2B ? Math.max(0, Math.round(calcularTotalB2C() - subtotal)) : 0
    const baseAfectaIva = subtotal - (esB2B ? 0 : 0)
    const neto = Math.round(baseAfectaIva / (1 + IVA))
    const iva = baseAfectaIva - neto
    const total = baseAfectaIva
    return { subtotal, descuento, baseAfectaIva, neto, iva, total }
  }

  return (
    <CarritoContext.Provider value={{
      items, agregarItem, quitarItem, actualizarCantidad,
      vaciarCarrito, totalItems, calcularTotal, calcularResumen,
      tipoDespacho, setTipoDespacho,
    }}>
      {children}
    </CarritoContext.Provider>
  )
}

export const useCarrito = () => useContext(CarritoContext)
