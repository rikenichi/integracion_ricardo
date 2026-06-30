import { Link } from 'react-router-dom'
import { resolverImagenProducto } from '../../utils/imagenProducto'

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ position: 'relative' }}>
            <span className="badge badge-danger" style={{ position: 'absolute', top: 12, left: 12, zIndex: 1, fontSize: '0.8rem', padding: '4px 10px' }}>
              −17%
            </span>
            <div style={{ background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180 }}>
              <img
                src={resolverImagenProducto({ nombre: 'Guantes clínicos' })}
                alt="Guantes clínicos"
                style={{ maxHeight: 160, maxWidth: '100%', objectFit: 'contain' }}
                onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex' }}
              />
              <span style={{ display: 'none', fontSize: '4rem', alignItems: 'center', justifyContent: 'center', height: '100%' }}>🧤</span>
            </div>
          </div>
          <div style={{ padding: '16px 20px' }}>
            <p className="text-muted" style={{ fontSize: '0.78rem', margin: '0 0 4px' }}>Insumos clínicos</p>
            <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>Guantes clínicos</h3>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
              <span style={{ textDecoration: 'line-through', color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
                {formatPrecio(5990)}
              </span>
              <strong style={{ fontSize: '1.25rem', color: 'var(--color-primary)' }}>
                {formatPrecio(4990)}
              </strong>
            </div>
            <Link to="/catalogo?search=guantes" className="btn btn-primary" style={{ width: '100%', textAlign: 'center', display: 'block' }}>
              Ver en catálogo
            </Link>
          </div>
        </div>
      </div>

      <p className="text-muted" style={{ marginTop: 32, fontSize: '0.78rem' }}>
        * Precio promocional referencial. El precio final se aplica en el catálogo al momento de la compra.
      </p>
    </div>
  )
}
