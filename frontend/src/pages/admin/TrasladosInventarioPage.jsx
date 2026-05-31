import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { obtenerTrasladosInventario } from '../../services/api'
import './TrasladosInventarioPage.css'

const ROLES_INTERNOS = ['admin', 'operador', 'analista']

const ESTADOS = {
  borrador: { label: 'Borrador', clase: 'badge-secondary' },
  solicitado: { label: 'Solicitado', clase: 'badge-info' },
  aprobado: { label: 'Aprobado', clase: 'badge-info' },
  en_transito: { label: 'En transito', clase: 'badge-warning' },
  recibido: { label: 'Recibido', clase: 'badge-success' },
  cancelado: { label: 'Cancelado', clase: 'badge-danger' },
}

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

function getEstado(estado) {
  const normalizado = String(estado || '').toLowerCase()
  return ESTADOS[normalizado] || { label: estado || 'Sin estado', clase: 'badge-secondary' }
}

function mensajeError(e) {
  if (!e.response) return 'No fue posible conectar con el backend.'
  if (e.response.status === 403) return 'No tienes permisos para consultar esta información.'
  if (e.response.status === 404) return 'No se encontró información asociada.'
  if (e.response.status === 500) return 'Error del servidor. Intenta nuevamente.'
  return e.response?.data?.detail || e.response?.data?.error || 'No se pudieron cargar los traslados de inventario.'
}

export default function TrasladosInventarioPage() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [traslados, setTraslados] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const autorizado = ROLES_INTERNOS.includes(usuario?.rol)

  const cargarDatos = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await obtenerTrasladosInventario()
      setTraslados(obtenerLista(data))
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (autorizado) cargarDatos()
  }, [autorizado])

  if (!autorizado) {
    return (
      <div className="page-container traslados-page">
        <div className="traslados-toolbar">
          <button className="btn btn-secondary" onClick={() => navigate('/panel')}>
            Ir al panel
          </button>
        </div>
        <div className="card traslados-acceso">
          <h1>Acceso no autorizado</h1>
          <p className="text-muted">
            Esta vista esta disponible solo para roles internos de MEDISTOCK.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container traslados-page">
      <div className="traslados-header">
        <div>
          <p className="traslados-kicker">Inventario interno</p>
          <h1 className="page-title">Traslados de inventario</h1>
          <p className="text-muted">
            Consulta real de transferencias entre sucursales. Las transiciones de estado quedan pendientes de endpoint backend.
          </p>
        </div>
        <div className="traslados-toolbar">
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
        <section className="tabla-container card">
          <div className="traslados-section-header">
            <h2>Transferencias registradas</h2>
            <span>{traslados.length} traslados</span>
          </div>
          {traslados.length === 0 ? (
            <p className="text-muted traslados-empty">No hay traslados de inventario registrados.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Origen</th>
                  <th>Destino</th>
                  <th>Usuario</th>
                  <th>Solicitud</th>
                  <th>Envio</th>
                  <th>Recepcion</th>
                  <th>Estado</th>
                  <th>Observacion</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {traslados.map(traslado => {
                  const estado = getEstado(traslado.estado)

                  return (
                    <tr key={traslado.id}>
                      <td>#{traslado.id}</td>
                      <td>{traslado.sucursal_origen_nombre || '-'}</td>
                      <td>{traslado.sucursal_destino_nombre || '-'}</td>
                      <td>{traslado.usuario_username || traslado.solicitado_por || '-'}</td>
                      <td>{formatFecha(traslado.fecha_solicitud)}</td>
                      <td>{formatFecha(traslado.fecha_envio)}</td>
                      <td>{formatFecha(traslado.fecha_recepcion)}</td>
                      <td>
                        <span className={`badge ${estado.clase}`}>{estado.label}</span>
                      </td>
                      <td>{traslado.observacion || '-'}</td>
                      <td>
                        <div className="traslados-acciones">
                          <span className="text-muted">Sin acción real disponible</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  )
}
