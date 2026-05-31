import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  desactivarTrabajador,
  listarTrabajadores,
  registrarTrabajador,
} from '../../services/api'
import './AdminTrabajadoresPage.css'

const ROLES_PERMITIDOS = ['admin']

const CARGOS_OPERATIVOS = [
  'Administrador',
  'Ventas',
  'Logística',
  'Inventario',
  'Finanzas',
  'Soporte',
]

const FORM_INICIAL = {
  email: '',
  first_name: '',
  last_name: '',
  password: '',
  password2: '',
  rut: '',
  telefono: '',
  direccion: '',
  comuna: '',
  sucursal: '',
  cargo: 'Administrador',
}

function obtenerLista(data) {
  return data?.results || data || []
}

function extraerMensajeError(data) {
  if (!data) return ''
  if (typeof data === 'string') return data
  if (Array.isArray(data)) return data.map(extraerMensajeError).filter(Boolean).join(' ')

  const partes = Object.entries(data).map(([campo, valor]) => {
    const mensaje = extraerMensajeError(valor)
    return mensaje ? `${campo}: ${mensaje}` : ''
  })

  return partes.filter(Boolean).join(' ')
}

function normalizarMensajeBackend(mensaje) {
  if (!mensaje) return ''
  if (/username/i.test(mensaje) && /(existe|registrado|unique|already)/i.test(mensaje)) {
    return 'Ya existe un trabajador con este correo de acceso.'
  }
  return mensaje.replace(/usuario:\s*username:/gi, 'Email:').replace(/username/gi, 'email')
}

function mensajeErrorApi(error, fallback) {
  if (!error.response) return 'No fue posible conectar con el backend.'
  if (error.response.status === 403) return 'No tienes permisos para crear trabajadores.'
  if (error.response.status === 404) return 'No se encontró información asociada.'
  if (error.response.status === 409) return normalizarMensajeBackend(extraerMensajeError(error.response.data)) || fallback
  if (error.response.status === 500) return 'Error del servidor. Intenta nuevamente.'
  return normalizarMensajeBackend(extraerMensajeError(error.response.data)) || fallback
}

function esEmail(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor || '').trim())
}

function numeroOpcional(valor) {
  if (valor === '' || valor === null || valor === undefined) return null
  const numero = Number(valor)
  return Number.isNaN(numero) ? null : numero
}

function nombreTrabajador(trabajador = {}) {
  const usuario = trabajador.usuario || {}
  const nombre = [usuario.first_name, usuario.last_name].filter(Boolean).join(' ').trim()
  return nombre || usuario.email || `Trabajador ${trabajador.id || ''}`
}

function gruposUsuario(usuario = {}) {
  const grupos = usuario.grupos || usuario.groups || []
  if (!Array.isArray(grupos)) return '-'
  const nombres = grupos
    .map((grupo) => grupo.name || grupo.nombre || grupo)
    .filter(Boolean)
  return nombres.length ? nombres.join(', ') : '-'
}

export default function AdminTrabajadoresPage() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [trabajadores, setTrabajadores] = useState([])
  const [form, setForm] = useState(FORM_INICIAL)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [desactivandoId, setDesactivandoId] = useState(null)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [erroresForm, setErroresForm] = useState({})

  const rol = String(usuario?.rol || '').toLowerCase()
  const autorizado = ROLES_PERMITIDOS.includes(rol)

  const trabajadoresOrdenados = useMemo(() => (
    [...trabajadores].sort((a, b) => nombreTrabajador(a).localeCompare(nombreTrabajador(b)))
  ), [trabajadores])

  const cargarTrabajadores = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await listarTrabajadores()
      setTrabajadores(obtenerLista(response.data))
    } catch (err) {
      setError(mensajeErrorApi(err, 'No se pudieron cargar los trabajadores.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (autorizado) cargarTrabajadores()
  }, [autorizado])

  const setCampo = (campo, valor) => {
    setForm((actual) => ({ ...actual, [campo]: valor }))

    if (erroresForm[campo]) {
      setErroresForm((actual) => ({ ...actual, [campo]: '' }))
    }
    if (error) setError('')
    if (exito) setExito('')
  }

  const validar = () => {
    const errores = {}

    if (!form.email.trim()) errores.email = 'El email es obligatorio.'
    if (form.email.trim() && !esEmail(form.email)) errores.email = 'Ingresa un email válido.'
    if (!form.first_name.trim()) errores.first_name = 'El nombre es obligatorio.'
    if (!form.last_name.trim()) errores.last_name = 'El apellido es obligatorio.'
    if (!form.rut.trim()) errores.rut = 'El RUT es obligatorio.'
    if (!form.password) errores.password = 'La contraseña es obligatoria.'
    if (form.password && form.password.length < 8) {
      errores.password = 'La contraseña debe tener al menos 8 caracteres.'
    }
    if (form.password !== form.password2) {
      errores.password2 = 'Las contraseñas no coinciden.'
    }
    if (!form.cargo.trim()) errores.cargo = 'Selecciona un cargo.'

    return errores
  }

  const construirPayload = () => {
    const emailNormalizado = form.email.trim().toLowerCase()
    return {
      usuario: {
        username: emailNormalizado,
        email: emailNormalizado,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        password: form.password,
        password2: form.password2,
      },
      rut: form.rut.trim(),
      telefono: form.telefono.trim(),
      direccion: form.direccion.trim(),
      comuna: numeroOpcional(form.comuna),
      sucursal: numeroOpcional(form.sucursal),
      cargo: form.cargo.trim(),
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setExito('')

    const errores = validar()
    setErroresForm(errores)
    if (Object.keys(errores).length > 0) return

    setGuardando(true)
    try {
      await registrarTrabajador(construirPayload())
      setExito('Trabajador creado correctamente. El backend lo agrega al grupo Trabajadores.')
      setForm(FORM_INICIAL)
      setMostrarForm(false)
      await cargarTrabajadores()
    } catch (err) {
      setError(mensajeErrorApi(err, 'No se pudo crear el trabajador. Revisa los campos obligatorios.'))
    } finally {
      setGuardando(false)
    }
  }

  const handleDesactivar = async (trabajador) => {
    if (!trabajador?.id || desactivandoId) return

    setError('')
    setExito('')
    setDesactivandoId(trabajador.id)
    try {
      await desactivarTrabajador(trabajador.id)
      setExito('Trabajador desactivado correctamente.')
      await cargarTrabajadores()
    } catch (err) {
      setError(mensajeErrorApi(err, 'No se pudo desactivar el trabajador.'))
    } finally {
      setDesactivandoId(null)
    }
  }

  if (!autorizado) {
    return (
      <div className="page-container admin-trabajadores-page">
        <div className="admin-trabajadores-toolbar">
          <button className="btn btn-secondary" onClick={() => navigate('/panel')}>
            Ir al panel
          </button>
        </div>
        <div className="card admin-trabajadores-acceso">
          <h1>Acceso no autorizado</h1>
          <p className="text-muted">
            Esta vista esta disponible solo para administradores.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container admin-trabajadores-page">
      <div className="admin-trabajadores-header">
        <div>
          <p className="admin-trabajadores-kicker">Usuarios internos</p>
          <h1 className="page-title">Gestión de trabajadores</h1>
          <p className="text-muted">
            Crea cuentas internas para usuarios administrativos, ventas, logística, inventario o finanzas.
          </p>
        </div>
        <div className="admin-trabajadores-toolbar">
          <button className="btn btn-secondary" onClick={() => navigate('/panel')}>
            Ir al panel
          </button>
          <button className="btn btn-primary" onClick={() => setMostrarForm((valor) => !valor)}>
            {mostrarForm ? 'Cerrar formulario' : 'Nuevo trabajador'}
          </button>
          <button className="btn btn-secondary" onClick={cargarTrabajadores} disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {exito && <div className="alert alert-success">{exito}</div>}

      {mostrarForm && (
        <section className="card admin-trabajadores-form-card">
          <div className="admin-trabajadores-section-header">
            <h2>Nuevo trabajador</h2>
            <span>POST /accounts/registro/trabajador/</span>
          </div>

          <div className="admin-trabajadores-note">
            El serializer real no recibe un campo rol. El valor seleccionado se guarda en cargo y el backend
            asigna automáticamente el grupo Django Trabajadores.
          </div>

          <form className="admin-trabajadores-form" onSubmit={handleSubmit}>
            <label>
              Nombre *
              <input
                value={form.first_name}
                onChange={(e) => setCampo('first_name', e.target.value)}
              />
              {erroresForm.first_name && <small>{erroresForm.first_name}</small>}
            </label>
            <label>
              Apellido *
              <input value={form.last_name} onChange={(e) => setCampo('last_name', e.target.value)} />
              {erroresForm.last_name && <small>{erroresForm.last_name}</small>}
            </label>
            <label>
              RUT *
              <input value={form.rut} onChange={(e) => setCampo('rut', e.target.value)} placeholder="12.345.678-9" />
              {erroresForm.rut && <small>{erroresForm.rut}</small>}
            </label>
            <label>
              Email *
              <input
                value={form.email}
                onChange={(e) => setCampo('email', e.target.value)}
                placeholder="trabajador@medistock.cl"
              />
              {erroresForm.email && <small>{erroresForm.email}</small>}
            </label>
            <label>
              Cargo *
              <select value={form.cargo} onChange={(e) => setCampo('cargo', e.target.value)}>
                {CARGOS_OPERATIVOS.map((cargo) => (
                  <option key={cargo} value={cargo}>{cargo}</option>
                ))}
              </select>
              {erroresForm.cargo && <small>{erroresForm.cargo}</small>}
            </label>
            <label>
              Teléfono
              <input value={form.telefono} onChange={(e) => setCampo('telefono', e.target.value)} />
            </label>
            <label>
              Dirección
              <input value={form.direccion} onChange={(e) => setCampo('direccion', e.target.value)} />
            </label>
            <label>
              Comuna ID
              <input type="number" min="1" value={form.comuna} onChange={(e) => setCampo('comuna', e.target.value)} />
              <small>Opcional. Se envia como ID si se informa.</small>
            </label>
            <label>
              Sucursal ID
              <input type="number" min="1" value={form.sucursal} onChange={(e) => setCampo('sucursal', e.target.value)} />
              <small>Opcional. Se envia como ID si se informa.</small>
            </label>
            <label>
              Contraseña *
              <input
                type="password"
                value={form.password}
                onChange={(e) => setCampo('password', e.target.value)}
                autoComplete="new-password"
              />
              {erroresForm.password && <small>{erroresForm.password}</small>}
            </label>
            <label>
              Confirmar contraseña *
              <input
                type="password"
                value={form.password2}
                onChange={(e) => setCampo('password2', e.target.value)}
                autoComplete="new-password"
              />
              {erroresForm.password2 && <small>{erroresForm.password2}</small>}
            </label>
            <div className="admin-trabajadores-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setForm(FORM_INICIAL)}>
                Limpiar
              </button>
              <button type="submit" className="btn btn-primary" disabled={guardando}>
                {guardando ? 'Guardando...' : 'Crear trabajador'}
              </button>
            </div>
          </form>
        </section>
      )}

      {loading ? (
        <div className="spinner" />
      ) : (
        <section className="tabla-container card">
          <div className="admin-trabajadores-section-header">
            <h2>Trabajadores existentes</h2>
            <span>{trabajadoresOrdenados.length} trabajadores</span>
          </div>
          {trabajadoresOrdenados.length === 0 ? (
            <p className="text-muted admin-trabajadores-empty">No hay trabajadores registrados.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>RUT</th>
                  <th>Cargo</th>
                  <th>Grupos</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {trabajadoresOrdenados.map((trabajador) => (
                  <tr key={trabajador.id}>
                    <td>
                      <strong>{nombreTrabajador(trabajador)}</strong>
                      {trabajador.telefono && (
                        <>
                          <br />
                          <span className="text-muted">{trabajador.telefono}</span>
                        </>
                      )}
                    </td>
                    <td>
                      <span className="mono-value">{trabajador.usuario?.email || '-'}</span>
                    </td>
                    <td>{trabajador.rut || '-'}</td>
                    <td>{trabajador.cargo || '-'}</td>
                    <td>{gruposUsuario(trabajador.usuario)}</td>
                    <td>
                      <span className={`badge ${trabajador.activo ? 'badge-success' : 'badge-secondary'}`}>
                        {trabajador.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      {trabajador.activo ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={desactivandoId === trabajador.id}
                          onClick={() => handleDesactivar(trabajador)}
                        >
                          {desactivandoId === trabajador.id ? 'Desactivando...' : 'Desactivar'}
                        </button>
                      ) : (
                        <span className="text-muted">Sin acciones</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  )
}
