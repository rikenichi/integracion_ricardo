import { useNavigate, useSearchParams } from 'react-router-dom'
import './WebpayResultadoPage.css'

function formatPrecio(n) {
  if (!n) return '—'
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n)
}

export default function WebpayResultadoPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const estado = params.get('estado')
  const exito = params.get('exito') === 'true' || estado === 'CONFIRMADO'
  const cancelado = params.get('cancelado') === 'true' || estado === 'ANULADO'
  const pedidoId = params.get('pedido_id')
  const transaccionId = params.get('transaccion_id')
  const authCode = params.get('auth_code')
  const monto = params.get('monto')
  const responseCode = params.get('response_code')
  const errorMsg = params.get('error')

  return (
    <div className="page-container">
      <div className={`wp-resultado-card card ${exito ? 'wp-aprobado' : 'wp-rechazado'}`}>

        <div className="wp-resultado-icon">{exito ? '✅' : cancelado ? '↩️' : '❌'}</div>

        <h2>
          {exito
            ? '¡Pago aprobado por Transbank!'
            : cancelado
            ? 'Pago cancelado'
            : 'Pago rechazado por Transbank'
          }
        </h2>

        <p className="text-muted wp-subtitulo">
          {exito
            ? 'Tu transacción fue procesada exitosamente. El pedido está en preparación.'
            : cancelado
            ? 'Cancelaste el proceso en el formulario de Transbank.'
            : `Transbank rechazó la transacción${responseCode ? ` (código ${responseCode})` : ''}.`
          }
        </p>

        {exito && (
          <div className="wp-detalles">
            <div className="wp-fila">
              <span>N° Pedido</span>
              <strong>#{pedidoId}</strong>
            </div>
            {transaccionId && (
              <div className="wp-fila">
                <span>ID transacción</span>
                <strong style={{fontFamily:'monospace'}}>{transaccionId}</strong>
              </div>
            )}
            <div className="wp-fila">
              <span>Código autorización</span>
              <strong style={{fontFamily:'monospace'}}>{authCode || '—'}</strong>
            </div>
            <div className="wp-fila">
              <span>Monto pagado</span>
              <strong>{formatPrecio(monto)}</strong>
            </div>
            <div className="wp-fila">
              <span>Pasarela</span>
              <strong>WebPay Plus — Transbank (TEST)</strong>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="alert alert-error" style={{marginTop:16, textAlign:'left'}}>
            {decodeURIComponent(errorMsg)}
          </div>
        )}

        <div className="wp-acciones">
          {exito && pedidoId ? (
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
              {pedidoId && (
                <button className="btn btn-primary"
                  onClick={() => navigate(`/resultado-pago/${pedidoId}`)}>
                  Intentar de nuevo
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => navigate('/panel')}>
                Ir a mi panel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
