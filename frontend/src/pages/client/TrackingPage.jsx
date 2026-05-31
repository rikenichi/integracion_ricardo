import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { generarTracking, getPedido, getTracking } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import './TrackingPage.css'

const ESTADOS_ORDEN = ['generado', 'en_bodega', 'en_ruta', 'entregado']
const ETIQUETAS_ESTADO = {
  generado: 'Generado',
  en_bodega: 'En Bodega',
  en_ruta: 'En Ruta',
  entregado: 'Entregado',
  fallido: 'Intento Fallido',
}
const ICONOS_ESTADO = {
  generado: 'GEN',
  en_bodega: 'BOD',
  en_ruta: 'RUTA',
  entregado: 'OK',
  fallido: 'ERR',
}

function normalizarEstadoTracking(valor) {
  const estado = String(valor || '').toLowerCase()
  if (estado.includes('delivered') || estado.includes('entregado')) return 'entregado'
  if (estado.includes('route') || estado.includes('transit') || estado.includes('ruta')) return 'en_ruta'
  if (estado.includes('warehouse') || estado.includes('bodega') || estado.includes('pendiente')) return 'en_bodega'
  if (estado.includes('fail') || estado.includes('rechaz')) return 'fallido'
  return estado || 'generado'
}

function normalizarEventoTracking(evento, index) {
  return {
    id: evento.id || evento.eventId || `${evento.timestamp || evento.date || 'evento'}-${index}`,
    estado: normalizarEstadoTracking(evento.estado || evento.status || evento.eventCode),
    descripcion: evento.descripcion || evento.description || evento.statusDescription || 'Evento de seguimiento',
    ubicacion: evento.ubicacion || evento.location || evento.officeName || '',
    timestamp: evento.timestamp || evento.date || evento.eventDate || new Date().toISOString(),
  }
}

function normalizarDespachoTracking(payload, pedidoId) {
  const base = payload?.despacho || payload?.data || payload || {}
  const eventos = base.eventos || base.events || base.trackingEvents || []

  return {
    pedido: base.pedido || base.pedido_id || pedidoId,
    numero_tracking:
      base.numero_tracking ||
      base.numero_seguimiento ||
      base.transportOrderNumber ||
      base.transport_order_number ||
      `PED-${pedidoId}`,
    courier: base.courier || base.courier_nombre || 'Chilexpress',
    estado: normalizarEstadoTracking(base.estado || base.estado_envio || base.status),
    fecha_estimada_entrega: base.fecha_estimada_entrega || base.fecha_entrega_estimada || null,
    direccion_destino: base.direccion_destino || base.destinationAddress || 'Direccion registrada en el pedido',
    eventos: Array.isArray(eventos) ? eventos.map(normalizarEventoTracking) : [],
  }
}

export default function TrackingPage() {
  const { despachoId } = useParams()
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [despacho, setDespacho] = useState(null)
  const [pedido, setPedido] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [generando, setGenerando] = useState(false)

  const esOperador = usuario?.rol === 'operador' || usuario?.rol === 'admin'

  const cargarPedidoRelacionado = async (pedidoId) => {
    try {
      const { data } = await getPedido(pedidoId)
      setPedido(data)
    } catch {
      setPedido(null)
    }
  }

  const cargarTracking = async () => {
    setLoading(true)
    try {
      const { data } = await getTracking(despachoId)
      const despachoNormalizado = normalizarDespachoTracking(data, despachoId)
      setDespacho(despachoNormalizado)
      await cargarPedidoRelacionado(despachoNormalizado.pedido || despachoId)
      setError('')
    } catch (err) {
      if (err.response?.status === 404) {
        await cargarPedidoRelacionado(despachoId)
        setError('Este pedido aún no tiene despacho generado.')
      } else {
        setPedido(null)
        setError('No se pudo cargar el tracking.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargarTracking() }, [despachoId])

  const handleGenerarTracking = async () => {
    setGenerando(true)
    try {
      const { data } = await generarTracking(parseInt(despachoId))
      setDespacho(data)
      await cargarPedidoRelacionado(data.pedido || despachoId)
      setError('')
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo generar el tracking.')
    } finally {
      setGenerando(false)
    }
  }

  if (loading) return <div className="spinner" />

  return (
    <div className="page-container">
      <div className="tracking-actions card">
        <div className="actionbar-left">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>
            ← Volver
          </button>
        </div>
        <div className="actionbar-right">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/panel')}>
            Ir al panel
          </button>
          {pedido?.id && (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/pedidos/${pedido.id}`)}>
              Ver detalle del pedido
            </button>
          )}
          {pedido?.dte_info?.id && (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/dte/${pedido.dte_info.id}/comprobante`)}>
              Ver comprobante DTE
            </button>
          )}
        </div>
      </div>

      <h1 className="page-title">Seguimiento del Pedido #{despachoId}</h1>

      {error && (
        <div className="alert alert-info">
          {error}
          {esOperador && (
            <button
              className="btn btn-primary btn-sm"
              style={{ marginLeft: 12 }}
              onClick={handleGenerarTracking}
              disabled={generando}
            >
              {generando ? 'Generando...' : 'Generar tracking'}
            </button>
          )}
        </div>
      )}

      {despacho && (
        <div className="tracking-layout">
          <div className="card">
            <div className="tracking-header">
              <div>
                <p className="text-muted" style={{ fontSize: '0.8rem' }}>Número de tracking</p>
                <p className="tracking-numero">{despacho.numero_tracking}</p>
                <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                  {despacho.courier}
                </p>
              </div>
              <div className="text-right">
                <p className="text-muted" style={{ fontSize: '0.8rem' }}>Entrega estimada</p>
                <p style={{ fontWeight: 600 }}>
                  {despacho.fecha_estimada_entrega
                    ? new Date(despacho.fecha_estimada_entrega + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
                    : 'Por confirmar'
                  }
                </p>
              </div>
            </div>

            <div className="estado-progreso">
              {ESTADOS_ORDEN.map((estado, idx) => {
                const ordenActual = ESTADOS_ORDEN.indexOf(despacho.estado)
                const activo = idx <= ordenActual
                const esCurrent = estado === despacho.estado
                return (
                  <div key={estado} className={`paso ${activo ? 'paso-activo' : ''} ${esCurrent ? 'paso-current' : ''}`}>
                    <div className="paso-icono">{ICONOS_ESTADO[estado]}</div>
                    <div className="paso-label">{ETIQUETAS_ESTADO[estado]}</div>
                    {idx < ESTADOS_ORDEN.length - 1 && (
                      <div className={`paso-linea ${activo && idx < ordenActual ? 'linea-activa' : ''}`} />
                    )}
                  </div>
                )
              })}
            </div>

            <div className="tracking-destino">
              <p className="text-muted" style={{ fontSize: '0.8rem' }}>Dirección de entrega</p>
              <p>{despacho.direccion_destino}</p>
            </div>
          </div>

          <div className="card">
            <div className="flex-between" style={{ marginBottom: 12 }}>
              <h3 className="section-title" style={{ margin: 0 }}>Historial de eventos</h3>
              <button className="btn btn-secondary btn-sm" onClick={cargarTracking}>
                Actualizar
              </button>
            </div>
            {despacho.eventos?.length === 0 ? (
              <p className="text-muted">Sin eventos registrados.</p>
            ) : (
              <div className="eventos-lista">
                {despacho.eventos.map(ev => (
                  <div key={ev.id} className="evento">
                    <div className="evento-icono">{ICONOS_ESTADO[ev.estado] || 'LOC'}</div>
                    <div className="evento-info">
                      <p className="evento-desc">{ev.descripcion}</p>
                      {ev.ubicacion && <p className="text-muted evento-ubicacion">{ev.ubicacion}</p>}
                      <p className="text-muted evento-fecha">
                        {new Date(ev.timestamp).toLocaleString('es-CL')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
