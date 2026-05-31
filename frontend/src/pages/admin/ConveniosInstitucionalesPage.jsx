import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { obtenerConveniosInstitucionales } from '../../services/api'
import './ConveniosInstitucionalesPage.css'

const ROLES_PERMITIDOS = ['admin', 'ejecutivo', 'analista']

const ESTADOS_CONVENIO = {
  activo: { label: 'Activo', clase: 'badge-success' },
  vencido: { label: 'Vencido', clase: 'badge-danger' },
  suspendido: { label: 'Suspendido', clase: 'badge-warning' },
  borrador: { label: 'Borrador', clase: 'badge-secondary' },
}

function formatFecha(fecha) {
  if (!fecha) return '-'
  return new Date(fecha).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatPorcentaje(valor) {
  return `${Number(valor || 0).toLocaleString('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`
}

function obtenerLista(data) {
  return data?.results || data || []
}

function getEstadoConvenio(estado) {
  return ESTADOS_CONVENIO[estado] || { label: estado || 'Sin estado', clase: 'badge-secondary' }
}

export default function ConveniosInstitucionalesPage() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [convenios, setConvenios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const autorizado = ROLES_PERMITIDOS.includes(usuario?.rol)

  const cargarDatos = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await obtenerConveniosInstitucionales()
      setConvenios(obtenerLista(data))
    } catch (e) {
      setError(e.response?.data?.detail || 'No se pudieron cargar los convenios institucionales.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (autorizado) cargarDatos()
  }, [autorizado])

  if (!autorizado) {
    return (
      <div className="page-container convenios-page">
        <div className="convenios-toolbar">
          <button className="btn btn-secondary" onClick={() => navigate('/panel')}>
            Ir al panel
          </button>
        </div>
        <div className="card convenios-acceso">
          <h1>Acceso no autorizado</h1>
          <p className="text-muted">
            Esta vista está disponible solo para roles comerciales y financieros autorizados.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container convenios-page">
      <div className="convenios-header">
        <div>
          <p className="convenios-kicker">Gestión B2B</p>
          <h1 className="page-title">Convenios institucionales <span className="demo-chip">Demo</span></h1>
          <p className="text-muted">
            Vista demo de condiciones comerciales asociadas a instituciones; pendiente de endpoint backend.
          </p>
        </div>
        <div className="convenios-toolbar">
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
          <div className="convenios-section-header">
            <h2>Convenios registrados</h2>
            <span>{convenios.length} registrados</span>
          </div>
          {convenios.length === 0 ? (
            <p className="text-muted convenios-empty">No hay convenios institucionales registrados.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Institución</th>
                  <th>Convenio</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Descuento</th>
                  <th>Condiciones de pago</th>
                  <th>Estado</th>
                  <th>Observación</th>
                </tr>
              </thead>
              <tbody>
                {convenios.map(convenio => {
                  const estado = getEstadoConvenio(convenio.estado)
                  return (
                    <tr key={convenio.id}>
                      <td>
                        <strong>{convenio.institucion_nombre || '-'}</strong>
                        {convenio.institucion_rut && (
                          <>
                            <br />
                            <span className="text-muted">{convenio.institucion_rut}</span>
                          </>
                        )}
                      </td>
                      <td>{convenio.nombre_convenio}</td>
                      <td>{formatFecha(convenio.fecha_inicio)}</td>
                      <td>{formatFecha(convenio.fecha_fin)}</td>
                      <td>{formatPorcentaje(convenio.porcentaje_descuento)}</td>
                      <td>{convenio.condiciones_pago || '-'}</td>
                      <td><span className={`badge ${estado.clase}`}>{estado.label}</span></td>
                      <td>{convenio.observacion || '-'}</td>
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
