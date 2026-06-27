import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCombobox } from 'downshift'
import { useAuth } from '../../context/AuthContext'
import { getPerfil, obtenerComunasDespacho, obtenerRegionesDespacho } from '../../services/api'
import './PerfilPage.css'

const ROLES_CLIENTE = ['cliente_b2c', 'cliente_b2b']

const ETIQUETAS_ROL = {
  admin: 'Administrador',
  cliente_b2b: 'Cliente B2B',
  cliente_b2c: 'Paciente',
  ejecutivo: 'Ejecutivo',
  operador: 'Operador',
  analista: 'Analista',
  CLIENTE: 'Cliente',
  TRABAJADOR: 'Trabajador',
}

function camposIniciales(datos, rol) {
  // Soporta tres formatos:
  //   - Cliente actual: { id, rut, telefono, email, first_name, last_name, institucion, direccion_principal, ... }
  //   - Cliente legacy: { usuario: {...}, rut, telefono, tipo_cliente, institucion_nombre }
  //   - Trabajador:     { id, usuario: { username, email, first_name, last_name, rut }, rut, telefono, direccion, cargo, ... }
  const esCliente = ROLES_CLIENTE.includes(rol) || rol === 'CLIENTE'
  // El subobjeto "usuario" tiene first_name/last_name/email/rut. Para trabajador siempre viene anidado.
  // Para cliente puede venir anidado o plano.
  const usuario = datos?.usuario || (esCliente ? datos : {}) || {}
  const dir = datos?.direccion_principal
  const direccionPrincipal = dir
    ? [dir.direccion, dir.num_direccion, dir.detalle_direccion, dir.comuna]
      .filter(Boolean)
      .join(' ')
    : ''
  return {
    first_name: usuario.first_name || datos?.first_name || '',
    last_name: usuario.last_name || datos?.last_name || '',
    email: usuario.email || datos?.email || '',
    rut: datos?.rut || usuario.rut || '',
    telefono: datos?.telefono || usuario.telefono || '',
    direccion: datos?.direccion || dir?.direccion || direccionPrincipal || '',
    num_direccion: dir?.num_direccion || '',
    detalle_direccion: dir?.detalle_direccion || '',
    regionId: dir?.region?.id || dir?.region_id || '',
    comunaId: dir?.comuna_detalle?.id || dir?.comuna || dir?.comuna_id || '',
  }
}

const inputEditClass = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200'
const textareaEditClass = `${inputEditClass} resize-none`

function EditableInput({
  value,
  onChange,
  disabled,
  placeholder,
  type = 'text',
  autoComplete,
  error,
}) {
  return (
    <>
      <input
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={inputEditClass}
      />
      {error && <small className="campo-error">{error}</small>}
    </>
  )
}

function EditableTextarea({
  value,
  onChange,
  disabled,
  placeholder,
  autoComplete,
  error,
  rows = 2,
}) {
  return (
    <>
      <textarea
        rows={rows}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={textareaEditClass}
      />
      {error && <small className="campo-error">{error}</small>}
    </>
  )
}

function UbicacionCombobox({
  label,
  placeholder,
  items,
  selectedId,
  onSelect,
  disabled = false,
  loading = false,
  emptyText = 'Sin resultados',
}) {
  const selectedItem = items.find(item => String(item.id) === String(selectedId)) || null
  const [inputItems, setInputItems] = useState(items)

  useEffect(() => {
    setInputItems(items)
  }, [items])

  const normalizarTexto = (valor) => String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  const {
    isOpen,
    getLabelProps,
    getMenuProps,
    getInputProps,
    getItemProps,
    getToggleButtonProps,
    highlightedIndex,
    selectedItem: downshiftSelectedItem,
  } = useCombobox({
    items: inputItems,
    selectedItem,
    itemToString: item => (item ? item.nombre : ''),
    onInputValueChange: ({ inputValue }) => {
      const texto = normalizarTexto(inputValue || '')
      const filtrados = items.filter(item =>
        normalizarTexto(item.nombre).includes(texto)
      )
      setInputItems(filtrados)
    },
    onSelectedItemChange: ({ selectedItem: nuevoItem }) => {
      onSelect(nuevoItem || null)
    },
  })

  return (
    <div className="ubicacion-combobox">
      <label {...getLabelProps()}>{label}</label>

      <div className="ubicacion-combobox__control">
        <input
          {...limpiarAriaVacios(getInputProps({ placeholder, disabled: disabled || loading }))}
        />

        <button
          type="button"
          className="ubicacion-combobox__toggle"
          disabled={disabled || loading}
          {...limpiarAriaVacios(getToggleButtonProps())}
          aria-label="Abrir opciones"
        >
          ▾
        </button>
      </div>

      <ul
        {...getMenuProps()}
        className={`ubicacion-combobox__menu ${isOpen ? 'ubicacion-combobox__menu--open' : ''}`}
      >
        {isOpen && (
          <>
            {loading && (
              <li className="ubicacion-combobox__option ubicacion-combobox__option--empty">
                Cargando...
              </li>
            )}

            {!loading && inputItems.length === 0 && (
              <li className="ubicacion-combobox__option ubicacion-combobox__option--empty">
                {emptyText}
              </li>
            )}

            {!loading && inputItems.map((item, index) => (
              <li
                key={item.id}
                className={`ubicacion-combobox__option ${
                  highlightedIndex === index ? 'ubicacion-combobox__option--highlighted' : ''
                } ${
                  downshiftSelectedItem?.id === item.id ? 'ubicacion-combobox__option--selected' : ''
                }`}
                {...getItemProps({ item, index })}
              >
                {item.nombre}
              </li>
            ))}
          </>
        )}
      </ul>
    </div>
  )
}

// downshift emite aria-activedescendant='' cuando no hay ítem resaltado.
// El browser llama getElementById('') para resolver el atributo ARIA y emite un warning.
// Esta función elimina cualquier atributo aria-* con valor vacío (string vacío, null o undefined).
function limpiarAriaVacios(props) {
  const resultado = { ...props }
  for (const clave of Object.keys(resultado)) {
    if (clave.startsWith('aria-')) {
      const valor = resultado[clave]
      if (valor === '' || valor === null || valor === undefined) {
        delete resultado[clave]
      }
    }
  }
  return resultado
}

function obtenerListaRespuesta(data) {
  return data?.results || data || []
}

function normalizarUbicacion(item) {
  if (item === null || item === undefined) return null
  if (typeof item === 'string' || typeof item === 'number') {
    return { id: String(item), nombre: String(item) }
  }
  return {
    id: item.id ?? item.codigo ?? item.value ?? item.pk ?? item.region_id ?? item.comuna_id ?? item.nombre ?? item.name,
    nombre: item.nombre || item.name || item.descripcion || item.label || item.region || item.comuna || String(item.id),
  }
}

function normalizarId(valor) {
  const texto = String(valor ?? '').trim()
  if (!texto) return null
  return /^\d+$/.test(texto) ? Number(texto) : texto
}

function mensajeErrorApi(err, fallback) {
  if (!err.response) return 'No fue posible conectar con el backend.'
  if (err.response.status === 403) return 'No tienes permisos para consultar esta información.'
  if (err.response.status === 404) return 'No se encontró información asociada.'
  if (err.response.status === 500) return 'Error del servidor. Intenta nuevamente.'
  const data = err.response?.data
  if (data?.detail) return data.detail
  if (data?.error) return data.error
  return fallback
}

export default function PerfilPage() {
  const { usuario, actualizarPerfilUsuario } = useAuth()
  const [perfil, setPerfil] = useState(null)
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    rut: '',
    telefono: '',
    direccion: '',
    num_direccion: '',
    detalle_direccion: '',
    regionId: '',
    comunaId: '',
  })
  const [original, setOriginal] = useState(form)

  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState('')
  const [okMsg, setOkMsg] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [editando, setEditando] = useState(false)
  const [regiones, setRegiones] = useState([])
  const [comunas, setComunas] = useState([])
  const [cargandoRegiones, setCargandoRegiones] = useState(false)
  const [cargandoComunas, setCargandoComunas] = useState(false)

  // El rol "real" para decidir si es editable. Aceptamos tanto el
  // formato del backend ('CLIENTE' / 'TRABAJADOR') como los roles internos
  // de Usuario (cliente_b2b, cliente_b2c, admin, ejecutivo, operador, analista).
  const rolPerfil = perfil?.rol || perfil?.Rol || usuario?.rol
  const datosPerfil = perfil?.datos || usuario?.datos
  const rolUsuarioInterno = useMemo(() => {
    if (ROLES_CLIENTE.includes(usuario?.rol)) return usuario.rol
    if (ROLES_CLIENTE.includes(datosPerfil?.usuario?.rol)) return datosPerfil.usuario.rol
    if (ROLES_CLIENTE.includes(datosPerfil?.rol)) return datosPerfil.rol
    return usuario?.rol || rolPerfil
  }, [usuario, datosPerfil, rolPerfil])

  const editable = true

  useEffect(() => {
    if (!editando) return
    if (regiones.length > 0) return
    let activo = true
    const cargarRegiones = async () => {
      setCargandoRegiones(true)
      try {
        const { data } = await obtenerRegionesDespacho()
        const lista = obtenerListaRespuesta(data)
          .map(normalizarUbicacion)
          .filter(Boolean)
        if (activo) setRegiones(lista)
      } catch {
        if (activo) setRegiones([])
      } finally {
        if (activo) setCargandoRegiones(false)
      }
    }
    cargarRegiones()
    return () => { activo = false }
  }, [editando])

  useEffect(() => {
    if (!form.regionId) {
      setComunas([])
      return
    }
    let activo = true
    const cargarComunas = async () => {
      setCargandoComunas(true)
      try {
        const { data } = await obtenerComunasDespacho(form.regionId)
        const lista = obtenerListaRespuesta(data)
          .map(normalizarUbicacion)
          .filter(Boolean)
        if (activo) setComunas(lista)
      } catch {
        if (activo) setComunas([])
      } finally {
        if (activo) setCargandoComunas(false)
      }
    }
    cargarComunas()
    return () => { activo = false }
  }, [form.regionId])

  useEffect(() => {
    // RutaProtegida garantiza que AuthContext ya completó su carga.
    // Si el contexto tiene el perfil completo, lo usamos directamente
    // para no emitir un GET /perfil/me/ redundante.
    if (usuario?.datos !== undefined) {
      const rolBackend = usuario.rol_backend || usuario.rol
      const perfilNormalizado = { rol: rolBackend, datos: usuario.datos }
      setPerfil(perfilNormalizado)
      const iniciales = camposIniciales(usuario.datos, rolBackend)
      setForm(iniciales)
      setOriginal(iniciales)
      setCargando(false)
      return
    }
    // Fallback: sesión mínima desde token (sin datos completos)
    getPerfil()
      .then((res) => {
        const data = res?.data ?? res
        const perfilNormalizado = data?.datos ? data : (data?.data ?? data)
        setPerfil(perfilNormalizado)
        const iniciales = camposIniciales(
          perfilNormalizado?.datos,
          perfilNormalizado?.rol || perfilNormalizado?.Rol,
        )
        setForm(iniciales)
        setOriginal(iniciales)
      })
      .catch((err) => setErrorGeneral(mensajeErrorApi(err, 'No se pudieron cargar los datos del perfil.')))
      .finally(() => setCargando(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setField = (campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }))
    if (errores[campo]) setErrores(e => ({ ...e, [campo]: '' }))
    if (okMsg) setOkMsg('')
  }

  const cambios = useMemo(() => {
    const diff = {}
    for (const k of Object.keys(form)) {
      if ((form[k] ?? '') !== (original[k] ?? '')) diff[k] = form[k]
    }
    return diff
  }, [form, original])

  const hayCambios = Object.keys(cambios).length > 0

  const validar = () => {
    const e = {}
    if (!form.first_name.trim()) e.first_name = 'El nombre es obligatorio.'
    if (!form.last_name.trim()) e.last_name = 'El apellido es obligatorio.'
    if (!form.email.trim()) e.email = 'El email es obligatorio.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email inválido.'
    return e
  }

  const handleCancelar = () => {
    setForm(original)
    setErrores({})
    setErrorGeneral('')
    setOkMsg('')
    setEditando(false)
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    setErrorGeneral('')
    setOkMsg('')
    const eVal = validar()
    if (Object.keys(eVal).length > 0) { setErrores(eVal); return }
    if (!hayCambios) {
      setErrorGeneral('No hay cambios para guardar.')
      return
    }
    setGuardando(true)
    try {
      const payload = {}
      let direccionCambiada = false
      for (const [k, v] of Object.entries(cambios)) {
        if (k === 'regionId' || k === 'comunaId') {
          direccionCambiada = true
          continue
        }
        if (k === 'direccion' || k === 'num_direccion' || k === 'detalle_direccion') direccionCambiada = true
        const valor = (v ?? '').toString().trim()
        if (valor) payload[k] = valor
      }
      if (direccionCambiada) {
        payload.direccion_principal = {
          direccion: form.direccion?.trim() || '',
          num_direccion: form.num_direccion?.trim() || '',
          detalle_direccion: form.detalle_direccion?.trim() || '',
          comuna: normalizarId(form.comunaId),
          es_principal: true,
        }
      }
      const actualizado = await actualizarPerfilUsuario(payload)
      const nuevos = camposIniciales(actualizado?.datos, actualizado?.rol)
      setForm(nuevos)
      setOriginal(nuevos)
      setPerfil(prev => ({ ...prev, datos: actualizado?.datos, rol: actualizado?.rol }))
      setOkMsg('Datos actualizados correctamente.')
      setEditando(false)
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') {
        const nuevosErrores = {}
        Object.entries(data).forEach(([campo, msg]) => {
          const m = Array.isArray(msg) ? msg.join(' ') : String(msg)
          if (campo === 'detail' || campo === 'non_field_errors') setErrorGeneral(m)
          else nuevosErrores[campo] = m
        })
        setErrores(nuevosErrores)
        if (Object.keys(nuevosErrores).length === 0 && !errorGeneral) {
          setErrorGeneral(JSON.stringify(data))
        }
      } else {
        setErrorGeneral(mensajeErrorApi(err, 'No se pudo actualizar el perfil. Intente nuevamente.'))
      }
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <div className="spinner" />

  const tipoCliente = datosPerfil?.tipo_cliente
  const institucion = datosPerfil?.institucion_nombre || datosPerfil?.nombre_institucion || datosPerfil?.institucion
  const username = datosPerfil?.usuario?.username || datosPerfil?.username
  const direccionPrincipal = datosPerfil?.direccion_principal
  const regionNombre = regiones.find(r => String(r.id) === String(form.regionId))?.nombre
    || direccionPrincipal?.region?.nombre
    || direccionPrincipal?.region_nombre
  const comunaNombre = comunas.find(c => String(c.id) === String(form.comunaId))?.nombre
    || direccionPrincipal?.comuna_detalle?.nombre
    || direccionPrincipal?.comuna_nombre

  // Detectar si el usuario tiene su perfil "incompleto" (datos básicos vacíos)
  const perfilIncompleto = editable && (
    !original.first_name || !original.last_name || !original.email
  )

  return (
    <div className="perfil-page">
      <div className="perfil-container">
        <header className="perfil-header">
          <h1>Mi perfil</h1>
          <p className="text-muted">
            Revisa y actualiza tus datos personales.
          </p>
        </header>

        <div className="perfil-layout">
          {/* ── Resumen lateral ── */}
          <aside className="perfil-resumen card">
            <div className="perfil-avatar">
              {(form.first_name || username || '?').trim().charAt(0).toUpperCase()}
            </div>
            <div className="perfil-resumen-nombre">
              {form.first_name || form.last_name
                ? `${form.first_name} ${form.last_name}`.trim()
                : username || 'Sin nombre'}
            </div>
            <span className="badge badge-info">
              {ETIQUETAS_ROL[rolUsuarioInterno] || ETIQUETAS_ROL[rolPerfil] || rolPerfil || 'Usuario'}
            </span>

            <dl className="perfil-meta">
              {username && (
                <>
                  <dt>Usuario</dt>
                  <dd>{username}</dd>
                </>
              )}
              {tipoCliente && (
                <>
                  <dt>Tipo de cuenta</dt>
                  <dd>{tipoCliente}</dd>
                </>
              )}
              {institucion && (
                <>
                  <dt>Institución</dt>
                  <dd>{institucion}</dd>
                </>
              )}
            </dl>

            <Link to="/panel" className="btn btn-secondary btn-block btn-sm">
              ← Volver al panel
            </Link>
          </aside>

          {/* ── Vista de datos personales (solo lectura) ── */}
          <section className="card perfil-vista">
            <div className="perfil-vista-header">
              <h2 className="section-title">Mis datos</h2>
              {editable && !editando && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setEditando(true)}
                >
                  Editar datos
                </button>
              )}
            </div>

            {editable && perfilIncompleto && !okMsg && (
              <div className="alert alert-info">
                Tu perfil está incompleto. Por favor completa tu <strong>nombre</strong>,
                <strong> apellido</strong> y <strong>email</strong> para mejorar tu experiencia.
              </div>
            )}
            {errorGeneral && <div className="alert alert-error">{errorGeneral}</div>}
            {okMsg && <div className="alert alert-success">{okMsg}</div>}

            <form id="perfil-form" onSubmit={handleSubmit} noValidate>
              <dl className="perfil-datos-grid">
                <div className="perfil-dato">
                  <dt>Nombre</dt>
                  <dd>
                    {editando ? (
                      <EditableInput
                        value={form.first_name}
                        onChange={e => setField('first_name', e.target.value)}
                        disabled={!editable}
                        autoComplete="given-name"
                        placeholder="Ej: María"
                        error={errores.first_name}
                      />
                    ) : (original.first_name || <span className="dato-vacio">— sin registrar —</span>)}
                  </dd>
                </div>
                <div className="perfil-dato">
                  <dt>Apellido</dt>
                  <dd>
                    {editando ? (
                      <EditableInput
                        value={form.last_name}
                        onChange={e => setField('last_name', e.target.value)}
                        disabled={!editable}
                        autoComplete="family-name"
                        placeholder="Ej: González"
                        error={errores.last_name}
                      />
                    ) : (original.last_name || <span className="dato-vacio">— sin registrar —</span>)}
                  </dd>
                </div>
                <div className="perfil-dato">
                  <dt>Email</dt>
                  <dd>
                    {editando ? (
                      <EditableInput
                        type="email"
                        value={form.email}
                        onChange={e => setField('email', e.target.value)}
                        disabled={!editable}
                        autoComplete="email"
                        placeholder="tu@correo.cl"
                        error={errores.email}
                      />
                    ) : (original.email || <span className="dato-vacio">— sin registrar —</span>)}
                  </dd>
                </div>
                <div className="perfil-dato">
                  <dt>RUT</dt>
                  <dd>
                    {editando ? (
                      <EditableInput
                        value={form.rut}
                        onChange={e => setField('rut', e.target.value)}
                        disabled={!editable}
                        placeholder="12345678-9"
                        error={errores.rut}
                      />
                    ) : (original.rut || <span className="dato-vacio">— sin registrar —</span>)}
                  </dd>
                </div>
                <div className="perfil-dato">
                  <dt>Teléfono</dt>
                  <dd>
                    {editando ? (
                      <EditableInput
                        type="tel"
                        value={form.telefono}
                        onChange={e => setField('telefono', e.target.value)}
                        disabled={!editable}
                        placeholder="+56 9 XXXX XXXX"
                        autoComplete="tel"
                        error={errores.telefono}
                      />
                    ) : (original.telefono || <span className="dato-vacio">— sin registrar —</span>)}
                  </dd>
                </div>
                <div className="perfil-dato">
                  <dt>Dirección</dt>
                  <dd>
                    {editando ? (
                      <EditableInput
                        value={form.direccion}
                        onChange={e => setField('direccion', e.target.value)}
                        disabled={!editable}
                        placeholder="Calle"
                        autoComplete="street-address"
                        error={errores.direccion}
                      />
                    ) : (original.direccion || <span className="dato-vacio">— sin registrar —</span>)}
                  </dd>
                </div>
                <div className="perfil-dato">
                  <dt>Número</dt>
                  <dd>
                    {editando ? (
                      <EditableInput
                        value={form.num_direccion}
                        onChange={e => setField('num_direccion', e.target.value)}
                        disabled={!editable}
                        placeholder="123"
                        error={errores.num_direccion}
                      />
                    ) : (original.num_direccion || <span className="dato-vacio">— sin registrar —</span>)}
                  </dd>
                </div>
                <div className="perfil-dato perfil-dato-full">
                  <dt>Detalle dirección</dt>
                  <dd>
                    {editando ? (
                      <EditableTextarea
                        value={form.detalle_direccion}
                        onChange={e => setField('detalle_direccion', e.target.value)}
                        disabled={!editable}
                        placeholder="Depto, referencia"
                        error={errores.detalle_direccion}
                      />
                    ) : (original.detalle_direccion || <span className="dato-vacio">— sin registrar —</span>)}
                  </dd>
                </div>
                <div className="perfil-dato">
                  <dt>Región</dt>
                  <dd>
                    {editando ? (
                      <UbicacionCombobox
                        label=""
                        placeholder="Busca o selecciona una región"
                        items={regiones}
                        selectedId={form.regionId}
                        loading={cargandoRegiones}
                        disabled={!editable || cargandoRegiones || regiones.length === 0}
                        emptyText="No se encontraron regiones"
                        onSelect={(region) => {
                          setField('regionId', region?.id || '')
                          setField('comunaId', '')
                        }}
                      />
                    ) : (regionNombre || <span className="dato-vacio">— sin registrar —</span>)}
                  </dd>
                </div>
                <div className="perfil-dato">
                  <dt>Comuna</dt>
                  <dd>
                    {editando ? (
                      <UbicacionCombobox
                        label=""
                        placeholder={form.regionId ? 'Busca o selecciona una comuna' : 'Selecciona una región primero'}
                        items={comunas}
                        selectedId={form.comunaId}
                        loading={cargandoComunas}
                        disabled={!editable || !form.regionId || cargandoComunas}
                        emptyText="No se encontraron comunas"
                        onSelect={(comuna) => {
                          setField('comunaId', comuna?.id || '')
                        }}
                      />
                    ) : (comunaNombre || <span className="dato-vacio">— sin registrar —</span>)}
                  </dd>
                </div>
                {username && (
                  <div className="perfil-dato">
                    <dt>Usuario</dt>
                    <dd>{username}</dd>
                  </div>
                )}
                <div className="perfil-dato">
                  <dt>Rol</dt>
                  <dd>{ETIQUETAS_ROL[rolUsuarioInterno] || ETIQUETAS_ROL[rolPerfil] || rolPerfil || '—'}</dd>
                </div>
                {tipoCliente && (
                  <div className="perfil-dato">
                    <dt>Tipo de cuenta</dt>
                    <dd>{tipoCliente}</dd>
                  </div>
                )}
                {institucion && (
                  <div className="perfil-dato perfil-dato-full">
                    <dt>Institución</dt>
                    <dd>{institucion}</dd>
                  </div>
                )}
              </dl>

              {editable && editando && (
                <div className="perfil-vista-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCancelar}
                  >
                    Cancelar cambios
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={guardando || !hayCambios}
                  >
                    {guardando ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              )}
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}
