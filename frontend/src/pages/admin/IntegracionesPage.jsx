import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  obtenerAuditoriaEventos,
  obtenerIntegracionesExternas,
  obtenerRegistrosIntegracion,
} from '../../services/api'
import './IntegracionesPage.css'

const ROLES_INTERNOS = ['admin', 'operador', 'analista']

const ESTADOS_REGISTRO = {
  exitoso: { label: 'Exitoso', clase: 'badge-success' },
  error: { label: 'Error', clase: 'badge-danger' },
  pendiente: { label: 'Pendiente', clase: 'badge-warning' },
}

const NIVELES_AUDITORIA = {
  info: { label: 'Info', clase: 'badge-info' },
  advertencia: { label: 'Advertencia', clase: 'badge-warning' },
  error: { label: 'Error', clase: 'badge-danger' },
}

function formatFecha(fecha) {
  if (!fecha) return '-'
  return new Date(fecha).toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function obtenerLista(data) {
  return data?.results || data || []
}

function getEstadoRegistro(estado) {
  return ESTADOS_REGISTRO[estado] || { label: estado || 'Sin estado', clase: 'badge-secondary' }
}

function getNivelAuditoria(nivel) {
  return NIVELES_AUDITORIA[nivel] || { label: nivel || 'Sin nivel', clase: 'badge-secondary' }
}

export default function IntegracionesPage() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [integraciones, setIntegraciones] = useState([])
  const [registros, setRegistros] = useState([])
  const [auditoria, setAuditoria] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const autorizado = ROLES_INTERNOS.includes(usuario?.rol)

  const cargarDatos = async () => {
    setLoading(true)
    setError('')
    try {
      const [integracionesR, registrosR, auditoriaR] = await Promise.all([
        obtenerIntegracionesExternas(),
        obtenerRegistrosIntegracion(),
        obtenerAuditoriaEventos(),
      ])
      setIntegraciones(obtenerLista(integracionesR.data))
      setRegistros(obtenerLista(registrosR.data))
      setAuditoria(obtenerLista(auditoriaR.data))
    } catch (e) {
      setError(e.response?.data?.detail || 'No se pudieron cargar las integraciones y auditorías.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (autorizado) cargarDatos()
  }, [autorizado])

  if (!autorizado) {
    return (
      <div className="page-container integraciones-page">
        <div className="integraciones-toolbar">
          <button className="btn btn-secondary" onClick={() => navigate('/panel')}>
            Ir al panel
          </button>
        </div>
        <div className="card integraciones-acceso">
          <h1>Acceso no autorizado</h1>
          <p className="text-muted">
            Esta vista está disponible solo para roles internos de MEDISTOCK.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container integraciones-page">
      <div className="integraciones-header">
        <div>
          <p className="integraciones-kicker">Supervisión interna</p>
          <h1 className="page-title">Integraciones y auditoría <span className="demo-chip">Demo</span></h1>
          <p className="text-muted">
            Vista demo de servicios externos, registros técnicos resumidos y auditoría futura.
          </p>
        </div>
        <div className="integraciones-toolbar">
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
        <div className="integraciones-grid">
          <section className="tabla-container card">
            <div className="integraciones-section-header">
              <h2>Integraciones externas</h2>
              <span>{integraciones.length} registradas</span>
            </div>
            {integraciones.length === 0 ? (
              <p className="text-muted integraciones-empty">No hay integraciones externas registradas.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>Descripción</th>
                    <th>Endpoint base</th>
                    <th>Estado</th>
                    <th>Creada</th>
                  </tr>
                </thead>
                <tbody>
                  {integraciones.map(integracion => (
                    <tr key={integracion.id}>
                      <td><strong>{integracion.nombre}</strong></td>
                      <td>{integracion.tipo}</td>
                      <td>{integracion.descripcion || '-'}</td>
                      <td className="mono-value">{integracion.endpoint_base || '-'}</td>
                      <td>
                        <span className={`badge ${integracion.activo ? 'badge-success' : 'badge-secondary'}`}>
                          {integracion.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>{formatFecha(integracion.creado_en)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="tabla-container card">
            <div className="integraciones-section-header">
              <h2>Registros de integración</h2>
              <span>{registros.length} registros</span>
            </div>
            {registros.length === 0 ? (
              <p className="text-muted integraciones-empty">No hay registros de integración.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Integración</th>
                    <th>Usuario</th>
                    <th>Entidad</th>
                    <th>Método</th>
                    <th>Endpoint</th>
                    <th>Estado</th>
                    <th>Código</th>
                    <th>Mensaje</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map(registro => {
                    const estado = getEstadoRegistro(registro.estado)
                    return (
                      <tr key={registro.id}>
                        <td>{registro.integracion_nombre || '-'}</td>
                        <td>{registro.usuario_username || '-'}</td>
                        <td>
                          {registro.entidad_relacionada_tipo || '-'}
                          {registro.entidad_relacionada_id ? ` #${registro.entidad_relacionada_id}` : ''}
                        </td>
                        <td>{registro.metodo || '-'}</td>
                        <td className="mono-value">{registro.endpoint || '-'}</td>
                        <td><span className={`badge ${estado.clase}`}>{estado.label}</span></td>
                        <td>{registro.codigo_respuesta ?? '-'}</td>
                        <td>{registro.mensaje || '-'}</td>
                        <td>{formatFecha(registro.creado_en)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section className="tabla-container card">
            <div className="integraciones-section-header">
              <h2>Auditoría de eventos</h2>
              <span>{auditoria.length} eventos</span>
            </div>
            {auditoria.length === 0 ? (
              <p className="text-muted integraciones-empty">No hay eventos de auditoría registrados.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Módulo</th>
                    <th>Acción</th>
                    <th>Descripción</th>
                    <th>Entidad</th>
                    <th>Nivel</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {auditoria.map(evento => {
                    const nivel = getNivelAuditoria(evento.nivel)
                    return (
                      <tr key={evento.id}>
                        <td>{evento.usuario_username || '-'}</td>
                        <td>{evento.modulo || '-'}</td>
                        <td>{evento.accion || '-'}</td>
                        <td>{evento.descripcion || '-'}</td>
                        <td>
                          {evento.entidad_tipo || '-'}
                          {evento.entidad_id ? ` #${evento.entidad_id}` : ''}
                        </td>
                        <td><span className={`badge ${nivel.clase}`}>{nivel.label}</span></td>
                        <td>{formatFecha(evento.creado_en)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
