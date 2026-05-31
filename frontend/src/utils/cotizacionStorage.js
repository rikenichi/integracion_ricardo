/**
 * Persistencia local de la cotización Chilexpress por pedido.
 *
 * Contexto: el backend (modelo `Pedido`) no tiene un campo `costo_envio`,
 * por lo que el monto cotizado con Chilexpress no se guarda en BD.
 * Para no perder esa información, la guardamos en `localStorage` asociada
 * al `pedido_id` apenas el backend confirma el pedido.
 *
 * Cuando el backend agregue un campo dedicado para envío, este módulo
 * puede eliminarse o solo dejarse como fallback.
 */

const STORAGE_KEY = 'medistock_cotizaciones_envio'

function leerMapa() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function escribirMapa(mapa) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mapa))
  } catch {
    /* localStorage lleno o deshabilitado: silencioso */
  }
}

/**
 * Guarda la cotización del envío para un pedido.
 * Sobrescribe si ya existía una entrada para ese pedido.
 *
 * @param {number|string} pedidoId
 * @param {object} cotizacion - { costo, servicio, codigo, peso_kg, sucursal_origen, comuna_destino }
 */
export function guardarCotizacionPedido(pedidoId, cotizacion) {
  if (!pedidoId || !cotizacion) return
  const mapa = leerMapa()
  mapa[String(pedidoId)] = {
    ...cotizacion,
    guardado_en: new Date().toISOString(),
  }
  escribirMapa(mapa)
}

/**
 * Obtiene la cotización guardada para un pedido. Retorna null si no existe.
 */
export function obtenerCotizacionPedido(pedidoId) {
  if (!pedidoId) return null
  const mapa = leerMapa()
  return mapa[String(pedidoId)] || null
}

/**
 * Elimina la cotización guardada de un pedido. Útil tras cancelarlo.
 */
export function eliminarCotizacionPedido(pedidoId) {
  if (!pedidoId) return
  const mapa = leerMapa()
  delete mapa[String(pedidoId)]
  escribirMapa(mapa)
}

/**
 * Devuelve todas las cotizaciones guardadas (útil para depurar).
 */
export function listarCotizaciones() {
  return leerMapa()
}
