import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { obtenerOrdenesCompra, obtenerProveedores } from '../../services/api'
import './ComprasProveedorPage.css'

const ROLES_INTERNOS = ['admin', 'operador', 'analista']

function formatFecha(fecha) {
  if (!fecha) return '-'
  return new Date(fecha).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function obtenerLista(data) {
  return data?.results || data || []
}

export default function ComprasProveedorPage() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [proveedores, setProveedores] = useState([])
  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const autorizado = ROLES_INTERNOS.includes(usuario?.rol)

  const cargarDatos = async () => {
    setLoading(true)
    setError('')
    try {
      const [proveedoresR, ordenesR] = await Promise.all([
        obtenerProveedores(),
        obtenerOrdenesCompra(),
      ])
      setProveedores(obtenerLista(proveedoresR.data))
      setOrdenes(obtenerLista(ordenesR.data))
    } catch (e) {
      setError(e.response?.data?.detail || 'No se pudieron cargar las compras internas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (autorizado) cargarDatos()
  }, [autorizado])

  if (!autorizado) {
    return (
      <div className="page-container compras-page">
        <div className="compras-toolbar">
          <button className="btn btn-secondary" onClick={() => navigate('/panel')}>
            Ir al panel
          </button>
        </div>
        <div className="card compras-acceso">
          <h1>Acceso no autorizado</h1>
          <p className="text-muted">
            Esta vista está disponible solo para roles internos de MEDISTOCK.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container compras-page">
      <div className="compras-header">
        <div>
          <p className="compras-kicker">Gestión interna</p>
          <h1 className="page-title">Compras y proveedores <span className="demo-chip">Demo</span></h1>
          <p className="text-muted">
            Vista demo con proveedores y órdenes de compra de ejemplo hasta exponer procurement en API.
          </p>
        </div>
        <div className="compras-toolbar">
          <button className="btn btn-secondary" onClick={() => navigate('/panel')}>
            Ir al panel
          </button>
          <button className="btn btn-primary" onClick={cargarDatos} disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="spinner" />
      ) : (
        <div className="compras-grid">
          <section className="tabla-container card">
            <div className="compras-section-header">
              <h2>Proveedores</h2>
              <span>{proveedores.length} registrados</span>
            </div>
            {proveedores.length === 0 ? (
              <p className="text-muted compras-empty">No hay proveedores registrados.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>RUT</th>
                    <th>Contacto</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {proveedores.map(proveedor => (
                    <tr key={proveedor.id}>
                      <td><strong>{proveedor.nombre_empresa}</strong></td>
                      <td>{proveedor.rut}</td>
                      <td>{proveedor.contacto || '-'}</td>
                      <td>{proveedor.email || '-'}</td>
                      <td>{proveedor.telefono || '-'}</td>
                      <td>
                        <span className={`badge ${proveedor.activo ? 'badge-success' : 'badge-secondary'}`}>
                          {proveedor.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="tabla-container card">
            <div className="compras-section-header">
              <h2>Órdenes de compra</h2>
              <span>{ordenes.length} registradas</span>
            </div>
            {ordenes.length === 0 ? (
              <p className="text-muted compras-empty">No hay órdenes de compra registradas.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Proveedor</th>
                    <th>Sucursal</th>
                    <th>Usuario</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th>Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenes.map(orden => (
                    <tr key={orden.id}>
                      <td>#{orden.id}</td>
                      <td>{orden.proveedor_nombre || '-'}</td>
                      <td>{orden.sucursal_nombre || '-'}</td>
                      <td>{orden.usuario_username || '-'}</td>
                      <td>{formatFecha(orden.fecha_compra)}</td>
                      <td>
                        <span className="badge badge-info">
                          {orden.estado_display || orden.estado}
                        </span>
                      </td>
                      <td>{orden.observacion || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
