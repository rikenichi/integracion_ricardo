import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { obtenerDocumentoTributarioDetalle } from '../../services/api'
import './ComprobanteDtePage.css'

function formatPrecio(valor) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(Number(valor || 0))
}

function formatFecha(valor) {
  if (!valor) return '-'
  return new Date(valor).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export default function ComprobanteDtePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [documento, setDocumento] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const cargarDocumento = async () => {
      setLoading(true)
      setError('')
      try {
        const { data } = await obtenerDocumentoTributarioDetalle(id)
        setDocumento(data)
      } catch (e) {
        if ([403, 404].includes(e.response?.status)) {
          setError('No pudimos encontrar este comprobante o no tienes permiso para verlo.')
        } else {
          setError('No se pudo cargar el comprobante tributario simulado.')
        }
      } finally {
        setLoading(false)
      }
    }

    cargarDocumento()
  }, [id])

  if (loading) {
    return (
      <div className="page-container comprobante-page">
        <div className="spinner" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-container comprobante-page">
        <div className="card comprobante-error">
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

  const detalles = Array.isArray(documento?.detalles) ? documento.detalles : []

  return (
    <div className="page-container comprobante-page">
      <div className="comprobante-actions">
        <div className="actionbar-left">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>
            ← Volver
          </button>
        </div>
        <div className="actionbar-right">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/panel')}>
            Ir al panel
          </button>
          {documento?.pedido && (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/pedidos/${documento.pedido}`)}>
              Ver detalle del pedido
            </button>
          )}
          {documento?.pedido && (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/tracking/${documento.pedido}`)}>
              Ver tracking
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
            Imprimir
          </button>
        </div>
      </div>

      <article className="comprobante-card">
        <header className="comprobante-header">
          <div>
            <div className="comprobante-brand">
              <span className="comprobante-logo">M</span>
              <div>
                <strong>MEDISTOCK</strong>
                <small>Farmacia e insumos médicos</small>
              </div>
            </div>
            <p className="comprobante-subtitle">Documento tributario simulado</p>
          </div>
          <div className="comprobante-folio">
            <span>{documento?.tipo_documento_nombre || 'Documento'}</span>
            <strong>Folio {documento?.folio || '-'}</strong>
            <small>{documento?.estado_dte || '-'}</small>
          </div>
        </header>

        <section className="comprobante-grid">
          <div>
            <h2>Emisión</h2>
            <p><strong>Fecha:</strong> {formatFecha(documento?.fecha_emision)}</p>
            <p><strong>Pedido:</strong> {documento?.pedido ? `#${documento.pedido}` : '-'}</p>
            <p><strong>Forma de pago:</strong> {documento?.forma_pago || '-'}</p>
          </div>
          <div>
            <h2>Receptor</h2>
            <p><strong>Razón social:</strong> {documento?.razon_social_receptor || documento?.cliente_username || '-'}</p>
            <p><strong>RUT:</strong> {documento?.rut_receptor || '-'}</p>
            <p><strong>Email:</strong> {documento?.email_receptor || '-'}</p>
            <p><strong>Dirección:</strong> {documento?.direccion_receptor || '-'}</p>
          </div>
        </section>

        <section className="comprobante-section">
          <h2>Detalle</h2>
          {detalles.length === 0 ? (
            <p className="text-muted">Este comprobante no incluye detalle de productos disponible.</p>
          ) : (
            <div className="comprobante-table-wrap">
              <table className="comprobante-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Precio</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detalles.map((detalle) => (
                    <tr key={detalle.id}>
                      <td>{detalle.codigo_producto || '-'}</td>
                      <td>{detalle.nombre_producto || detalle.descripcion || '-'}</td>
                      <td>{detalle.cantidad || '-'}</td>
                      <td>{formatPrecio(detalle.precio_unitario)}</td>
                      <td>{formatPrecio(detalle.monto_total_linea)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="comprobante-totales">
          <div>
            {documento?.observacion && (
              <>
                <h2>Observación</h2>
                <p>{documento.observacion}</p>
              </>
            )}
          </div>
          <div className="totales-box">
            <p><span>Neto</span><strong>{formatPrecio(documento?.monto_neto)}</strong></p>
            <p><span>IVA</span><strong>{formatPrecio(documento?.monto_iva)}</strong></p>
            <p className="total-final"><span>Total</span><strong>{formatPrecio(documento?.monto_total)}</strong></p>
          </div>
        </section>

        <footer className="comprobante-footer">
          Este comprobante es una representación simulada para MEDISTOCK. No corresponde a emisión tributaria real ni envío al SII.
        </footer>
      </article>
    </div>
  )
}
