import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { obtenerProductoCompatible, obtenerStockProductoCompatible } from '../../services/api'
import { useCarrito } from '../../context/CarritoContext'
import { useAuth } from '../../context/AuthContext'
import { puedeComprar, razonNoCompra } from '../../utils/permisos'
import { Badge, Button, Spinner } from '../../components/ui'
import { formatPrecio, obtenerPrecioProducto } from '../../utils/format'
import './ProductoDetallePage.css'

export default function ProductoDetallePage() {
  const { codigo } = useParams()
  const [producto, setProducto] = useState(null)
  const [stock, setStock] = useState(null)
  const [cantidad, setCantidad] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingStock, setLoadingStock] = useState(false)
  const [error, setError] = useState('')
  const [errorStock, setErrorStock] = useState('')
  const [agregado, setAgregado] = useState(false)
  const { agregarItem } = useCarrito()
  const { usuario } = useAuth()
  const esB2B = usuario?.rol === 'cliente_b2b'

  useEffect(() => {
    setLoading(true)
    setError('')
    setErrorStock('')
    obtenerProductoCompatible(codigo)
      .then(data => setProducto(data))
      .catch(() => setError('Producto no encontrado.'))
      .finally(() => setLoading(false))
  }, [codigo])

  const verStock = () => {
    setLoadingStock(true)
    setErrorStock('')
    obtenerStockProductoCompatible(codigo)
      .then(data => setStock(data))
      .catch(() => setErrorStock('No se pudo cargar el stock por sucursal. Puedes agregar el producto y validar disponibilidad en el checkout.'))
      .finally(() => setLoadingStock(false))
  }

  if (loading) return <Spinner />
  if (error) return <div className="page-container"><div className="alert alert-error">{error}</div></div>
  if (!producto) return null

  const precio = obtenerPrecioProducto(producto, esB2B)
  const stockDisponible = Number(producto.stock_disponible ?? producto.stock ?? 0)
  const sinStock = stockDisponible <= 0
  const usuarioPuedeComprar = puedeComprar(usuario)
  const mensajeNoCompra = razonNoCompra(usuario)
  const bloqueado = sinStock || !usuarioPuedeComprar

  const handleAgregar = () => {
    if (bloqueado) return
    agregarItem(producto, cantidad)
    setAgregado(true)
    setTimeout(() => setAgregado(false), 2000)
  }

  return (
    <div className="page-container">
      <Link to="/catalogo" className="text-muted" style={{fontSize:'0.875rem'}}>← Volver al catálogo</Link>

      <div className="detalle-grid mt-2">
        <div className="detalle-imagen card">
          <span style={{fontSize:'5rem'}}>🏥</span>
          <Badge variant="secondary" className="mt-1">{producto.categoria_nombre}</Badge>
        </div>

        <div className="detalle-info">
          <div className="card">
            <p className="text-muted" style={{fontSize:'0.8rem'}}>{producto.codigo}</p>
            <h1 style={{fontSize:'1.5rem', fontWeight:700, margin:'8px 0'}}>{producto.nombre}</h1>

            {producto.tipo_producto && (
              <span className="badge badge-info" style={{marginRight:6, marginBottom:8}}>
                {producto.tipo_producto}
              </span>
            )}
            {producto.dosis && (
              <span className="badge badge-secondary" style={{marginBottom:8}}>
                Presentación {producto.dosis}
              </span>
            )}

            {producto.requiere_receta && (
              <span className="badge badge-warning" style={{display:'block', marginBottom:12}}>
                Requiere receta médica
              </span>
            )}

            <p style={{color:'var(--color-text-muted)', marginBottom:16}}>{producto.descripcion}</p>

            <div className="precio-container">
              <span className="precio-label">{esB2B ? 'Precio B2B' : 'Precio'}</span>
              <span className="precio-valor">{formatPrecio(precio)}</span>
              {esB2B && <span className="text-muted" style={{fontSize:'0.8rem'}}>con 10% descuento al facturar</span>}
            </div>

            <p className="text-muted" style={{fontSize:'0.85rem'}}>
              Unidad: {producto.unidad_medida}
            </p>

            <p style={{fontSize:'0.85rem', marginTop:4}}>
              Stock disponible:{' '}
              <span className={`badge ${sinStock ? 'badge-danger' : stockDisponible <= 10 ? 'badge-warning' : 'badge-success'}`}>
                {sinStock ? 'Sin stock' : `${stockDisponible} unidades`}
              </span>
            </p>

            <hr className="divider" />

            {sinStock && (
              <div className="alert alert-error" style={{marginBottom:12}}>
                Este producto está agotado y no puede agregarse al carrito.
              </div>
            )}

            {!usuarioPuedeComprar && !sinStock && (
              <div className="alert alert-info" style={{marginBottom:12}}>
                {mensajeNoCompra}
              </div>
            )}

            <div style={{display:'flex', gap:12, alignItems:'center', marginBottom:16}}>
              <label style={{fontWeight:500}}>Cantidad:</label>
              <input
                type="number" min={1} max={sinStock ? 1 : stockDisponible} value={cantidad}
                onChange={e => setCantidad(parseInt(e.target.value) || 1)}
                disabled={sinStock}
                style={{width:80, padding:'8px', border:'1px solid var(--color-border)', borderRadius:'var(--radius)'}}
              />
            </div>

            <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
              <button
                className={`btn btn-primary btn-lg ${agregado ? 'btn-success' : ''}`}
                onClick={handleAgregar}
                disabled={bloqueado}
                title={
                  sinStock
                    ? 'Producto sin stock'
                    : !usuarioPuedeComprar
                      ? mensajeNoCompra
                      : ''
                }
              >
                {sinStock
                  ? '✕ Sin stock'
                  : !usuarioPuedeComprar
                    ? '🔒 No disponible para tu rol'
                    : agregado
                      ? '✓ Agregado al carrito'
                      : '🛒 Agregar al carrito'}
              </button>
              <Button variant="secondary" onClick={verStock} loading={loadingStock}>
                {loadingStock ? 'Consultando...' : '📦 Ver stock por sucursal'}
              </Button>
            </div>
            {errorStock && <div className="alert alert-warning mt-1">{errorStock}</div>}
          </div>

          {stock && (
            <div className="card mt-2">
              <h3 className="section-title">Stock por sucursal</h3>
              {stock.stock_por_sucursal.length === 0 ? (
                <p className="text-muted">Sin stock registrado.</p>
              ) : (
                <table className="stock-table">
                  <thead>
                    <tr>
                      <th>Sucursal</th>
                      <th>Ciudad</th>
                      <th>Disponible</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock.stock_por_sucursal.map(s => (
                      <tr key={s.sucursal_id}>
                        <td>{s.sucursal}</td>
                        <td>{s.ciudad}</td>
                        <td><strong>{s.disponible}</strong></td>
                        <td>
                          <span className={`badge ${s.disponible > 5 ? 'badge-success' : s.disponible > 0 ? 'badge-warning' : 'badge-danger'}`}>
                            {s.disponible > 5 ? 'Disponible' : s.disponible > 0 ? 'Stock bajo' : 'Sin stock'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
