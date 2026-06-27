/**
 * Utilidades de formato compartidas en toda la app.
 *
 * Reemplazan las funciones duplicadas de formatPrecio() / formatFecha() / formatEstado()
 * que estaban repetidas en ~19 páginas.
 */

const formateadorCLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

/** Formatea un número como precio en CLP. Ej: 5661 → "$5.661". */
export function formatPrecio(valor) {
  return formateadorCLP.format(Number(valor || 0))
}

export function obtenerPrecioProducto(producto, esB2B = false) {
  // Para B2B: si el backend envió precio_final con descuento de convenio, usarlo.
  if (esB2B && typeof producto?.precio_final === 'number' && producto.precio_final > 0) {
    return producto.precio_final
  }

  const candidatos = esB2B
    ? [
        producto?.precio_con_iva,
        producto?.precio_b2b,
        producto?.precio_b2c,
        producto?.valor_unitario,
        producto?.precio,
      ]
    : [
        producto?.precio_con_iva,
        producto?.precio_b2c,
        producto?.precio_b2b,
        producto?.valor_unitario,
        producto?.precio,
      ]

  const valor = candidatos.find((item) => item !== undefined && item !== null && item !== '')
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : 0
}

/** Versión compacta: 1234567 → "$1.2M", 4500 → "$5K". */
export function formatPrecioCorto(valor) {
  const n = Number(valor || 0)
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

/** Formatea fecha al español chileno: "25 may 2026". Acepta string o Date. */
export function formatFecha(valor) {
  if (!valor) return '-'
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return '-'
  return fecha.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** "PEDIDO_PENDIENTE" → "Pedido Pendiente". */
export function formatEstado(valor) {
  if (!valor) return '-'
  return String(valor)
    .trim()
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

/** Capitaliza la primera letra. */
export function capitalizar(valor) {
  if (!valor) return ''
  return String(valor).charAt(0).toUpperCase() + String(valor).slice(1).toLowerCase()
}

/** Trunca con ellipsis: ("texto largo", 8) → "texto l…". */
export function truncar(texto, max = 80) {
  if (!texto) return ''
  const t = String(texto)
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

/** Convierte respuesta paginada DRF en array plano. */
export function extraerLista(respuesta) {
  return respuesta?.results || respuesta || []
}
