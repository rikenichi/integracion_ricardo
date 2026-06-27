import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useCombobox } from 'downshift'
import { Link } from 'react-router-dom'
import { registrarUsuario, obtenerComunasDespacho, obtenerRegionesDespacho } from '../../services/api'
import './RegistroPage.css'

const TIPOS_CLIENTE = {
  particular: 'PARTICULAR',
  institucional: 'INSTITUCIONAL',
}

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

  const wrapperRef = useRef(null)

  useLayoutEffect(() => {
    if (!wrapperRef.current) return
    wrapperRef.current.querySelectorAll('[aria-activedescendant=""]').forEach(el => {
      el.removeAttribute('aria-activedescendant')
    })
  })

  return (
      <div className="ubicacion-combobox" ref={wrapperRef}>
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

const FORM_INICIAL = {
  tipoCliente: TIPOS_CLIENTE.particular,
  nombre: '',
  apellido: '',
  email: '',
  telefono: '',
  rut: '',
  institucionNombre: '',
  institucionRut: '',
  regionId: '',
  comunaId: '',
  direccion: '',
  numeroDireccion: '',
  detalleDireccion: '',
  referencia: '',
  password: '',
  confirmPassword: '',
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validarTextoGeneral(valor) {
  const texto = String(valor || '').trim()
  if (texto.length < 2) return false
  return !/^\d+$/.test(texto)
}

function validarTelefonoChileno(valor) {
  const telefono = String(valor || '').trim()
  if (!/^\+?\d+$/.test(telefono)) return false

  if (telefono.startsWith('+56')) {
    const numero = telefono.slice(3)
    return /^\d{8,9}$/.test(numero)
  }

  return /^\d{8,9}$/.test(telefono)
}

function limpiarRut(rut) {
  return String(rut || '').replace(/\./g, '').replace(/-/g, '').trim().toUpperCase()
}

function formatearRut(rut) {
  const limpio = limpiarRut(rut)
  if (!limpio) return ''
  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1)
  return `${cuerpo}-${dv}`
}

function calcularDigitoRut(cuerpo) {
  let suma = 0
  let multiplo = 2

  for (let i = cuerpo.length - 1; i >= 0; i -= 1) {
    suma += Number(cuerpo[i]) * multiplo
    multiplo = multiplo === 7 ? 2 : multiplo + 1
  }

  const resto = 11 - (suma % 11)
  if (resto === 11) return '0'
  if (resto === 10) return 'K'
  return String(resto)
}

function validarRutChileno(rut) {
  const limpio = limpiarRut(rut)
  if (!/^\d{6,9}[0-9K]$/.test(limpio)) return false

  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1)
  return calcularDigitoRut(cuerpo) === dv
}

function obtenerListaRespuesta(data) {
  return data?.results || data || []
}

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function escapeRegExp(valor) {
  return String(valor || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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

function filtrarUbicaciones(lista, filtro) {
  if (!filtro) return lista
  const texto = normalizarTexto(filtro)
  if (!texto) return lista
  const regex = new RegExp(escapeRegExp(texto))
  return lista.filter((item) => regex.test(normalizarTexto(item.nombre)))
}

function obtenerValorRuta(obj, ruta) {
  return ruta.split('.').reduce((acc, key) => acc?.[key], obj)
}

function extraerMensajeError(valor) {
  if (Array.isArray(valor)) return valor.join(' ')
  if (typeof valor === 'string') return valor
  return ''
}

function normalizarId(valor) {
  const texto = String(valor ?? '').trim()
  if (!texto) return null
  return /^\d+$/.test(texto) ? Number(texto) : texto
}

export default function RegistroPage() {
  const [form, setForm] = useState(FORM_INICIAL)
  const [errores, setErrores] = useState({})
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [regiones, setRegiones] = useState([])
  const [comunas, setComunas] = useState([])
  const [cargandoRegiones, setCargandoRegiones] = useState(false)
  const [cargandoComunas, setCargandoComunas] = useState(false)
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [mostrarConfirmPassword, setMostrarConfirmPassword] = useState(false)
  const [tipoRegistrado, setTipoRegistrado] = useState('')

  const esInstitucional = form.tipoCliente === TIPOS_CLIENTE.institucional

  useEffect(() => {
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
    return () => {
      activo = false
    }
  }, [])

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
    return () => {
      activo = false
    }
  }, [form.regionId])

  const actualizarCampo = (campo, valor) => {
    setForm(prev => {
      const siguiente = { ...prev, [campo]: valor }

      if (campo === 'tipoCliente') {
        siguiente.rut = ''
        siguiente.institucionNombre = ''
        siguiente.institucionRut = ''
      }

      if (campo === 'regionId') {
        siguiente.comunaId = ''
      }

      return siguiente
    })

    setErrores(prev => {
      if (campo === 'tipoCliente') return {}
      return { ...prev, [campo]: '' }
    })
    setEnviado(false)


  }

  const validarFormulario = () => {
    const nuevosErrores = {}
    const requeridos = [
      'nombre',
      'apellido',
      'email',
      'telefono',
      'regionId',
      'comunaId',
      'direccion',
      'numeroDireccion',
      'password',
      'confirmPassword',
    ]

    if (esInstitucional) {
      requeridos.push('rut')
    }

    requeridos.forEach(campo => {
      if (!String(form[campo] || '').trim()) {
        nuevosErrores[campo] = 'Este campo es obligatorio.'
      }
    })

    ;['nombre', 'apellido'].forEach(campo => {
      if (form[campo] && !validarTextoGeneral(form[campo])) {
        nuevosErrores[campo] = 'Debe tener al menos 2 caracteres y no puede ser solo números.'
      }
    })

    if (form.email && !validarEmail(form.email)) {
      nuevosErrores.email = 'Ingresa un correo electrónico válido.'
    }

    if (form.telefono && !validarTelefonoChileno(form.telefono)) {
      nuevosErrores.telefono = 'Ingresa un teléfono válido.'
    }

    if (!esInstitucional) {
      if (!String(form.rut || '').trim()) {
        nuevosErrores.rut = 'Debes ingresar tu RUT.'
      } else if (!validarRutChileno(form.rut)) {
        nuevosErrores.rut = 'Ingresa un RUT válido.'
      }
    } else if (form.rut && !validarRutChileno(form.rut)) {
      nuevosErrores.rut = 'Ingresa un RUT válido.'
    }

    if (esInstitucional) {
      if (!String(form.institucionNombre || '').trim()) {
        nuevosErrores.institucionNombre = 'Debes indicar el nombre de la institución.'
      } else if (!validarTextoGeneral(form.institucionNombre)) {
        nuevosErrores.institucionNombre = 'Ingresa un nombre válido.'
      }

      if (!String(form.institucionRut || '').trim()) {
        nuevosErrores.institucionRut = 'Debes indicar el RUT de la institución.'
      } else if (!validarRutChileno(form.institucionRut)) {
        nuevosErrores.institucionRut = 'Ingresa un RUT válido.'
      }
    }

    if (form.numeroDireccion && !/^\d+[A-Za-z0-9\-\/]*$/.test(form.numeroDireccion.trim())) {
      nuevosErrores.numeroDireccion = 'Ingresa un número de dirección válido.'
    }

    if (form.password && form.password.length < 6) {
      nuevosErrores.password = 'La contraseña debe tener al menos 6 caracteres.'
    }

    if (form.password && form.confirmPassword && form.password !== form.confirmPassword) {
      nuevosErrores.confirmPassword = 'Las contraseñas no coinciden.'
    }

    setErrores(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setEnviado(false)

    if (!validarFormulario()) return

    const rut = form.rut ? formatearRut(form.rut) : null

    const payload = {
      usuario: {
        username: form.email.trim(),
        email: form.email.trim(),
        first_name: form.nombre.trim(),
        last_name: form.apellido.trim(),
        password: form.password,
        password2: form.confirmPassword,
      },
      rut: rut || null,
      pasaporte: null,
      tipo_cliente: form.tipoCliente,
      telefono: form.telefono.trim(),
      institucion_id: null,
      datos_institucion: esInstitucional
        ? {
            razon_social: form.institucionNombre.trim(),
            rut_empresa: formatearRut(form.institucionRut),
          }
        : null,
      direccion_entrega: {
        direccion: form.direccion.trim(),
        num_direccion: form.numeroDireccion.trim(),
        detalle_direccion: form.detalleDireccion.trim() || '',
        comuna: normalizarId(form.comunaId),
        referencia: form.referencia.trim() || '',
        nombre_receptor: `${form.nombre} ${form.apellido}`.trim(),
        telefono_receptor: form.telefono.trim(),
        es_principal: true,
      },
    }

    try {
      setEnviando(true)
      await registrarUsuario(payload)
      setTipoRegistrado(form.tipoCliente)
      setEnviado(true)
      setForm(FORM_INICIAL)

    } catch (error) {
      const data = error.response?.data
      setErrores(
        data && typeof data === 'object'
          ? data
          : { general: 'No se pudo crear la cuenta. Intenta nuevamente.' }
      )
    } finally {
      setEnviando(false)
    }
  }

  const obtenerMensajeError = (campo, alternativos = []) => {
    const rutas = [campo, ...alternativos]
    for (const ruta of rutas) {
      const valor = ruta.includes('.') ? obtenerValorRuta(errores, ruta) : errores?.[ruta]
      const mensaje = extraerMensajeError(valor)
      if (mensaje) return mensaje
    }
    return ''
  }

  const renderError = (campo, alternativos = []) => {
    const mensaje = obtenerMensajeError(campo, alternativos)
    return mensaje ? <span className="registro-error">{mensaje}</span> : null
  }



  return (
    <main className="registro-page">
      <section className="registro-card">
        <div className="registro-header">
          <span className="registro-kicker">Nueva cuenta</span>
          <h1>Crear cuenta MEDISTOCK</h1>
          <p>Regístrate como cliente particular o institucional.</p>
        </div>

        {enviado && (
          <div className="alert alert-success">
            {tipoRegistrado === TIPOS_CLIENTE.institucional ? (
              <>
                <strong>Cuenta institucional creada.</strong> Ya puedes iniciar sesión.
                Las compras realizadas como cliente institucional quedan registradas para
                revisión comercial y generación de convenios B2B.
              </>
            ) : (
              'Cuenta creada correctamente. Ya puedes iniciar sesión.'
            )}
          </div>
        )}

        {errores.general && (
          <div className="alert alert-danger">
            {errores.general}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <fieldset className="registro-tipo">
            <legend>Tipo de cliente</legend>
            <button
              type="button"
              className={`tipo-card ${!esInstitucional ? 'tipo-card-activo' : ''}`}
              onClick={() => actualizarCampo('tipoCliente', TIPOS_CLIENTE.particular)}
            >
              <strong>Particular</strong>
              <span>Compra productos médicos para uso personal.</span>
            </button>
            <button
              type="button"
              className={`tipo-card ${esInstitucional ? 'tipo-card-activo' : ''}`}
              onClick={() => actualizarCampo('tipoCliente', TIPOS_CLIENTE.institucional)}
            >
              <strong>Institucional</strong>
              <span>Cuenta para compras y convenios corporativos.</span>
            </button>
          </fieldset>

          <h3 className="registro-subtitle">Datos personales</h3>
          <div className="registro-grid">
            <div className="form-group">
              <label>Nombre *</label>
              <input
                value={form.nombre}
                onChange={e => actualizarCampo('nombre', e.target.value)}
                placeholder="Ej: Camila"
              />
              {renderError('nombre', ['usuario.first_name'])}
            </div>
            <div className="form-group">
              <label>Apellido *</label>
              <input
                value={form.apellido}
                onChange={e => actualizarCampo('apellido', e.target.value)}
                placeholder="Ej: Pérez"
              />
              {renderError('apellido', ['usuario.last_name'])}
            </div>
            <div className="form-group">
              <label>Correo electrónico *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => actualizarCampo('email', e.target.value)}
                placeholder="correo@dominio.com"
              />
              {renderError('email', ['usuario.email'])}
            </div>
            <div className="form-group">
              <label>Teléfono *</label>
              <input
                value={form.telefono}
                onChange={e => actualizarCampo('telefono', e.target.value)}
                placeholder="Ej: +56912345678"
              />
              {renderError('telefono')}
            </div>
            <div className="form-group">
              <label>RUT{esInstitucional ? ' representante' : ''} *</label>
              <input
                value={form.rut}
                onChange={e => actualizarCampo('rut', e.target.value)}
                placeholder="Ej: 12.345.678-9"
              />
              {renderError('rut')}
            </div>
          </div>

          {esInstitucional && (
            <>
              <h3 className="registro-subtitle">Institución</h3>
              <div className="registro-grid">
                <div className="form-group">
                  <label>Nombre institución *</label>
                  <input
                    value={form.institucionNombre}
                    onChange={e => actualizarCampo('institucionNombre', e.target.value)}
                    placeholder="Ej: Clínica Los Andes"
                  />
                  {renderError('institucionNombre', ['datos_institucion.nombre'])}
                </div>
                <div className="form-group">
                  <label>RUT institución *</label>
                  <input
                    value={form.institucionRut}
                    onChange={e => actualizarCampo('institucionRut', e.target.value)}
                    placeholder="Ej: 76.543.210-1"
                  />
                  {renderError('institucionRut', ['datos_institucion.rut'])}
                </div>
              </div>
            </>
          )}

          <h3 className="registro-subtitle">Dirección de entrega</h3>
          <div className="registro-grid">
            <div className="form-group">
              <UbicacionCombobox
                  label="Región *"
                  placeholder="Busca o selecciona una región"
                  items={regiones}
                  selectedId={form.regionId}
                  loading={cargandoRegiones}
                  disabled={cargandoRegiones || regiones.length === 0}
                  emptyText="No se encontraron regiones"
                  onSelect={(region) => {
                    actualizarCampo('regionId', region?.id || '')
                  }}
              />
              {renderError('regionId')}
            </div>
            <div className="form-group">
              <UbicacionCombobox
                  label="Comuna *"
                  placeholder={form.regionId ? 'Busca o selecciona una comuna' : 'Selecciona una región primero'}
                  items={comunas}
                  selectedId={form.comunaId}
                  loading={cargandoComunas}
                  disabled={!form.regionId || cargandoComunas}
                  emptyText="No se encontraron comunas"
                  onSelect={(comuna) => {
                    actualizarCampo('comunaId', comuna?.id || '')
                  }}
              />
              {renderError('comunaId', ['direccion_entrega.comuna'])}
            </div>
            <div className="form-group">
              <label>Dirección *</label>
              <input
                value={form.direccion}
                onChange={e => actualizarCampo('direccion', e.target.value)}
                placeholder="Ej: Calle Los Boldos"
              />
              {renderError('direccion', ['direccion_entrega.direccion'])}
            </div>
            <div className="form-group">
              <label>Número *</label>
              <input
                value={form.numeroDireccion}
                onChange={e => actualizarCampo('numeroDireccion', e.target.value)}
                placeholder="Ej: 123"
              />
              {renderError('numeroDireccion', ['direccion_entrega.num_direccion'])}
            </div>
            <div className="form-group registro-full">
              <label>Detalle dirección</label>
              <input
                value={form.detalleDireccion}
                onChange={e => actualizarCampo('detalleDireccion', e.target.value)}
                placeholder="Ej: Depto 201"
              />
              {renderError('detalleDireccion', ['direccion_entrega.detalle_direccion'])}
            </div>
            <div className="form-group registro-full">
              <label>Referencia</label>
              <input
                value={form.referencia}
                onChange={e => actualizarCampo('referencia', e.target.value)}
                placeholder="Ej: Frente a la plaza"
              />
              {renderError('referencia', ['direccion_entrega.referencia'])}
            </div>
          </div>

          <h3 className="registro-subtitle">Credenciales</h3>
          <div className="registro-grid">
            <div className="form-group">
              <label>Contraseña *</label>
              <div className="password-field">
                <input
                  type={mostrarPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => actualizarCampo('password', e.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setMostrarPassword(prev => !prev)}
                  aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={mostrarPassword}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path
                      d="M12 5C7 5 3.3 8.1 2 12c1.3 3.9 5 7 10 7s8.7-3.1 10-7c-1.3-3.9-5-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
                    />
                  </svg>
                </button>
              </div>
              {renderError('password', ['usuario.password'])}
            </div>
            <div className="form-group">
              <label>Confirmar contraseña *</label>
              <div className="password-field">
                <input
                  type={mostrarConfirmPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={e => actualizarCampo('confirmPassword', e.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setMostrarConfirmPassword(prev => !prev)}
                  aria-label={mostrarConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={mostrarConfirmPassword}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path
                      d="M12 5C7 5 3.3 8.1 2 12c1.3 3.9 5 7 10 7s8.7-3.1 10-7c-1.3-3.9-5-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
                    />
                  </svg>
                </button>
              </div>
              {renderError('confirmPassword', ['usuario.password2'])}
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={enviando}>
            {enviando ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="registro-login-link">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </section>
    </main>
  )
}
