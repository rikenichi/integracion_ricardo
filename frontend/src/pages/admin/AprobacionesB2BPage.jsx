import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  aprobarRevisionB2B,
  observarRevisionB2B,
  obtenerAprobacionesB2B,
  rechazarRevisionB2B,
} from '../../services/api'
import './AprobacionesB2BPage.css'

const ROLES_PERMITIDOS = ['admin', 'ejecutivo', 'analista']

const ESTADOS = {
  pendiente: { label: 'Pendiente', clase: 'badge-warning' },
  aprobado: { label: 'Aprobado', clase: 'badge-success' },
  rechazado: { label: 'Rechazado', clase: 'badge-danger' },
  observado: { label: 'Observado', clase: 'badge-info' },
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

function formatPrecio(valor) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
  }).format(valor || 0)
}

function obtenerLista(data) {
  return data?.results || data || []
}

function getEstado(estado) {
  return ESTADOS[estado] || { label: estado || 'Sin estado', clase: 'badge-secondary' }
}

function extraerMensajeErrorBackend(data) {
  if (!data) return ''
  if (typeof data === 'string') return data

  const clavesPrioritarias = ['detail', 'error', 'message', 'stock', 'errores']
  for (const clave of clavesPrioritarias) {
    const valor = data[clave]
    if (typeof valor === 'string' && valor.trim()) return valor
    if (Array.isArray(valor)) {
      const mensaje = valor.find((item) => typeof item === 'string' && item.trim())
      if (mensaje) return mensaje
    }
    if (valor && typeof valor === 'object') {
      const mensaje = extraerMensajeErrorBackend(valor)
      if (mensaje) return mensaje
    }
  }

  for (const valor of Object.values(data)) {
    const mensaje = extraerMensajeErrorBackend(valor)
    if (mensaje) return mensaje
  }

  return ''
}

export default function AprobacionesB2BPage() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [aprobaciones, setAprobaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [accionandoId, setAccionandoId] = useState(null)

  const autorizado = ROLES_PERMITIDOS.includes(usuario?.rol)

  const cargarDatos = async ({ limpiarMensajes = true } = {}) => {
    setLoading(true)
    if (limpiarMensajes) {
      setError('')
      setExito('')
    }
    try {
      const { data } = await obtenerAprobacionesB2B()
      setAprobaciones(obtenerLista(data))
    } catch (e) {
      setError(e.response?.data?.detail || 'No se pudieron cargar las aprobaciones B2B.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (autorizado) cargarDatos()
  }, [autorizado])

  const ejecutarAccion = async (id, accion) => {
    setAccionandoId(id)
    setError('')
    setExito('')
    try {
      const respuesta = await accion(id)
      if (respuesta?.demo) {
        setAprobaciones((items) =>
          items.map((item) => Number(item.id) === Number(id)
            ? { ...item, ...respuesta.data, comentario: 'Observacion demo local; no persistida en backend.' }
            : item
          )
        )
        setExito('Observacion demo registrada localmente.')
      } else {
        setExito('Acción completada correctamente.')
        await cargarDatos({ limpiarMensajes: false })
      }
    } catch (e) {
      const mensajeBackend = extraerMensajeErrorBackend(e.response?.data)
      setError(mensajeBackend || 'No fue posible completar la acción porque el pedido no cumple una regla de negocio.')
      if (e.response?.status === 409) {
        await cargarDatos({ limpiarMensajes: false })
      }
    } finally {
      setAccionandoId(null)
    }
  }

  if (!autorizado) {
    return (
      <div className="page-container aprobaciones-page">
        <div className="aprobaciones-toolbar">
          <button className="btn btn-secondary" onClick={() => navigate('/panel')}>
            Ir al panel
          </button>
        </div>
        <div className="card aprobaciones-acceso">
          <h1>Acceso no autorizado</h1>
          <p className="text-muted">
            Esta vista está disponible solo para roles comerciales y financieros autorizados.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container aprobaciones-page">
      <div className="aprobaciones-header">
        <div>
          <p className="aprobaciones-kicker">Revisión comercial</p>
          <h1 className="page-title">Aprobaciones B2B <span className="demo-chip">Backend real</span></h1>
          <p className="text-muted">
            Bandeja construida desde pedidos reales; aprobar y rechazar usan el endpoint de aprobacion del backend.
          </p>
        </div>
        <div className="aprobaciones-toolbar">
          <button className="btn btn-secondary" onClick={() => navigate('/panel')}>
            Ir al panel
          </button>
          <button className="btn btn-primary" onClick={cargarDatos} disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="aprobaciones-feedback aprobaciones-feedback-error" role="alert">
          <div>
            <strong>No fue posible aprobar el pedido</strong>
            <p>{error}</p>
          </div>
          <button type="button" onClick={() => setError('')} aria-label="Cerrar alerta de error">
            Cerrar
          </button>
        </div>
      )}
      {exito && (
        <div className="aprobaciones-feedback aprobaciones-feedback-success" role="status">
          <div>
            <strong>Acción completada</strong>
            <p>{exito}</p>
          </div>
          <button type="button" onClick={() => setExito('')} aria-label="Cerrar alerta de éxito">
            Cerrar
          </button>
        </div>
      )}

      {loading ? (
        <div className="spinner" />
      ) : (
        <section className="tabla-container card">
          <div className="aprobaciones-section-header">
            <h2>Revisiones registradas</h2>
            <span>{aprobaciones.length} aprobaciones</span>
          </div>
          {aprobaciones.length === 0 ? (
            <p className="text-muted aprobaciones-empty">No hay aprobaciones B2B registradas.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Pedido</th>
                  <th>Cliente / institución</th>
                  <th>Tipo</th>
                  <th>Total</th>
                  <th>Ejecutivo</th>
                  <th>Revisión</th>
                  <th>Estado</th>
                  <th>Comentario</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {aprobaciones.map(aprobacion => {
                  const estado = getEstado(aprobacion.estado_aprobacion)
                  const pendiente = aprobacion.estado_aprobacion === 'pendiente'
                  const bloqueado = accionandoId === aprobacion.id
                  return (
                    <tr key={aprobacion.id}>
                      <td>#{aprobacion.id}</td>
                      <td>#{aprobacion.pedido}</td>
                      <td>
                        <strong>{aprobacion.cliente_institucion || aprobacion.cliente_username || '-'}</strong>
                        {aprobacion.cliente_institucion && aprobacion.cliente_username && (
                          <>
                            <br />
                            <span className="text-muted">{aprobacion.cliente_username}</span>
                          </>
                        )}
                      </td>
                      <td>{aprobacion.pedido_tipo_cliente?.toUpperCase() || '-'}</td>
                      <td>{formatPrecio(aprobacion.pedido_total)}</td>
                      <td>{aprobacion.ejecutivo_username || '-'}</td>
                      <td>{formatFecha(aprobacion.fecha_revision)}</td>
                      <td><span className={`badge ${estado.clase}`}>{estado.label}</span></td>
                      <td>{aprobacion.comentario || '-'}</td>
                      <td>
                        <div className="aprobaciones-acciones">
                          {pendiente ? (
                            <>
                              <button
                                className="btn btn-success btn-sm"
                                disabled={bloqueado}
                                onClick={() => ejecutarAccion(aprobacion.id, aprobarRevisionB2B)}
                              >
                                Aprobar
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                disabled={bloqueado}
                                onClick={() => ejecutarAccion(aprobacion.id, rechazarRevisionB2B)}
                              >
                                Rechazar
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                disabled={bloqueado}
                                onClick={() => ejecutarAccion(aprobacion.id, observarRevisionB2B)}
                              >
                                Observar demo
                              </button>
                            </>
                          ) : (
                            <span className="text-muted">Sin acciones pendientes</span>
                          )}
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
