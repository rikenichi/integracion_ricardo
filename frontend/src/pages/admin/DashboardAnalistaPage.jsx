import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import './DashboardAnalistaPage.css'

const ROLES_PERMITIDOS = ['admin', 'analista']

function obtenerLista(data) {
  return data?.results || data || []
}

function normalizarEstado(valor) {
  return String(valor || '').trim().toLowerCase()
}

function formatPrecio(valor) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
  }).format(Number(valor || 0))
}

function formatPrecioCompacto(valor) {
  return new Intl.NumberFormat('es-CL', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(valor || 0))
}

function extraerMensajeError(data) {
  if (!data) return ''
  if (typeof data === 'string') return data
  if (Array.isArray(data)) return data.map(extraerMensajeError).find(Boolean) || ''

  for (const clave of ['detail', 'error', 'message', 'stock', 'errores']) {
    const mensaje = extraerMensajeError(data[clave])
    if (mensaje) return mensaje
  }

  return Object.values(data).map(extraerMensajeError).find(Boolean) || ''
}

function mensajeError(error, nombre) {
  if (error?.response?.status === 403) {
    return `Tu usuario no tiene permisos para consultar ${nombre}.`
  }

  return extraerMensajeError(error?.response?.data) || `No se pudo cargar ${nombre}.`
}

function contarPorEstado(pedidos, estadoBuscado) {
  return pedidos.filter((pedido) =>
    normalizarEstado(pedido.estado_pedido || pedido.estado) === estadoBuscado
  ).length
}

function totalPedido(pedido) {
  return Number(pedido.total || pedido.total_pedido || pedido.monto_total || pedido.pedido_total || 0)
}

function fechaPedido(pedido) {
  return pedido.fecha_creacion || pedido.creado_en || pedido.fecha || null
}

function etiquetaMes(fecha) {
  return new Intl.DateTimeFormat('es-CL', {
    month: 'short',
    year: '2-digit',
  }).format(fecha)
}

function obtenerVentasPorMes(pedidos) {
  const agrupados = new Map()

  pedidos.forEach((pedido) => {
    const fechaBase = fechaPedido(pedido)
    const monto = totalPedido(pedido)
    if (!fechaBase || monto <= 0) return

    const fecha = new Date(fechaBase)
    if (Number.isNaN(fecha.getTime())) return

    const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
    const actual = agrupados.get(clave) || {
      clave,
      etiqueta: etiquetaMes(fecha),
      total: 0,
      pedidos: 0,
    }

    agrupados.set(clave, {
      ...actual,
      total: actual.total + monto,
      pedidos: actual.pedidos + 1,
    })
  })

  return Array.from(agrupados.values())
    .sort((a, b) => a.clave.localeCompare(b.clave))
    .slice(-12)
}

function stockDisponible(inventario) {
  return Number(
    inventario.stock_neto ??
    inventario.cantidad_disponible ??
    inventario.disponible ??
    0
  )
}

export default function DashboardAnalistaPage() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [pedidos, setPedidos] = useState([])
  const [inventarios, setInventarios] = useState([])
  const [lotes, setLotes] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [pagos, setPagos] = useState([])
  const [errores, setErrores] = useState({})
  const [loading, setLoading] = useState(true)

  const rol = normalizarEstado(usuario?.rol)
  const autorizado = ROLES_PERMITIDOS.includes(rol)

  const metricas = useMemo(() => {
    const totalVendido = pedidos.reduce((total, pedido) => total + totalPedido(pedido), 0)
    const stockTotal = inventarios.reduce((total, item) => total + stockDisponible(item), 0)
    const pagosConfirmados = pagos.reduce(
      (total, pago) => total + Number(pago.monto_confirmado || pago.pedido_total || 0),
      0,
    )

    return {
      totalPedidos: pedidos.length,
      pedidosPendientes: contarPorEstado(pedidos, 'pendiente'),
      pedidosAprobados: contarPorEstado(pedidos, 'aprobado'),
      totalVendido,
      inventarios: inventarios.length,
      stockTotal,
      lotes: lotes.length,
      movimientos: movimientos.length,
      pagos: pagos.length,
      pagosConfirmados,
    }
  }, [pedidos, inventarios, lotes, movimientos, pagos])

  const ventasPorMes = useMemo(() => obtenerVentasPorMes(pedidos), [pedidos])

  const cargarDatos = async () => {
    setLoading(true)
    setErrores({})

    const consultas = await Promise.allSettled([
      api.get('/orders/pedidos/todos/'),
      api.get('/inventory/inventarios/'),
      api.get('/inventory/lotes/'),
      api.get('/inventory/movimientos/'),
      api.get('/payments/mis-pagos/'),
    ])

    const [pedidosR, inventariosR, lotesR, movimientosR, pagosR] = consultas
    const nuevosErrores = {}

    if (pedidosR.status === 'fulfilled') {
      setPedidos(obtenerLista(pedidosR.value.data))
    } else {
      setPedidos([])
      nuevosErrores.pedidos = mensajeError(pedidosR.reason, 'pedidos')
    }

    if (inventariosR.status === 'fulfilled') {
      setInventarios(obtenerLista(inventariosR.value.data))
    } else {
      setInventarios([])
      nuevosErrores.inventarios = mensajeError(inventariosR.reason, 'inventario')
    }

    if (lotesR.status === 'fulfilled') {
      setLotes(obtenerLista(lotesR.value.data))
    } else {
      setLotes([])
      nuevosErrores.lotes = mensajeError(lotesR.reason, 'lotes')
    }

    if (movimientosR.status === 'fulfilled') {
      setMovimientos(obtenerLista(movimientosR.value.data))
    } else {
      setMovimientos([])
      nuevosErrores.movimientos = mensajeError(movimientosR.reason, 'movimientos')
    }

    if (pagosR.status === 'fulfilled') {
      setPagos(obtenerLista(pagosR.value.data))
    } else {
      setPagos([])
      nuevosErrores.pagos = mensajeError(pagosR.reason, 'pagos')
    }

    setErrores(nuevosErrores)
    setLoading(false)
  }

  useEffect(() => {
    if (autorizado) cargarDatos()
  }, [autorizado])

  if (!autorizado) {
    return (
      <div className="page-container dashboard-analista-page">
        <div className="dashboard-toolbar">
          <button className="btn btn-secondary" onClick={() => navigate('/panel')}>
            Ir al panel
          </button>
        </div>
        <div className="card dashboard-acceso">
          <h1>Acceso no autorizado</h1>
          <p className="text-muted">
            Este dashboard esta disponible solo para administradores y analistas.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container dashboard-analista-page">
      <div className="dashboard-header card">
        <div>
          <p className="dashboard-kicker">Analitica operacional</p>
          <h1 className="page-title">Dashboard analista</h1>
          <p className="text-muted">
            Indicadores construidos con endpoints reales de pedidos, inventario y pagos registrados.
          </p>
        </div>
        <div className="dashboard-toolbar">
          <button className="btn btn-secondary" onClick={() => navigate('/panel')}>
            Ir al panel
          </button>
          <button className="btn btn-primary" onClick={cargarDatos} disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : (
        <>
          {Object.values(errores).length > 0 && (
            <div className="dashboard-alertas">
              {Object.entries(errores).map(([clave, mensaje]) => (
                <div className="alert alert-warning" key={clave}>{mensaje}</div>
              ))}
            </div>
          )}

          <section className="dashboard-metricas">
            <article className="dashboard-stat card">
              <span>Total pedidos</span>
              <strong>{metricas.totalPedidos}</strong>
              <small>Desde /orders/pedidos/todos/</small>
            </article>
            <article className="dashboard-stat card">
              <span>Pendientes</span>
              <strong>{metricas.pedidosPendientes}</strong>
              <small>Pedidos en revision o pago</small>
            </article>
            <article className="dashboard-stat card">
              <span>Aprobados</span>
              <strong>{metricas.pedidosAprobados}</strong>
              <small>Pedidos aprobados por backend</small>
            </article>
            <article className="dashboard-stat card">
              <span>Total vendido</span>
              <strong>{formatPrecio(metricas.totalVendido)}</strong>
              <small>Suma de total entregado por pedidos</small>
            </article>
          </section>

          <section className="card dashboard-chart-card">
            <div className="dashboard-panel-header">
              <h2>
                {ventasPorMes.length === 1 ? 'Resumen de ventas del mes' : 'Ventas por mes'}
              </h2>
              <p>Suma mensual calculada desde pedidos reales.</p>
            </div>
            {ventasPorMes.length === 0 ? (
              <p className="text-muted dashboard-empty">
                Sin ventas registradas.
              </p>
            ) : ventasPorMes.length === 1 ? (
              <div className="ventas-single">
                <span className="ventas-single-label">{ventasPorMes[0].etiqueta}</span>
                <strong>{formatPrecio(ventasPorMes[0].total)}</strong>
                <p>
                  {ventasPorMes[0].pedidos} {ventasPorMes[0].pedidos === 1 ? 'pedido considerado' : 'pedidos considerados'}
                </p>
              </div>
            ) : (
              <div className="ventas-recharts" aria-label="Total vendido por mes">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={ventasPorMes} margin={{ top: 20, right: 18, left: 4, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" vertical={false} />
                    <XAxis
                      dataKey="etiqueta"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={formatPrecioCompacto}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      width={64}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(72, 202, 228, 0.12)' }}
                      formatter={(value) => [formatPrecio(value), 'Total vendido']}
                      labelFormatter={(label) => `Mes: ${label}`}
                    />
                    <Bar dataKey="total" fill="#0077b6" radius={[8, 8, 0, 0]} maxBarSize={58} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="dashboard-grid">
            <article className="card dashboard-panel">
              <div className="dashboard-panel-header">
                <h2>Inventario real</h2>
                <p>Registros disponibles desde endpoints de inventario.</p>
              </div>
              <div className="dashboard-mini-stats">
                <div>
                  <span>Inventarios</span>
                  <strong>{metricas.inventarios}</strong>
                </div>
                <div>
                  <span>Stock disponible</span>
                  <strong>{metricas.stockTotal}</strong>
                </div>
                <div>
                  <span>Lotes</span>
                  <strong>{metricas.lotes}</strong>
                </div>
                <div>
                  <span>Movimientos</span>
                  <strong>{metricas.movimientos}</strong>
                </div>
              </div>
            </article>

            <article className="card dashboard-panel">
              <div className="dashboard-panel-header">
                <h2>Pagos registrados</h2>
                <p>Consulta real a pagos si el usuario tiene permisos.</p>
              </div>
              {errores.pagos ? (
                <p className="text-muted dashboard-empty">{errores.pagos}</p>
              ) : (
                <div className="dashboard-mini-stats">
                  <div>
                    <span>Pagos</span>
                    <strong>{metricas.pagos}</strong>
                  </div>
                  <div>
                    <span>Monto pagos</span>
                    <strong>{formatPrecio(metricas.pagosConfirmados)}</strong>
                  </div>
                </div>
              )}
            </article>
          </section>

          <section className="tabla-container card dashboard-tabla">
            <div className="dashboard-panel-header">
              <h2>Ultimos movimientos de inventario</h2>
              <p>Vista compacta para validar actividad operacional reciente.</p>
            </div>
            {movimientos.length === 0 ? (
              <p className="text-muted dashboard-empty">No hay movimientos disponibles para mostrar.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Referencia</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.slice(0, 8).map((movimiento, index) => (
                    <tr key={`${movimiento.id || movimiento.fecha_movimiento}-${index}`}>
                      <td>{movimiento.fecha_movimiento || movimiento.creado_en || '-'}</td>
                      <td>{movimiento.tipo_movimiento || '-'}</td>
                      <td>{movimiento.cantidad ?? '-'}</td>
                      <td>{movimiento.pedido || movimiento.compra_proveedor || movimiento.traslado_inventario || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  )
}
