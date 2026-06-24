import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPedido, simularPago, iniciarWebpay } from '../../services/api'
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

// Solo métodos simulados — WebPay Plus tiene su propio botón de flujo real arriba
const METODOS_SIMULADOS = [
  { value: 'tarjeta_credito', label: 'Tarjeta de Crédito', icon: '💳' },
  { value: 'tarjeta_debito', label: 'Tarjeta de Débito', icon: '💳' },
  { value: 'transferencia', label: 'Transferencia Bancaria', icon: '🏦' },
]

export default function ResultadoPagoPage() {
  const { pedidoId } = useParams()
  const navigate = useNavigate()
  const [pedido, setPedido] = useState(null)
  // Por defecto tarjeta_credito (webpay ya no está en esta lista)
  const [metodoPago, setMetodoPago] = useState('tarjeta_credito')
  const [numeroCuenta, setNumeroCuenta] = useState('4111 1111 1111 1111')
  const [titularCuenta, setTitularCuenta] = useState('')
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [procesandoWebpay, setProcesandoWebpay] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState('')

  // Form oculto que hace POST a Transbank
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

  // Flujo demo local: no llama a rutas backend pendientes.
  const handlePagoSimulado = async () => {
    setProcesando(true)
    setError('')
    try {
      const { data } = await simularPago({
        pedido_id: parseInt(pedidoId),
        metodo: metodoPago,
        numero_tarjeta: numeroCuenta,
        nombre_titular: titularCuenta,
        monto: totalConEnvio,
      })
      setResultado(data)
    } catch (err) {
      const data = err.response?.data
      if (data) setResultado(data)
      else setError('Error al procesar el pago.')
    } finally {
      setProcesando(false)
    }
  }

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
        // Fallback legacy: Guardar datos del form; el useEffect lo somete automáticamente
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
  if (error && !resultado) return <div className="page-container"><div className="alert alert-error">{error}</div></div>

  if (pedidoPagado(pedido) && !resultado) {
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

  // ── Pantalla de resultado del flujo simulado ──
  if (resultado) {
    const aprobado = resultado.aprobado
    return (
      <div className="page-container">
        <div className={`resultado-card card ${aprobado ? 'resultado-aprobado' : 'resultado-rechazado'}`}>
          <div className="resultado-icon">{aprobado ? '✅' : '❌'}</div>
          <h2>{aprobado ? '¡Pago aprobado!' : 'Pago rechazado'}</h2>
          <p className="text-muted" style={{marginBottom:16}}>
            {aprobado
              ? 'Tu pedido ha sido confirmado y está siendo preparado.'
              : `Motivo: ${resultado.motivo_rechazo || 'Error en el procesamiento'}`
            }
          </p>
          {aprobado && (
            <div className="resultado-detalles">
              <div className="detalle-fila">
                <span>N° Pedido</span><strong>#{pedidoId}</strong>
              </div>
              <div className="detalle-fila">
                <span>Código transacción</span>
                <strong style={{fontFamily:'monospace'}}>{resultado.codigo_transaccion}</strong>
              </div>
              <div className="detalle-fila">
                <span>Método</span><strong>{resultado.metodo_display}</strong>
              </div>
              <div className="detalle-fila">
                <span>Monto pagado</span><strong>{formatPrecio(resultado.monto)}</strong>
              </div>
              <div className="detalle-fila">
                <span>Estado</span>
                <span className="badge badge-success">{resultado.estado_display}</span>
              </div>
            </div>
          )}
          <div className="resultado-acciones">
            {aprobado ? (
              <>
                <button className="btn btn-primary" onClick={() => navigate(`/tracking/${pedidoId}`)}>
                  Ver tracking del pedido →
                </button>
                <button className="btn btn-secondary" onClick={() => navigate('/catalogo')}>
                  Seguir comprando
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-primary" onClick={() => setResultado(null)}>
                  Intentar de nuevo
                </button>
                <button className="btn btn-secondary" onClick={() => navigate('/catalogo')}>
                  Volver al catálogo
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Pantalla principal de selección de método ──
  return (
    <div className="page-container">
      <h1 className="page-title">Pago del Pedido #{pedidoId}</h1>

      {error && <div className="alert alert-error">{error}</div>}

      {pedido && (
        <div className="pago-layout">

          {/* ── Columna izquierda: métodos de pago ── */}
          <div className="card">
            <h3 className="section-title">Selecciona método de pago</h3>

            {/* Sección 1: WebPay Plus real (llama a /api/payments/webpay/iniciar/) */}
            <div className="webpay-real-box">
              <div className="webpay-real-header">
                <span className="webpay-logo">🏦</span>
                <div>
                  <strong>WebPay Plus — Transbank</strong>
                  <span className="badge badge-info" style={{marginLeft:8, fontSize:'0.7rem'}}>
                    Ambiente TEST
                  </span>
                  <p className="text-muted" style={{fontSize:'0.8rem', margin:'2px 0 0'}}>
                    Integración real. Redirige al formulario de Transbank.
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

            {/* Sección 2: Métodos simulados (demo académico) */}
            <div className="metodos-divider">
              <span>o usar método de pago simulado (demo)</span>
            </div>

            <div className="metodos-grid">
              {METODOS_SIMULADOS.map(m => (
                <button
                  key={m.value}
                  className={`metodo-btn ${metodoPago === m.value ? 'metodo-activo' : ''}`}
                  onClick={() => setMetodoPago(m.value)}
                >
                  <span>{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>

            {metodoPago !== 'transferencia' && (
              <div className="mt-2">
                <h4 style={{marginBottom:12, fontSize:'0.875rem'}}>Datos de tarjeta (simulados)</h4>
                <div className="form-group">
                  <label>Número de tarjeta</label>
                  <input
                    type="text" value={numeroCuenta}
                    onChange={e => setNumeroCuenta(e.target.value)}
                    placeholder="0000 0000 0000 0000" maxLength={19}
                  />
                  <small className="text-muted">Termina en 0000 = rechazo simulado</small>
                </div>
                <div className="form-group">
                  <label>Nombre del titular</label>
                  <input
                    type="text" value={titularCuenta}
                    onChange={e => setTitularCuenta(e.target.value)}
                    placeholder="Nombre en la tarjeta"
                  />
                </div>
              </div>
            )}

            {metodoPago === 'transferencia' && (
              <div className="info-banco mt-2">
                <p><strong>Banco:</strong> Banco MEDISTOCK</p>
                <p><strong>Cuenta corriente:</strong> 12345678</p>
                <p><strong>RUT:</strong> 76.543.210-9</p>
                <p><strong>Email confirmación:</strong> pagos@medistock.cl</p>
              </div>
            )}
          </div>

          {/* ── Columna derecha: resumen + botón pago simulado ── */}
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
            {pedido.descuento > 0 && (
              <div className="resumen-item" style={{color:'var(--color-success)'}}>
                <span>Descuento</span><span>− {formatPrecio(pedido.descuento)}</span>
              </div>
            )}
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

            {/* Este botón solo ejecuta el flujo simulado */}
            <button
              className="btn btn-secondary btn-block btn-lg mt-2"
              onClick={handlePagoSimulado}
              disabled={procesando}
            >
              {procesando
                ? 'Procesando...'
                : `Pagar (simulado) ${formatPrecio(totalConEnvio)}`
              }
            </button>
            <p className="text-muted mt-1" style={{fontSize:'0.72rem', textAlign:'center'}}>
              🔒 MEDISTOCK Secure Gateway — pago simulado para demo
            </p>
          </div>

        </div>
      )}
    </div>
  )
}
