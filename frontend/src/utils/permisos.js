/**
 * Politica central de permisos por rol.
 *
 * Centralizar aca evita repartir las matrices de roles por cada pagina/componente
 * y asegura que la regla "quien puede hacer que" sea unica.
 */

export const MENSAJE_FLUJO_SOLO_CLIENTES =
  'El flujo de compra solo esta disponible para clientes. Usa una cuenta cliente para realizar pedidos.'

// El backend solo permite crear direcciones y pedidos a perfiles cliente.
const ROLES_PUEDEN_COMPRAR = new Set([
  'cliente',
  'cliente_b2b',
  'cliente_b2c',
  'cliente_particular',
  'cliente_institucional',
])

const ROLES_NO_COMPRAN = new Set([
  'admin',
  'administrador',
  'trabajador',
  'ejecutivo',
  'operador',
  'analista',
  'finanzas',
  'logistica',
])

function normalizarRol(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function obtenerRolCompra(usuarioORol) {
  if (!usuarioORol) return ''

  if (typeof usuarioORol === 'string') {
    return normalizarRol(usuarioORol)
  }

  const datos = usuarioORol.datos || {}
  const valores = [
    usuarioORol.rol,
    usuarioORol.role,
    usuarioORol.tipo_usuario,
    usuarioORol.tipo_cliente,
    usuarioORol.rol_backend,
    usuarioORol.Rol,
    datos.rol,
    datos.Rol,
    datos.tipo_usuario,
    datos.tipo_cliente,
    datos.usuario?.rol,
    datos.usuario?.role,
  ].map(normalizarRol).filter(Boolean)

  if (valores.some((valor) => ROLES_PUEDEN_COMPRAR.has(valor))) {
    return 'cliente'
  }

  if (valores.includes('particular') || valores.includes('institucional')) {
    return 'cliente'
  }

  const rolInterno = valores.find((valor) => ROLES_NO_COMPRAN.has(valor))
  if (rolInterno) return rolInterno

  return valores[0] || ''
}

export function puedeComprar(usuarioORol) {
  const rol = obtenerRolCompra(usuarioORol)
  if (!rol) return true // visitantes sin sesion pueden navegar; checkout esta protegido.
  return rol === 'cliente' || ROLES_PUEDEN_COMPRAR.has(rol)
}

/**
 * Devuelve un mensaje explicativo cuando un rol no puede comprar,
 * util para mostrar en tooltips o alerts.
 */
export function razonNoCompra(usuarioORol) {
  const r = obtenerRolCompra(usuarioORol)
  if (r === 'analista') return 'Como Analista de Finanzas no tienes funciones de compra. Tu rol es generar reportes y conciliar pagos.'
  if (r === 'operador') return 'Como Operador Logistico no tienes funciones de compra. Tu rol es gestionar inventario y despachos.'
  return MENSAJE_FLUJO_SOLO_CLIENTES
}
