import { Link } from 'react-router-dom'
import { resolverImagenProducto } from '../../utils/imagenProducto'
import './OfertasPage.css'

function formatPrecio(n) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n)
}

export default function OfertasPage() {
  return (
    <div className="page-container">
      <h1 className="page-title">Promociones destacadas</h1>
      <p className="text-muted" style={{ marginBottom: 24 }}>
        Ofertas referenciales seleccionadas por el equipo Medistock. Los precios del catálogo pueden variar.
      </p>

      <div className="ofertas-grid">
        <div className="oferta-card">
          <div className="oferta-imagen-wrap">
            <span className="oferta-descuento-badge">−17%</span>
            <img
              src={resolverImagenProducto({ nombre: 'Guantes clínicos' })}
              alt="Guantes clínicos"
              style={{ maxHeight: 160, maxWidth: '100%', objectFit: 'contain' }}
              onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex' }}
            />
            <span style={{ display: 'none', fontSize: '4rem', alignItems: 'center', justifyContent: 'center', height: '100%' }}>🧤</span>
          </div>
          <div className="oferta-body">
            <p className="oferta-categoria">Insumos clínicos</p>
            <h3 className="oferta-nombre">Guantes clínicos</h3>
            <div className="oferta-precios">
              <span className="oferta-precio-anterior">{formatPrecio(5990)}</span>
              <strong className="oferta-precio-actual">{formatPrecio(4990)}</strong>
            </div>
            <Link to="/catalogo?search=guantes" className="oferta-cta">
              Ver en catálogo
            </Link>
          </div>
        </div>
      </div>

      <p className="oferta-nota">
        * Promoción referencial. El precio final de compra corresponde al valor vigente mostrado en el catálogo.
      </p>
    </div>
  )
}
