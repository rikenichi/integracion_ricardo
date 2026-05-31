import { useNavigate } from 'react-router-dom'
import { useCarrito } from '../../context/CarritoContext'
import { useAuth } from '../../context/AuthContext'
import { Button, EmptyState } from '../../components/ui'
import { formatPrecio, obtenerPrecioProducto } from '../../utils/format'
import { puedeComprar, razonNoCompra } from '../../utils/permisos'
import './CarritoPage.css'

export default function CarritoPage() {
  const {
    items,
    quitarItem,
    actualizarCantidad,
    vaciarCarrito,
    calcularResumen,
    tipoDespacho,
    setTipoDespacho,
  } = useCarrito()
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const esB2B = usuario?.rol === 'cliente_b2b'
  const usuarioPuedeComprar = puedeComprar(usuario)
  const mensajeNoCompra = razonNoCompra(usuario)

  const { subtotal, descuento, neto, iva, total } = calcularResumen({ esB2B })

  if (items.length === 0) {
    return (
      <div className="page-container">
        <EmptyState
          icon="🛒"
          titulo="Tu carrito está vacío"
          descripcion="Agrega productos desde el catálogo."
          accion={
            <Button variant="primary" onClick={() => navigate('/catalogo')}>
              Ir al catálogo
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="flex-between">
        <h1 className="page-title">Carrito de Compras</h1>
        <Button variant="secondary" size="sm" onClick={vaciarCarrito}>
          Vaciar carrito
        </Button>
      </div>

      <div className="carrito-layout">
        <div className="carrito-items">
          {items.map(({ producto, cantidad }) => {
            const precio = obtenerPrecioProducto(producto, esB2B)
            return (
              <div key={producto.id} className="item-row card">
                <div className="item-icon">🏥</div>
                <div className="item-info">
                  <p className="item-nombre">{producto.nombre}</p>
                  <p className="text-muted" style={{ fontSize: '0.8rem' }}>{producto.codigo}</p>
                  <p className="item-precio">{formatPrecio(precio)} / {producto.unidad_medida}</p>
                </div>
                <div className="item-cantidad">
                  <Button variant="secondary" size="sm" onClick={() => actualizarCantidad(producto.id, cantidad - 1)}>−</Button>
                  <span>{cantidad}</span>
                  <Button variant="secondary" size="sm" onClick={() => actualizarCantidad(producto.id, cantidad + 1)}>+</Button>
                </div>
                <div className="item-subtotal">
                  {formatPrecio(parseFloat(precio) * cantidad)}
                </div>
                <Button variant="danger" size="sm" onClick={() => quitarItem(producto.id)} aria-label="Quitar producto">
                  ✕
                </Button>
              </div>
            )
          })}
        </div>

        <div className="carrito-resumen card">
          <h3 className="section-title">Resumen del pedido</h3>

          {!usuarioPuedeComprar && (
            <div className="alert alert-warning">
              {mensajeNoCompra}
            </div>
          )}

          <div className="resumen-despacho">
            <p className="resumen-label">Tipo de despacho</p>
            <div className="resumen-despacho-opciones">
              <label className={`resumen-radio ${tipoDespacho === 'domicilio' ? 'resumen-radio-activo' : ''}`}>
                <input
                  type="radio"
                  name="tipoDespacho"
                  value="domicilio"
                  checked={tipoDespacho === 'domicilio'}
                  onChange={(e) => setTipoDespacho(e.target.value)}
                />
                <div>
                  <strong>🚚 A domicilio</strong>
                  <small>Cotización Chilexpress al confirmar</small>
                </div>
              </label>
              <label className={`resumen-radio ${tipoDespacho === 'retiro' ? 'resumen-radio-activo' : ''}`}>
                <input
                  type="radio"
                  name="tipoDespacho"
                  value="retiro"
                  checked={tipoDespacho === 'retiro'}
                  onChange={(e) => setTipoDespacho(e.target.value)}
                />
                <div>
                  <strong>🏪 Retiro en sucursal</strong>
                  <small>Sin costo extra</small>
                </div>
              </label>
            </div>
          </div>

          <hr className="divider" />

          <div className="resumen-linea">
            <span>Subtotal ({items.length} producto{items.length > 1 ? 's' : ''})</span>
            <span>{formatPrecio(subtotal)}</span>
          </div>

          {esB2B && (
            <div className="resumen-linea resumen-descuento">
              <span>Descuento institucional (10%)</span>
              <span>− {formatPrecio(descuento)}</span>
            </div>
          )}

          <div className="resumen-linea">
            <span>Costo de despacho</span>
            <span>
              {tipoDespacho === 'retiro'
                ? 'Gratis'
                : <small className="text-muted">Se calcula al confirmar</small>}
            </span>
          </div>

          <hr className="divider" />

          <div className="resumen-total">
            <span>{tipoDespacho === 'domicilio' ? 'Subtotal a pagar' : 'Total a pagar'}</span>
            <span>{formatPrecio(total)}</span>
          </div>

          {tipoDespacho === 'domicilio' && (
            <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
              + costo de envío Chilexpress según comuna y peso (cotizado al confirmar)
            </p>
          )}

          <div className="resumen-iva-detalle">
            <div className="resumen-linea resumen-linea-mini">
              <span>Neto (sin IVA)</span>
              <span>{formatPrecio(neto)}</span>
            </div>
            <div className="resumen-linea resumen-linea-mini">
              <span>IVA (19%) incluido</span>
              <span>{formatPrecio(iva)}</span>
            </div>
            <p className="text-muted resumen-iva-nota">
              Los precios mostrados ya incluyen IVA. El despacho no agrega IVA adicional.
            </p>
          </div>

          {esB2B && (
            <p className="text-muted mt-1" style={{ fontSize: '0.8rem' }}>
              Precio B2B institucional con descuento aplicado al facturar.
            </p>
          )}

          <Button
            variant="primary"
            size="lg"
            block
            onClick={() => navigate('/confirmar-pedido')}
            className="mt-2"
            disabled={!usuarioPuedeComprar}
          >
            Confirmar pedido →
          </Button>
        </div>
      </div>
    </div>
  )
}
