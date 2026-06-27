// Estados normalizados — fuente única de verdad para predicados de pedido/pago/DTE/tracking.
// No modificar valores del backend. Toda comparación se hace después de .toLowerCase().

// ─── Conjuntos de estados ────────────────────────────────────────────────────

/** Pedido creado pero aún sin pago real. 'aprobado' = aprobado por ejecutivo B2B, pendiente de pago. */
export const ESTADOS_PENDIENTE_PAGO = [
  'pendiente',
  'pendiente_pago',
  'pendiente_de_pago',
  'aprobado',
]

/**
 * Estados que indican que el pago ya se procesó (Webpay retorna 'CONFIRMADO',
 * Transbank genera token 'authorized'/'autorizado').
 * 'aprobado' de pedido no cuenta — es aprobación de ejecutivo, no pago.
 */
export const ESTADOS_PAGADOS = ['confirmado', 'authorized', 'autorizado']

/**
 * Estados con despacho iniciado (para derivar tab Despachos del panel admin).
 * Incluye 'aprobado' porque Webpay puede dejar estado previo en ese valor.
 */
export const ESTADOS_CON_DESPACHO = [
  'confirmado',
  'aprobado',
  'en_preparacion',
  'despachado',
  'entregado',
]

/**
 * Estados con logística activa — cuando mostrar "Ver tracking" tiene sentido.
 * No incluye 'pendiente' ni 'aprobado' porque aún no hay envío.
 */
export const ESTADOS_CON_TRACKING = [
  'confirmado',
  'en_preparacion',
  'despachado',
  'entregado',
]

// ─── Normalización ───────────────────────────────────────────────────────────

/** Convierte cualquier valor de estado a lowercase sin espacios. */
export function normalizarEstado(valor) {
  return String(valor || '').trim().toLowerCase()
}

// ─── Predicados de pedido ────────────────────────────────────────────────────

/**
 * Devuelve true si el dinero ya fue cobrado.
 * Revisa pedido.estado Y pedido.pago/pago_info.estado.
 */
export function esPedidoPagado(pedido) {
  const estadoPedido = normalizarEstado(pedido?.estado)
  const estadoPago = normalizarEstado(
    pedido?.pago?.estado ||
    pedido?.pago_info?.estado_pago ||
    pedido?.pago_info?.estado,
  )
  return ESTADOS_PAGADOS.includes(estadoPedido) || ESTADOS_PAGADOS.includes(estadoPago)
}

/** Alias semántico — en el contexto de acciones post-pago. */
export const esPedidoConfirmado = esPedidoPagado

/**
 * Devuelve true si el pago individual (objeto pago/pago_info) está aprobado.
 * Más permisivo: incluye 'aprobado' de pago (distinto a estado del pedido).
 */
export function esPagoAprobado(pago) {
  const estado = normalizarEstado(pago?.estado_pago || pago?.estado)
  return [...ESTADOS_PAGADOS, 'aprobado'].includes(estado)
}

// ─── Predicados de DTE ───────────────────────────────────────────────────────

/** El pedido ya tiene un DocumentoTributario generado (con id real). */
export function tieneDte(pedido) {
  return !!(pedido?.dte_info?.id)
}

/**
 * Puede mostrarse el botón "Generar DTE":
 * - El pedido fue pagado (confirmado/authorized).
 * - Aún no tiene DTE generado.
 */
export function puedeGenerarDtePedido(pedido) {
  return esPedidoPagado(pedido) && !tieneDte(pedido)
}

/** Puede mostrarse el botón "Ver DTE" / "Ver comprobante". */
export function puedeVerDtePedido(pedido) {
  return tieneDte(pedido)
}

// ─── Predicados de tracking ──────────────────────────────────────────────────

/**
 * Puede mostrarse el botón "Ver tracking".
 * Prioridad 1: el pedido tiene un EnvioPedido con número de rastreo real.
 * Prioridad 2: el estado del pedido indica que el envío ya está en curso.
 */
export function puedeVerTrackingPedido(pedido) {
  const envio = pedido?.envio
  if (envio?.numero_tracking || envio?.transport_order_number) return true
  return ESTADOS_CON_TRACKING.includes(normalizarEstado(pedido?.estado))
}

// ─── Labels de display ───────────────────────────────────────────────────────

const LABELS_PEDIDO = {
  pendiente: 'Pendiente de pago',
  pendiente_pago: 'Pendiente de pago',
  pendiente_de_pago: 'Pendiente de pago',
  confirmado: 'Confirmado / Pagado',
  aprobado: 'Aprobado',
  authorized: 'Autorizado',
  autorizado: 'Autorizado',
  en_preparacion: 'En preparación',
  despachado: 'Despachado',
  entregado: 'Entregado',
  rechazado: 'Pago rechazado',
  cancelado: 'Cancelado',
  anulado: 'Anulado',
}

/** Label legible para un estado de pedido (uso en panel/tabla). */
export function obtenerEstadoPedidoLabel(valor, fallback) {
  return LABELS_PEDIDO[normalizarEstado(valor)] || fallback || valor || 'Sin estado'
}

const LABELS_PAGO = {
  authorized: 'Autorizado',
  autorizado: 'Autorizado',
  aprobado: 'Aprobado',
  confirmado: 'Confirmado',
  pendiente: 'Pendiente',
  rechazado: 'Rechazado',
  fallido: 'Fallido',
  anulado: 'Anulado',
  cancelado: 'Cancelado',
}

/** Label legible para un estado de pago. */
export function obtenerEstadoPagoLabel(valor, fallback) {
  return LABELS_PAGO[normalizarEstado(valor)] || fallback || valor || 'Sin estado'
}
