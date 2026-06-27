import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  aprobarPedido,
  getDespachos,
  getPagos,
  getMisPedidos,
  getPedidosTodos,
  generarDteDesdePedido,
  obtenerDocumentosTributarios,
  obtenerResumenInventario,
} from '../../services/api'
import { Button, Spinner } from '../../components/ui'
import { extraerLista, formatEstado, formatFecha, formatPrecio } from '../../utils/format'
import './PanelPage.css'

function safeLower(value) {
  return String(value || '').trim().toLowerCase()
}

function safeUpper(value, fallback = 'N/A') {
  const text = String(value || '').trim()
  return text ? text.toUpperCase() : fallback
}

function formatTexto(value, fallback = '-') {
  const text = String(value || '').trim()
  return text || fallback
}

function normalizarPedido(p) {
  const estado = safeLower(p.estado || p.estado_pedido)

  return {
    ...p,

    estado,
    estado_display: p.estado_display || formatEstado(p.estado_pedido || p.estado),

    creado_en: p.creado_en || p.fecha_creacion,
    actualizado_en: p.actualizado_en || p.fecha_actualizacion,

    usuario: p.usuario || p.cliente_id,
    cliente_nombre: p.cliente_nombre || p.usuario_nombre || '-',

    tipo_cliente: p.tipo_cliente || p.tipo_venta || 'N/A',
    tipo_venta: p.tipo_venta || p.tipo_cliente || 'N/A',
    tipo_despacho: p.tipo_despacho || 'N/A',

    total: Number(p.total || 0),
  }
}

function normalizarPago(p) {
  const estado = safeLower(p.estado || p.estado_pago)

  return {
    ...p,

    pedido: p.pedido || p.pedido_id,
    pedido_id: p.pedido_id || p.pedido,

    metodo_display: p.metodo_display || p.metodo_pago || 'N/A',

    estado,
    estado_display: p.estado_display || formatEstado(p.estado_pago || p.estado),

    monto: Number(p.monto || p.monto_confirmado || p.pedido_total || 0),

    procesado_en:
        p.procesado_en ||
        p.fecha_confirmacion ||
        p.transaction_date ||
        p.fecha_creacion,
  }
}

function normalizarDespacho(d) {
  const estado = safeLower(d.estado || d.estado_despacho)

  return {
    ...d,

    pedido: d.pedido || d.pedido_id,
    numero_tracking: d.numero_tracking || d.tracking || d.codigo_tracking || '-',
    courier: d.courier || d.transportista || '-',
    estado,
    estado_display: d.estado_display || formatEstado(d.estado || d.estado_despacho),
    fecha_estimada_entrega:
        d.fecha_estimada_entrega ||
        d.fecha_requerida_entrega ||
        d.fecha_entrega_estimada,
  }
}

function normalizarDocumentoTributario(d) {
  return {
    ...d,

    pedido: d.pedido || d.pedido_id,
    tipo_documento_nombre:
        d.tipo_documento_nombre ||
        d.tipo_documento ||
        d.tipo ||
        'DTE',
    folio: d.folio || '-',
    fecha_emision: d.fecha_emision || d.fecha_creacion,
    estado_dte: d.estado_dte || d.estado || 'Registrado',
    monto_total: Number(d.monto_total || d.total || 0),
  }
}

function getBadgeStock(stock) {
  if (Number(stock.disponible) <= 0) {
    return { clase: 'badge-danger', label: 'Sin stock' }
  }

  return { clase: 'badge-warning', label: 'Crítico' }
}

function getBadgeLote(estado) {
  const estadoNormalizado = safeLower(estado)

  const estados = {
    vencido: { clase: 'badge-danger', label: 'Vencido' },
    proximo_vencer: { clase: 'badge-warning', label: 'Próximo a vencer' },
    vigente: { clase: 'badge-success', label: 'Vigente' },
  }

  return estados[estadoNormalizado] || {
    clase: 'badge-secondary',
    label: estado || 'Sin estado',
  }
}

function getBadgeMovimiento(tipo) {
  const tipoNormalizado = safeLower(tipo)

  const clases = {
    entrada: 'badge-success',
    salida: 'badge-danger',
    ajuste: 'badge-info',
    reserva: 'badge-warning',
    liberacion_reserva: 'badge-secondary',
    merma: 'badge-danger',
    vencimiento: 'badge-danger',
  }

  return clases[tipoNormalizado] || 'badge-secondary'
}

function getBadgePago(estado) {
  const estadoNormalizado = safeLower(estado)

  if (['aprobado', 'confirmado', 'authorized', 'autorizado'].includes(estadoNormalizado)) {
    return 'badge-success'
  }

  if (['rechazado', 'fallido', 'anulado', 'cancelado'].includes(estadoNormalizado)) {
    return 'badge-danger'
  }

  return 'badge-warning'
}

function getBadgeDespacho(estado) {
  const estadoNormalizado = safeLower(estado)

  if (['entregado'].includes(estadoNormalizado)) {
    return 'badge-success'
  }

  if (['en_ruta', 'preparando', 'en_preparacion', 'despachado'].includes(estadoNormalizado)) {
    return 'badge-info'
  }

  return 'badge-secondary'
}

const BADGE_ESTADO = {
  pendiente: 'badge-warning',
  aprobado: 'badge-info',
  en_preparacion: 'badge-info',
  despachado: 'badge-secondary',
  entregado: 'badge-success',
  cancelado: 'badge-danger',
  confirmado: 'badge-success',
}

const ROLES_CLIENTE = ['cliente', 'cliente_b2c', 'cliente_b2b']
const ROLES_DTE = ['admin', 'analista', ...ROLES_CLIENTE]
const ROLES_GENERAR_DTE = ['admin', 'analista']
const ROLES_INVENTARIO = ['admin', 'operador', 'analista']
const ROLES_COMPRAS = ['admin', 'operador', 'analista']
const ROLES_INTEGRACIONES = ['admin', 'operador', 'analista']
const ROLES_CONCILIACION = ['admin', 'analista']
const ROLES_CONVENIOS = ['admin', 'ejecutivo', 'analista']
const ROLES_GUIAS_DESPACHO = ['admin', 'operador', 'analista']
const ROLES_APROBACIONES_B2B = ['admin', 'ejecutivo', 'analista']
const ROLES_DASHBOARD_ANALISTA = ['admin', 'analista']
const ROLES_ADMIN_TRABAJADORES = ['admin']

const ESTADOS_PAGABLES = ['pendiente', 'aprobado']
const ESTADOS_CON_TRACKING = [
  'pendiente',
  'aprobado',
  'en_preparacion',
  'despachado',
  'entregado',
]

export default function PanelPage() {
  const { usuario } = useAuth()
  const navigate = useNavigate()

  const [pedidos, setPedidos] = useState([])
  const [pagos, setPagos] = useState([])
  const [despachos, setDespachos] = useState([])
  const [documentosTributarios, setDocumentosTributarios] = useState([])
  const [resumenInventario, setResumenInventario] = useState({
    stock_critico: [],
    lotes_proximos_vencer: [],
    movimientos_recientes: [],
  })
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pedidos')
  const [generandoDtePedidoId, setGenerandoDtePedidoId] = useState(null)

  const rol = safeLower(usuario?.rol)
  const usuarioId = usuario?.id || usuario?.cliente_id || usuario?.datos?.id

  const esCliente = ROLES_CLIENTE.includes(rol)
  const puedeVerDte = ROLES_DTE.includes(rol)
  const puedeGenerarDte = ROLES_GENERAR_DTE.includes(rol)
  const puedeVerInventario = ROLES_INVENTARIO.includes(rol)
  const puedeVerCompras = ROLES_COMPRAS.includes(rol)
  const puedeVerIntegraciones = ROLES_INTEGRACIONES.includes(rol)
  const puedeVerConciliacion = ROLES_CONCILIACION.includes(rol)
  const puedeVerConvenios = ROLES_CONVENIOS.includes(rol)
  const puedeVerGuiasDespacho = ROLES_GUIAS_DESPACHO.includes(rol)
  const puedeVerAprobacionesB2B = ROLES_APROBACIONES_B2B.includes(rol)
  const puedeVerDashboardAnalista = ROLES_DASHBOARD_ANALISTA.includes(rol)
  const puedeGestionarTrabajadores = ROLES_ADMIN_TRABAJADORES.includes(rol)

  const tabsDisponibles = useMemo(() => [
    { id: 'pedidos', label: 'Pedidos', visible: true },
    { id: 'pagos', label: 'Pagos', visible: ['admin', 'analista', ...ROLES_CLIENTE].includes(rol) },
    { id: 'despachos', label: 'Despachos', visible: ['admin', 'operador', ...ROLES_CLIENTE].includes(rol) },
    { id: 'dte', label: 'DTE', visible: ROLES_DTE.includes(rol) },
    { id: 'inventario', label: 'Inventario', visible: ROLES_INVENTARIO.includes(rol) },
  ].filter(t => t.visible), [rol])

  const puedeAprobar = (pedido) =>
      ['admin', 'ejecutivo'].includes(rol) && pedido.estado === 'pendiente'

  const puedePagar = (pedido) =>
      ESTADOS_PAGABLES.includes(pedido.estado) &&
      rol !== 'operador' &&
      Number(pedido.usuario) === Number(usuarioId)

  const puedeVerTracking = (pedido) =>
      ESTADOS_CON_TRACKING.includes(pedido.estado)

  const documentosPorPedido = useMemo(() => {
    return documentosTributarios.reduce((acc, documento) => {
      const pedidoId = documento.pedido || documento.pedido_id

      if (pedidoId) {
        acc[pedidoId] = documento
      }

      return acc
    }, {})
  }, [documentosTributarios])

  const cargarDatos = async () => {
    setLoading(true)

    try {
      const pedidosPromise = esCliente ? getMisPedidos() : getPedidosTodos()

      const [pedR, pagR, desR, dteR, invR] = await Promise.allSettled([
        pedidosPromise,
        getPagos(),
        getDespachos(),
        puedeVerDte ? obtenerDocumentosTributarios() : Promise.resolve({ data: [] }),
        puedeVerInventario
            ? obtenerResumenInventario()
            : Promise.resolve({
              data: {
                stock_critico: [],
                lotes_proximos_vencer: [],
                movimientos_recientes: [],
              },
            }),
      ])

      // DTEs embebidos en pedidos — se usan como semilla para documentosPorPedido
      // aunque el endpoint DTE falle o aún no haya cargado.
      let dtesFromPedidos = []

      if (pedR.status === 'fulfilled') {
        const listaPedidos = extraerLista(pedR.value.data).map(normalizarPedido)
        setPedidos(listaPedidos)
        dtesFromPedidos = listaPedidos
          .filter(p => p.dte_info?.id)
          .map(p => normalizarDocumentoTributario(p.dte_info))
      }

      if (pagR.status === 'fulfilled') {
        const listaPagos = extraerLista(pagR.value.data).map(normalizarPago)
        setPagos(listaPagos)
      }

      if (desR.status === 'fulfilled') {
        const listaDespachos = extraerLista(desR.value.data).map(normalizarDespacho)
        setDespachos(listaDespachos)
      }

      if (dteR.status === 'fulfilled') {
        const listaDte = extraerLista(dteR.value.data).map(normalizarDocumentoTributario)
        // Merge: preferir datos del endpoint DTE (más completos), rellenar con semilla de pedidos
        const idsDte = new Set(listaDte.map(d => d.id))
        const semilla = dtesFromPedidos.filter(d => !idsDte.has(d.id))
        setDocumentosTributarios([...listaDte, ...semilla])
      } else if (dtesFromPedidos.length > 0) {
        // Si el endpoint DTE falló (ej. cliente sin permiso), usar solo la semilla
        setDocumentosTributarios(prev => {
          const idsExistentes = new Set(prev.map(d => d.id))
          const nuevos = dtesFromPedidos.filter(d => !idsExistentes.has(d.id))
          return nuevos.length > 0 ? [...prev, ...nuevos] : prev
        })
      }

      if (invR.status === 'fulfilled') {
        setResumenInventario({
          stock_critico: invR.value.data?.stock_critico || [],
          lotes_proximos_vencer: invR.value.data?.lotes_proximos_vencer || [],
          movimientos_recientes: invR.value.data?.movimientos_recientes || [],
        })
      }
    } catch (e) {
      console.error('Error cargando datos del panel:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [puedeVerDte, puedeVerInventario])

  useEffect(() => {
    if (tabsDisponibles.length > 0 && !tabsDisponibles.some(t => t.id === tab)) {
      setTab(tabsDisponibles[0].id)
    }
  }, [rol, tab, tabsDisponibles])

  const handleAprobar = async (id) => {
    try {
      await aprobarPedido(id)
      cargarDatos()
    } catch (e) {
      alert(e.response?.data?.error || 'Error al aprobar el pedido.')
    }
  }

  const handleGenerarDte = async (pedidoId) => {
    if (!pedidoId || generandoDtePedidoId) return

    setGenerandoDtePedidoId(pedidoId)

    try {
      const { data } = await generarDteDesdePedido(pedidoId)
      const documentoNormalizado = normalizarDocumentoTributario(data)

      setDocumentosTributarios((actuales) => {
        const existe = actuales.some(d =>
            d.id === documentoNormalizado.id ||
            d.pedido === documentoNormalizado.pedido
        )

        if (existe) {
          return actuales.map(d =>
              d.id === documentoNormalizado.id ||
              d.pedido === documentoNormalizado.pedido
                  ? documentoNormalizado
                  : d
          )
        }

        return [documentoNormalizado, ...actuales]
      })
    } catch (e) {
      alert(e.response?.data?.error || 'No se pudo generar el DTE simulado.')
    } finally {
      setGenerandoDtePedidoId(null)
    }
  }

  const ROL_LABEL = {
    admin: 'Administrador del Sistema',
    cliente: 'Cliente',
    cliente_b2b: 'Cliente Institucional (B2B)',
    cliente_b2c: 'Paciente / Cliente Particular',
    ejecutivo: 'Ejecutivo de Cuentas',
    operador: 'Operador Logístico',
    analista: 'Analista de Finanzas',
  }

  return (
      <div className="page-container">
        <div className="panel-bienvenida card">
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>
              Hola, {usuario?.first_name || usuario?.username || usuario?.datos?.username || 'Usuario'}
            </h1>

            <p className="text-muted">{ROL_LABEL[rol] || formatEstado(rol) || 'Sin rol'}</p>

            {usuario?.nombre_institucion && (
                <p className="text-muted">{usuario.nombre_institucion}</p>
            )}
          </div>

          <div className="panel-acciones-rapidas">
            {esCliente && (
                <button className="btn btn-primary" onClick={() => navigate('/catalogo')}>
                  Ir al catálogo
                </button>
            )}

            {puedeVerCompras && (
                <button className="btn btn-secondary" onClick={() => navigate('/panel/compras-proveedor')}>
                  Compras y proveedores
                </button>
            )}

            {puedeVerInventario && (
                <button className="btn btn-secondary" onClick={() => navigate('/panel/traslados-inventario')}>
                  Traslados de inventario
                </button>
            )}

            {puedeVerInventario && (
                <button className="btn btn-secondary" onClick={() => navigate('/admin/productos')}>
                  Gestión de productos
                </button>
            )}

            {puedeGestionarTrabajadores && (
                <button className="btn btn-secondary" onClick={() => navigate('/admin/trabajadores')}>
                  Gestión de trabajadores
                </button>
            )}

            {puedeVerIntegraciones && (
                <button className="btn btn-secondary" onClick={() => navigate('/panel/integraciones')}>
                  Integraciones y auditoría
                </button>
            )}

            {puedeVerConciliacion && (
                <button className="btn btn-secondary" onClick={() => navigate('/panel/conciliacion-pagos')}>
                  Conciliación de pagos
                </button>
            )}

            {puedeVerConvenios && (
                <button className="btn btn-secondary" onClick={() => navigate('/panel/convenios-institucionales')}>
                  Convenios institucionales
                </button>
            )}

            {puedeVerGuiasDespacho && (
                <button className="btn btn-secondary" onClick={() => navigate('/panel/guias-despacho')}>
                  Guías de despacho
                </button>
            )}

            {puedeVerAprobacionesB2B && (
                <button className="btn btn-secondary" onClick={() => navigate('/panel/aprobaciones-b2b')}>
                  Aprobaciones B2B
                </button>
            )}

            {puedeVerDashboardAnalista && (
                <button className="btn btn-secondary" onClick={() => navigate('/panel/dashboard-analista')}>
                  Dashboard analista
                </button>
            )}
          </div>
        </div>

        <div className="panel-tabs">
          {tabsDisponibles.map(({ id, label }) => (
              <button
                  key={id}
                  className={`tab-btn ${tab === id ? 'tab-activo' : ''}`}
                  onClick={() => setTab(id)}
              >
                {label}

                {id === 'pedidos' && pedidos.length > 0 && (
                    <span className="tab-badge">{pedidos.length}</span>
                )}

                {id === 'dte' && documentosTributarios.length > 0 && (
                    <span className="tab-badge">{documentosTributarios.length}</span>
                )}

                {id === 'inventario' && resumenInventario.stock_critico.length > 0 && (
                    <span className="tab-badge">{resumenInventario.stock_critico.length}</span>
                )}
              </button>
          ))}
        </div>

        {loading ? (
            <Spinner />
        ) : (
            <>
              {tab === 'pedidos' && (
                  <div>
                    {pedidos.length === 0 ? (
                        <div className="empty-state">
                          <p>No tienes pedidos aún.</p>

                          {esCliente && (
                              <button className="btn btn-primary mt-1" onClick={() => navigate('/catalogo')}>
                                Hacer mi primer pedido
                              </button>
                          )}
                        </div>
                    ) : (
                        <div className="tabla-container card">
                          <table className="data-table">
                            <thead>
                            <tr>
                              <th>#</th>
                              <th>Fecha</th>
                              <th>Tipo venta</th>
                              <th>Despacho</th>
                              <th>Estado</th>
                              <th>Total</th>
                              <th>Acciones</th>
                            </tr>
                            </thead>

                            <tbody>
                            {pedidos.map(p => (
                                <tr key={p.id}>
                                  <td>#{p.id}</td>

                                  <td>{formatFecha(p.creado_en)}</td>

                                  <td>
                            <span className="badge badge-secondary">
                              {safeUpper(p.tipo_venta || p.tipo_cliente)}
                            </span>
                                  </td>

                                  <td>
                            <span className="badge badge-info">
                              {safeUpper(p.tipo_despacho)}
                            </span>
                                  </td>

                                  <td>
                            <span className={`badge ${BADGE_ESTADO[p.estado] || 'badge-secondary'}`}>
                              {p.estado_display || formatEstado(p.estado)}
                            </span>
                                  </td>

                                  <td>
                                    <strong>{formatPrecio(p.total)}</strong>
                                  </td>

                                  <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => navigate(`/pedidos/${p.id}`)}
                                    >
                                      Ver detalle
                                    </button>

                                    {puedePagar(p) && (
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => navigate(`/resultado-pago/${p.id}`)}
                                        >
                                          Pagar
                                        </button>
                                    )}

                                    {puedeVerTracking(p) && (
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => navigate(`/tracking/${p.id}`)}
                                        >
                                          Tracking
                                        </button>
                                    )}

                                    {puedeAprobar(p) && (
                                        <button
                                            className="btn btn-success btn-sm"
                                            onClick={() => handleAprobar(p.id)}
                                        >
                                          Aprobar
                                        </button>
                                    )}

                                    {puedeGenerarDte && p.id && (
                                        documentosPorPedido[p.id] ? (
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => navigate(`/dte/${documentosPorPedido[p.id].id}/comprobante`)}
                                            >
                                              Ver DTE
                                            </button>
                                        ) : (
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                disabled={generandoDtePedidoId === p.id}
                                                onClick={() => handleGenerarDte(p.id)}
                                            >
                                              {generandoDtePedidoId === p.id ? 'Generando...' : 'Generar DTE'}
                                            </button>
                                        )
                                    )}
                                  </td>
                                </tr>
                            ))}
                            </tbody>
                          </table>
                        </div>
                    )}
                  </div>
              )}

              {tab === 'pagos' && (
                  <div className="tabla-container card">
                    {pagos.length === 0 ? (
                        <p className="text-muted text-center" style={{ padding: 24 }}>
                          Sin pagos registrados.
                        </p>
                    ) : (
                        <table className="data-table">
                          <thead>
                          <tr>
                            <th>#</th>
                            <th>Pedido</th>
                            <th>Método</th>
                            <th>Estado</th>
                            <th>Monto</th>
                            <th>Fecha</th>
                          </tr>
                          </thead>

                          <tbody>
                          {pagos.map(p => (
                              <tr key={p.id}>
                                <td>{p.id}</td>

                                <td>#{p.pedido}</td>

                                <td>{formatTexto(p.metodo_display)}</td>

                                <td>
                          <span className={`badge ${getBadgePago(p.estado)}`}>
                            {p.estado_display || formatEstado(p.estado)}
                          </span>
                                </td>

                                <td>{formatPrecio(p.monto)}</td>

                                <td>{formatFecha(p.procesado_en)}</td>
                              </tr>
                          ))}
                          </tbody>
                        </table>
                    )}
                  </div>
              )}

              {tab === 'despachos' && (
                  <div className="tabla-container card">
                    {despachos.length === 0 ? (
                        <p className="text-muted text-center" style={{ padding: 24 }}>
                          Sin despachos registrados.
                        </p>
                    ) : (
                        <table className="data-table">
                          <thead>
                          <tr>
                            <th>Tracking</th>
                            <th>Pedido</th>
                            <th>Courier</th>
                            <th>Estado</th>
                            <th>Entrega est.</th>
                            <th>Acción</th>
                          </tr>
                          </thead>

                          <tbody>
                          {despachos.map(d => (
                              <tr key={d.id}>
                                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                  {formatTexto(d.numero_tracking)}
                                </td>

                                <td>#{d.pedido}</td>

                                <td>{formatTexto(d.courier)}</td>

                                <td>
                          <span className={`badge ${getBadgeDespacho(d.estado)}`}>
                            {d.estado_display || formatEstado(d.estado)}
                          </span>
                                </td>

                                <td>{formatFecha(d.fecha_estimada_entrega)}</td>

                                <td>
                                  <button
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => navigate(`/tracking/${d.pedido}`)}
                                  >
                                    Ver tracking
                                  </button>
                                </td>
                              </tr>
                          ))}
                          </tbody>
                        </table>
                    )}
                  </div>
              )}

              {tab === 'inventario' && (
                  <div className="inventario-panel">
                    <div className="inventario-resumen">
                      <div className="inventario-stat card">
                        <span>Stock crítico</span>
                        <strong>{resumenInventario.stock_critico.length}</strong>
                        <small>Productos bajo mínimo</small>
                      </div>

                      <div className="inventario-stat card">
                        <span>Lotes alertados</span>
                        <strong>{resumenInventario.lotes_proximos_vencer.length}</strong>
                        <small>Vencidos o próximos</small>
                      </div>

                      <div className="inventario-stat card">
                        <span>Movimientos recientes</span>
                        <strong>{resumenInventario.movimientos_recientes.length}</strong>
                        <small>Últimos registros</small>
                      </div>
                    </div>

                    <div className="tabla-container card">
                      <div className="panel-section-header">
                        <div>
                          <h2>Stock crítico</h2>
                          <p>Productos con disponibilidad igual o menor al stock mínimo definido.</p>
                        </div>
                      </div>

                      {resumenInventario.stock_critico.length === 0 ? (
                          <p className="text-muted text-center" style={{ padding: 24 }}>
                            No hay productos bajo stock mínimo.
                          </p>
                      ) : (
                          <table className="data-table">
                            <thead>
                            <tr>
                              <th>Producto</th>
                              <th>Sucursal</th>
                              <th>Disponibilidad</th>
                              <th>Estado</th>
                            </tr>
                            </thead>

                            <tbody>
                            {resumenInventario.stock_critico.map((s, index) => {
                              const badge = getBadgeStock(s)

                              return (
                                  <tr key={`${s.producto_id}-${s.sucursal_nombre}-${index}`}>
                                    <td>
                                      <strong>{formatTexto(s.producto_nombre)}</strong>
                                      <br />
                                      <span className="text-muted">{formatTexto(s.producto_codigo)}</span>
                                    </td>

                                    <td>{formatTexto(s.sucursal_nombre)}</td>

                                    <td>
                                      <div className="stock-metric">
                                        <strong>{s.disponible ?? 0}</strong>
                                        <span>Disponible</span>
                                      </div>

                                      <div className="stock-submetrics">
                                        <span>Total: {s.cantidad ?? 0}</span>
                                        <span>Reservado: {s.cantidad_reservada ?? 0}</span>
                                        <span>Mínimo: {s.stock_minimo ?? 0}</span>
                                      </div>
                                    </td>

                                    <td>
                                      <span className={`badge ${badge.clase}`}>{badge.label}</span>
                                    </td>
                                  </tr>
                              )
                            })}
                            </tbody>
                          </table>
                      )}
                    </div>

                    <div className="tabla-container card">
                      <div className="panel-section-header">
                        <div>
                          <h2>Lotes próximos a vencer</h2>
                          <p>Lotes vencidos o con vencimiento dentro de la ventana de alerta.</p>
                        </div>
                      </div>

                      {resumenInventario.lotes_proximos_vencer.length === 0 ? (
                          <p className="text-muted text-center" style={{ padding: 24 }}>
                            Sin lotes próximos a vencer.
                          </p>
                      ) : (
                          <table className="data-table">
                            <thead>
                            <tr>
                              <th>Producto</th>
                              <th>Lote</th>
                              <th>Sucursal</th>
                              <th>Vencimiento</th>
                              <th>Cantidad</th>
                              <th>Estado</th>
                            </tr>
                            </thead>

                            <tbody>
                            {resumenInventario.lotes_proximos_vencer.map((l, index) => {
                              const badge = getBadgeLote(l.estado_lote)

                              return (
                                  <tr key={`${l.codigo_lote}-${l.producto_nombre}-${index}`}>
                                    <td>{formatTexto(l.producto_nombre)}</td>

                                    <td>
                                      <span className="mono-value">{formatTexto(l.codigo_lote)}</span>
                                    </td>

                                    <td>{formatTexto(l.sucursal_nombre)}</td>

                                    <td>{formatFecha(l.fecha_vencimiento)}</td>

                                    <td>{l.cantidad_disponible ?? 0}</td>

                                    <td>
                                      <span className={`badge ${badge.clase}`}>{badge.label}</span>
                                    </td>
                                  </tr>
                              )
                            })}
                            </tbody>
                          </table>
                      )}
                    </div>

                    <div className="tabla-container card">
                      <div className="panel-section-header">
                        <div>
                          <h2>Movimientos recientes</h2>
                          <p>Últimos movimientos registrados para trazabilidad administrativa.</p>
                        </div>
                      </div>

                      {resumenInventario.movimientos_recientes.length === 0 ? (
                          <p className="text-muted text-center" style={{ padding: 24 }}>
                            Sin movimientos recientes.
                          </p>
                      ) : (
                          <table className="data-table">
                            <thead>
                            <tr>
                              <th>Fecha</th>
                              <th>Producto</th>
                              <th>Sucursal</th>
                              <th>Lote</th>
                              <th>Tipo</th>
                              <th>Cantidad</th>
                              <th>Referencia</th>
                              <th>Usuario</th>
                            </tr>
                            </thead>

                            <tbody>
                            {resumenInventario.movimientos_recientes.map((m, index) => (
                                <tr key={`${m.creado_en}-${m.producto_nombre}-${index}`}>
                                  <td>{formatFecha(m.creado_en)}</td>

                                  <td>
                                    {formatTexto(m.producto_nombre)}

                                    {m.motivo && (
                                        <>
                                          <br />
                                          <span className="text-muted">{m.motivo}</span>
                                        </>
                                    )}
                                  </td>

                                  <td>{formatTexto(m.sucursal_nombre)}</td>

                                  <td>{formatTexto(m.lote_codigo)}</td>

                                  <td>
                            <span className={`badge ${getBadgeMovimiento(m.tipo_movimiento)}`}>
                              {formatTexto(m.tipo_movimiento)}
                            </span>
                                  </td>

                                  <td>{m.cantidad ?? 0}</td>

                                  <td>{formatTexto(m.referencia)}</td>

                                  <td>{formatTexto(m.usuario)}</td>
                                </tr>
                            ))}
                            </tbody>
                          </table>
                      )}
                    </div>
                  </div>
              )}

              {tab === 'dte' && (
                  <div className="tabla-container card">
                    {documentosTributarios.length === 0 ? (
                        <p className="text-muted text-center" style={{ padding: 24 }}>
                          Sin documentos tributarios registrados.
                        </p>
                    ) : (
                        <table className="data-table">
                          <thead>
                          <tr>
                            <th>Pedido</th>
                            <th>Tipo</th>
                            <th>Folio</th>
                            <th>Emisión</th>
                            <th>Estado</th>
                            <th>Total</th>
                            <th>Acción</th>
                          </tr>
                          </thead>

                          <tbody>
                          {documentosTributarios.map(d => (
                              <tr key={d.id}>
                                <td>{d.pedido ? `#${d.pedido}` : '-'}</td>

                                <td>{formatTexto(d.tipo_documento_nombre)}</td>

                                <td>{formatTexto(d.folio)}</td>

                                <td>{formatFecha(d.fecha_emision)}</td>

                                <td>
                          <span className="badge badge-info">
                            {formatTexto(d.estado_dte)}
                          </span>
                                </td>

                                <td>{formatPrecio(d.monto_total)}</td>

                                <td>
                                  {d.pdf_url ? (
                                      <a
                                          className="btn btn-secondary btn-sm"
                                          href={d.pdf_url}
                                          target="_blank"
                                          rel="noreferrer"
                                      >
                                        Ver PDF
                                      </a>
                                  ) : (
                                      <button
                                          className="btn btn-secondary btn-sm"
                                          onClick={() => navigate(`/dte/${d.id}/comprobante`)}
                                      >
                                        Ver comprobante
                                      </button>
                                  )}
                                </td>
                              </tr>
                          ))}
                          </tbody>
                        </table>
                    )}
                  </div>
              )}
            </>
        )}
      </div>
  )
}
