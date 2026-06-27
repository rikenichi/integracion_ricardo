import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPedido, iniciarWebpay } from '../../services/api'
import { obtenerCotizacionPedido } from '../../utils/cotizacionStorage'
import './ResultadoPagoPage.css'

function formatPrecio(n) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n)
}

function pedidoPagado(pedido) {
  const estadoPedido = String(pedido?.estado || '').toUpperCase()
  const estadoPago = String(
    pedido?.pago?.estado || pedido?.pago_info?.estado_pago || ''
  ).toUpperCase()

  return ['CONFIRMADO', 'APROBADO'].includes(estadoPedido) ||
    ['CONFIRMADO', 'APROBADO', 'AUTHORIZED'].includes(estadoPago)
}

export default function ResultadoPagoPage() {
  const { pedidoId } = useParams()
  const navigate = useNavigate()
  const [pedido, setPedido] = useState(null)
  const [loading, setLoading] = useState(true)
  const [procesandoWebpay, setProcesandoWebpay] = useState(false)
  const [error, setError] = useState('')

  // Form oculto que hace POST a Transbank (fallback legacy)
  const webpayFormRef = useRef(null)
  const [webpayData, setWebpayData] = useState(null)

  useEffect(() => {
    getPedido(pedidoId)
      .then(r => setPedido(r.data))
      .catch(() => setError('Pedido no encontrado.'))
      .finally(() => setLoading(false))
  }, [pedidoId])

  // Cotización Chilexpress persistida desde el checkout (frontend-only,
  // el backend aún no tiene campo costo_envio en el modelo Pedido).
  const cotizacionGuardada = useMemo(() => obtenerCotizacionPedido(pedidoId), [pedidoId])
  const costoEnvio = Number(pedido?.costo_envio || cotizacionGuardada?.costo || 0)
  const totalConEnvio = Number(pedido?.total || 0) + costoEnvio

  // Flujo real — llama a POST /api/payments/webpay/iniciar/ y redirige a Transbank
  const handleWebpayReal = async () => {
    setProcesandoWebpay(true)
    setError('')
    try {
      const { data } = await iniciarWebpay(parseInt(pedidoId))
      if (data?.redirect_url) {
        window.location.href = data.redirect_url
        return
      }
      if (data?.url && data?.token) {
        // Fallback legacy: guardar datos del form; el useEffect lo somete automáticamente
        setWebpayData(data)
        return
      }
      setError('Respuesta inesperada al iniciar Webpay. Intenta nuevamente.')
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Error al conectar con Transbank.')
      setProcesandoWebpay(false)
    }
  }

  // Una vez que webpayData está en el DOM, auto-submit el form hacia Transbank
  useEffect(() => {
    if (webpayData && webpayFormRef.current) {
      webpayFormRef.current.submit()
    }
  }, [webpayData])

  if (loading) return <div className="spinner" />
  if (error) return <div className="page-container"><div className="alert alert-error">{error}</div></div>

  if (pedidoPagado(pedido)) {
    return (
      <div className="page-container">
        <div className="resultado-card card resultado-aprobado">
          <div className="resultado-icon">✓</div>
          <h2>Pago aprobado</h2>
          <p className="text-muted" style={{ marginBottom: 16 }}>
            El pedido fue confirmado y su despacho ya está en preparación.
          </p>
          <div className="resultado-detalles">
            <div className="detalle-fila">
              <span>Pedido</span><strong>#{pedidoId}</strong>
            </div>
            <div className="detalle-fila">
              <span>Estado</span>
              <span className="badge badge-success">Pago aprobado</span>
            </div>
            <div className="detalle-fila">
              <span>Despacho</span>
              <span className="badge badge-info">Despacho generado</span>
            </div>
            <div className="detalle-fila">
              <span>Documento tributario</span>
              <span className="badge badge-warning">Pendiente</span>
            </div>
          </div>
          <div className="resultado-acciones">
            <button className="btn btn-primary" onClick={() => navigate(`/tracking/${pedidoId}`)}>
              Ver tracking del pedido
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/panel')}>
              Ir a Mi Panel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Pantalla principal de pago ──
  return (
    <div className="page-container">
      <h1 className="page-title">Pago del Pedido #{pedidoId}</h1>

      {error && <div className="alert alert-error">{error}</div>}

      {pedido && (
        <div className="pago-layout">

          {/* ── Columna izquierda: Webpay Plus ── */}
          <div className="card">
            <h3 className="section-title">Método de pago</h3>

            <div className="webpay-real-box">
              <div className="webpay-real-header">
                <span className="webpay-logo">🏦</span>
                <div>
                  <strong>WebPay Plus — Transbank</strong>
                  <span className="badge badge-info" style={{marginLeft:8, fontSize:'0.7rem'}}>
                    Ambiente TEST
                  </span>
                  <p className="text-muted" style={{fontSize:'0.8rem', margin:'2px 0 0'}}>
                    Integración real con Transbank. Serás redirigido al formulario de pago seguro.
                  </p>
                </div>
              </div>

              <button
                className="btn btn-webpay btn-block"
                onClick={handleWebpayReal}
                disabled={procesandoWebpay}
              >
                {procesandoWebpay
                  ? 'Conectando con Transbank...'
                  : `🏦 Pagar ${formatPrecio(totalConEnvio)} con WebPay Plus`
                }
              </button>

              <p className="text-muted mt-1" style={{fontSize:'0.72rem', textAlign:'center'}}>
                🔒 Pago seguro procesado por Transbank
              </p>

              {/* Form oculto — se auto-submitea cuando webpayData queda en el DOM */}
              {webpayData && (
                <form
                  ref={webpayFormRef}
                  method="POST"
                  action={webpayData.url}
                  style={{display: 'none'}}
                >
                  <input type="hidden" name="token_ws" value={webpayData.token} />
                </form>
              )}
            </div>
          </div>

          {/* ── Columna derecha: resumen del pedido ── */}
          <div className="card">
            <h3 className="section-title">Resumen del pedido</h3>
            <div className="resumen-item">
              <span>Pedido #</span><span>{pedido.id}</span>
            </div>
            <div className="resumen-item">
              <span>Estado</span>
              <span className="badge badge-warning">{pedido.estado_display}</span>
            </div>
            <div className="resumen-item">
              <span>Productos</span><span>{pedido.detalles?.length}</span>
            </div>
            <div className="resumen-item">
              <span>Subtotal productos</span><span>{formatPrecio(pedido.subtotal)}</span>
            </div>
            <hr className="divider" />
            {pedido.descuento > 0 && (() => {
              const pct = pedido.descuento
              const subtotalOriginal = Math.round(pedido.subtotal / (1 - pct / 100))
              const montoDescontado = subtotalOriginal - pedido.subtotal
              return (
                <div className="resumen-item" style={{color:'var(--color-success)'}}>
                  <span>Descuento B2B ({pct}%)</span><span>− {formatPrecio(montoDescontado)}</span>
                </div>
              )
            })()}
            <div className="resumen-item">
              <span>
                Envío
                {cotizacionGuardada?.servicio
                  ? ` (Chilexpress ${cotizacionGuardada.servicio})`
                  : pedido.courier_nombre
                    ? ` (${pedido.courier_nombre})`
                    : ''}
              </span>
              <span>
                {costoEnvio > 0 ? formatPrecio(costoEnvio) : 'Sin costo'}
              </span>
            </div>
            {cotizacionGuardada && (
              <div className="resumen-item" style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                <span>Peso final · {cotizacionGuardada.peso_kg} kg · destino {cotizacionGuardada.destino || '—'}</span>
                <span>Cód. servicio {cotizacionGuardada.codigo}</span>
              </div>
            )}
            <div className="resumen-item resumen-total">
              <span>Total a pagar</span><span>{formatPrecio(totalConEnvio)}</span>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
