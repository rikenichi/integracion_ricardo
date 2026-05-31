import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { obtenerPedidoDetalle } from '../../services/api'
import { obtenerCotizacionPedido } from '../../utils/cotizacionStorage'
import './PedidoDetallePage.css'

const ESTADOS_PAGABLES = ['pendiente', 'aprobado']
const ESTADOS_CON_TRACKING = ['aprobado', 'en_preparacion', 'despachado', 'entregado']
const ROLES_CLIENTE = ['cliente', 'cliente_b2c', 'cliente_b2b']

function formatPrecio(valor) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(Number(valor || 0))
}

function formatFecha(valor) {
  if (!valor) return 'No disponible'
  return new Date(valor).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function valor(dato) {
  return dato || 'No disponible'
}

function badgeEstadoPedido(estado) {
  const clases = {
    pendiente: 'badge-warning',
    aprobado: 'badge-info',
    en_preparacion: 'badge-info',
    despachado: 'badge-secondary',
    entregado: 'badge-success',
    cancelado: 'badge-danger',
  }
  return clases[estado] || 'badge-secondary'
}

function estadoPasoPedido(pedido, pago, despacho, dte) {
  return [
    {
      label: 'Pedido creado',
      detail: formatFecha(pedido.creado_en),
      status: pedido.creado_en ? 'completado' : 'pendiente',
    },
    {
      label: 'Pago',
      detail: pago ? (pago.estado_display || pago.estado_pago) : 'Pago no registrado',
      status: pago?.estado_pago === 'aprobado' ? 'completado' : pago ? 'pendiente' : 'no-disponible',
    },
    {
      label: 'Despacho',
      detail: despacho ? (despacho.estado_display || despacho.estado_envio) : 'Despacho no registrado',
      status: despacho ? 'completado' : 'pendiente',
    },
    {
      label: 'DTE',
      detail: dte ? `${dte.tipo_documento_nombre} folio ${dte.folio}` : 'Documento tributario no generado',
      status: dte ? 'completado' : 'pendiente',
    },
    {
      label: 'Entrega / Tracking',
      detail: despacho?.numero_seguimiento || pedido.estado_display || pedido.estado,
      status: pedido.estado === 'entregado' ? 'completado' : ESTADOS_CON_TRACKING.includes(pedido.estado) ? 'pendiente' : 'no-disponible',
    },
  ]
}

export default function PedidoDetallePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [pedido, setPedido] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const cargarPedido = async () => {
      setLoading(true)
      setError('')
      try {
        const { data } = await obtenerPedidoDetalle(id)
        setPedido(data)
      } catch (e) {
        if ([403, 404].includes(e.response?.status)) {
          setError('No pudimos encontrar este pedido o no tienes permiso para verlo.')
        } else {
          setError('No se pudo cargar el detalle del pedido.')
        }
      } finally {
        setLoading(false)
      }
    }

    cargarPedido()
  }, [id])

  const detalles = Array.isArray(pedido?.detalles) ? pedido.detalles : []
  const pago = pedido?.pago_info
  const despacho = pedido?.despacho_info
  const dte = pedido?.dte_info
  const esCliente = ROLES_CLIENTE.includes(usuario?.rol)

  // Cotización Chilexpress guardada por el frontend al crear el pedido
  // (el backend aún no persiste costo_envio en el modelo Pedido).
  const cotizacionGuardada = useMemo(() => obtenerCotizacionPedido(id), [id])
  const costoEnvio = Number(pedido?.costo_envio || cotizacionGuardada?.costo || 0)
  const totalConEnvio = Number(pedido?.total || 0) + costoEnvio
  const puedePagar = ESTADOS_PAGABLES.includes(pedido?.estado) &&
    esCliente
  const puedeVerTracking = Boolean(despacho?.id) || ESTADOS_CON_TRACKING.includes(pedido?.estado)
  const timeline = useMemo(() => pedido ? estadoPasoPedido(pedido, pago, despacho, dte) : [], [pedido, pago, despacho, dte])

  if (loading) {
    return (
      <div className="page-container pedido-detalle-page">
        <div className="spinner" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-container pedido-detalle-page">
        <div className="card pedido-detalle-error">
          <h1>No disponible</h1>
          <p>{error}</p>
          <div className="error-actions">
            <button className="btn btn-secondary" onClick={() => navigate(-1)}>← Volver</button>
            <button className="btn btn-primary" onClick={() => navigate('/panel')}>Ir al panel</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container pedido-detalle-page">
      <div className="page-actionbar card">
        <div className="actionbar-left">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>
            ← Volver
          </button>
        </div>
        <div className="actionbar-right">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/panel')}>
            Ir al panel
          </button>
          {puedeVerTracking && (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/tracking/${pedido.id}`)}>
              Ver tracking
            </button>
          )}
          {dte?.id && (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/dte/${dte.id}/comprobante`)}>
              Ver comprobante DTE
            </button>
          )}
          {puedePagar && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/resultado-pago/${pedido.id}`)}>
              Pagar
            </button>
          )}
        </div>
      </div>

      <section className="pedido-hero card">
        <div>
          <h1>Pedido #{pedido.id}</h1>
          <div className="pedido-header-badges">
            <span className={`badge ${badgeEstadoPedido(pedido.estado)}`}>{pedido.estado_display || pedido.estado}</span>
            <span className="badge badge-secondary">{String(pedido.tipo_cliente || '').toUpperCase()}</span>
            <span className="text-muted">{formatFecha(pedido.creado_en)}</span>
          </div>
        </div>
        <div className="pedido-hero-total">
          <span>Total pedido</span>
          <strong>{formatPrecio(totalConEnvio)}</strong>
        </div>
      </section>

      <section className="card pedido-detalle-section">
        <h2>Ciclo del pedido</h2>
        <div className="pedido-timeline">
          {timeline.map((paso) => (
            <div className={`timeline-step ${paso.status}`} key={paso.label}>
              <span className="timeline-dot" />
              <div>
                <strong>{paso.label}</strong>
                <small>{paso.detail}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="pedido-detalle-grid">
        <section className="card pedido-detalle-section">
          <h2>Cliente y entrega</h2>
          <dl className="pedido-info-list">
            <div><dt>Cliente</dt><dd>{valor(pedido.usuario_nombre || pedido.usuario_username)}</dd></div>
            <div><dt>Usuario</dt><dd>{valor(pedido.usuario_username)}</dd></div>
            <div><dt>Email</dt><dd>{valor(pedido.usuario_email)}</dd></div>
            <div><dt>Rol</dt><dd>{valor(pedido.usuario_rol)}</dd></div>
            <div><dt>Tipo cliente</dt><dd>{String(pedido.tipo_cliente || '').toUpperCase() || 'No disponible'}</dd></div>
            <div><dt>Institución / razón social</dt><dd>No disponible</dd></div>
            <div className="info-wide"><dt>Dirección</dt><dd>{valor(pedido.direccion_entrega)}</dd></div>
            <div className="info-wide"><dt>Notas</dt><dd>{valor(pedido.notas)}</dd></div>
          </dl>
        </section>

        <section className="card pedido-detalle-section">
          <h2>Resumen financiero</h2>
          <div className="pedido-totales">
            <p><span>Subtotal productos</span><strong>{formatPrecio(pedido.subtotal)}</strong></p>
            <p className="muted-total"><span>Descuento B2B</span><strong>{formatPrecio(pedido.descuento)}</strong></p>
            <p>
              <span>
                Envío
                {cotizacionGuardada?.servicio ? ` · Chilexpress ${cotizacionGuardada.servicio}` : ''}
              </span>
              <strong>{costoEnvio > 0 ? formatPrecio(costoEnvio) : 'Sin costo'}</strong>
            </p>
            {cotizacionGuardada && (
              <p className="muted-total" style={{ fontSize: '0.78rem' }}>
                <span>Peso final {cotizacionGuardada.peso_kg} kg · cód. servicio {cotizacionGuardada.codigo}</span>
                <strong>{cotizacionGuardada.destino || ''}</strong>
              </p>
            )}
            <p className="pedido-total-final"><span>Total</span><strong>{formatPrecio(totalConEnvio)}</strong></p>
          </div>
        </section>
      </div>

      <section className="card pedido-detalle-section">
        <h2>Productos</h2>
        {detalles.length === 0 ? (
          <p className="text-muted">No hay productos disponibles para este pedido.</p>
        ) : (
          <div className="pedido-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Producto</th>
                  <th>Marca</th>
                  <th>Cantidad</th>
                  <th>Precio unitario</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {detalles.map((detalle) => (
                  <tr key={detalle.id}>
                    <td>{detalle.producto_codigo || detalle.producto_info?.codigo || '-'}</td>
                    <td>{detalle.producto_nombre || detalle.producto_info?.nombre || '-'}</td>
                    <td>{detalle.producto_info?.marca_nombre || 'No disponible'}</td>
                    <td>{detalle.cantidad}</td>
                    <td>{formatPrecio(detalle.precio_unitario)}</td>
                    <td>{formatPrecio(detalle.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="pedido-detalle-grid triple">
        <section className="card pedido-detalle-section pedido-status-card">
          <h2>Pago</h2>
          {pago ? (
            <>
              <span className={`badge ${pago.estado_pago === 'aprobado' ? 'badge-success' : 'badge-warning'}`}>
                {pago.estado_display || pago.estado_pago}
              </span>
              <p><strong>Método:</strong> {valor(pago.metodo_display || pago.metodo_pago)}</p>
              <p><strong>Monto:</strong> {formatPrecio(pago.monto)}</p>
              <p><strong>Fecha:</strong> {formatFecha(pago.fecha)}</p>
            </>
          ) : (
            <p className="text-muted">Pago no registrado.</p>
          )}
          {puedePagar && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/resultado-pago/${pedido.id}`)}>
              Pagar
            </button>
          )}
        </section>

        <section className="card pedido-detalle-section pedido-status-card">
          <h2>Despacho / Tracking</h2>
          {despacho ? (
            <>
              <span className="badge badge-info">{despacho.estado_display || despacho.estado_envio}</span>
              <p><strong>Courier:</strong> {valor(despacho.courier)}</p>
              <p><strong>Seguimiento:</strong> {valor(despacho.numero_seguimiento)}</p>
              <p><strong>Entrega estimada:</strong> {formatFecha(despacho.fecha_estimada)}</p>
            </>
          ) : (
            <p className="text-muted">Despacho no registrado.</p>
          )}
          {puedeVerTracking && (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/tracking/${pedido.id}`)}>
              Ver tracking
            </button>
          )}
        </section>

        <section className="card pedido-detalle-section pedido-status-card">
          <h2>DTE</h2>
          {dte ? (
            <>
              <span className="badge badge-info">{dte.estado_dte}</span>
              <p><strong>Tipo:</strong> {dte.tipo_documento_nombre}</p>
              <p><strong>Folio:</strong> {dte.folio}</p>
              <p><strong>Monto:</strong> {formatPrecio(dte.monto_total)}</p>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/dte/${dte.id}/comprobante`)}>
                Ver comprobante
              </button>
            </>
          ) : (
            <p className="text-muted">Documento tributario no generado.</p>
          )}
        </section>
      </div>
    </div>
  )
}
