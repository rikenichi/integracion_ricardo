import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCarrito } from '../../context/CarritoContext'
import { useAuth } from '../../context/AuthContext'
import { guardarCotizacionPedido } from '../../utils/cotizacionStorage'
import { obtenerPrecioProducto } from '../../utils/format'
import { puedeComprar, razonNoCompra } from '../../utils/permisos'
import {
  crearDireccionEntrega,
  crearPedido,
  cotizarDespacho,
  obtenerComunasDespacho,
  obtenerMisDirecciones,
  obtenerRegionesDespacho,
  obtenerSucursalDespacho,
} from '../../services/api'
import './ConfirmacionPedidoPage.css'

function formatPrecio(n) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(Number(n || 0))
}

function normalizarLista(payload, key) {
  const lista = payload?.[key] || payload?.data || payload || []
  return Array.isArray(lista) ? lista : []
}

function limpiarTexto(valor) {
  return String(valor || '')
      .trim()
      .replace(/\s+/g, ' ')
}

function normalizarTexto(valor) {
  return limpiarTexto(valor)
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
}

function obtenerIdRegion(region) {
  return region?.id || region?.region_id || null
}

function obtenerNombreRegion(region) {
  return region?.nombre || region?.name || region?.region || ''
}

function obtenerNombreComuna(comuna) {
  return comuna?.nombre
      || comuna?.nombre_comuna
      || comuna?.comuna
      || comuna?.countyName
      || comuna?.coverageName
      || comuna?.name
      || ''
}

function obtenerIdComuna(comuna) {
  return comuna?.id
      || comuna?.comuna_id
      || comuna?.comuna?.id
      || null
}

function obtenerCountyCodeComuna(comuna) {
  return comuna?.chilexpress?.county_code
      || comuna?.county_code
      || comuna?.countyCode
      || comuna?.codigo_chilexpress
      || ''
}

function deduplicarComunas(lista) {
  const comunasUnicas = new Map()

  lista.forEach(comuna => {
    const id = obtenerIdComuna(comuna)
    const nombre = limpiarTexto(obtenerNombreComuna(comuna))
    const countyCode = obtenerCountyCodeComuna(comuna)
    const clave = id ? String(id) : normalizarTexto(nombre)

    if (clave && !comunasUnicas.has(clave)) {
      comunasUnicas.set(clave, {
        ...comuna,
        id,
        codigo: String(id || ''),
        countyCode,
        nombre,
      })
    }
  })

  return Array.from(comunasUnicas.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es-CL', { sensitivity: 'base' })
  )
}

function construirDireccionTexto(direccion) {
  if (!direccion) return ''

  if (typeof direccion === 'string') {
    return limpiarTexto(direccion)
  }

  return [
    direccion.direccion,
    direccion.num_direccion,
    direccion.detalle_direccion,
  ]
      .filter(Boolean)
      .map(limpiarTexto)
      .join(' ')
}

function normalizarDireccionEntrega(direccion) {
  if (!direccion) return null

  const comunaObj = typeof direccion.comuna === 'object' ? direccion.comuna : null
  const regionObj = typeof direccion.region === 'object' ? direccion.region : null
  const direccionCompleta = construirDireccionTexto(direccion)

  if (!direccionCompleta) return null

  return {
    id: direccion.id || null,
    direccion: direccionCompleta,
    referencia: direccion.referencia || '',
    nombreReceptor: direccion.nombre_receptor || '',
    telefonoReceptor: direccion.telefono_receptor || '',
    esPrincipal: Boolean(direccion.es_principal),

    comunaId: comunaObj?.id || direccion.comuna_id || direccion.comuna || null,
    comunaNombre:
        direccion.comuna_nombre
        || comunaObj?.nombre
        || comunaObj?.nombre_comuna
        || '',

    regionId:
        regionObj?.id
        || direccion.region_id
        || comunaObj?.region?.id
        || null,
    regionNombre:
        direccion.region_nombre
        || regionObj?.nombre
        || comunaObj?.region?.nombre
        || '',
  }
}

function comunaCoincideConDireccion(comuna, direccionRegistrada) {
  if (!comuna || !direccionRegistrada) return false

  const idComuna = String(obtenerIdComuna(comuna) || '')
  const nombreComuna = normalizarTexto(obtenerNombreComuna(comuna))

  const comunaIdDireccion = String(direccionRegistrada.comunaId || '')
  const comunaNombreDireccion = normalizarTexto(direccionRegistrada.comunaNombre)

  return Boolean(
      (comunaIdDireccion && idComuna && comunaIdDireccion === idComuna)
      || (comunaNombreDireccion && nombreComuna && comunaNombreDireccion === nombreComuna)
  )
}

function numeroSeguro(valor, fallback) {
  const numero = Number(valor)
  return Number.isFinite(numero) && numero > 0 ? numero : fallback
}

function construirProductosCotizacion(items) {
  return items.map(({ producto, cantidad }) => ({
    peso_mg: numeroSeguro(producto?.peso_mg, 100000),
    largo_mm: numeroSeguro(producto?.largo_mm, 100),
    ancho_mm: numeroSeguro(producto?.ancho_mm, 100),
    alto_mm: numeroSeguro(producto?.alto_mm, 100),
    cantidad: numeroSeguro(cantidad, 1),
    valor_unitario: obtenerPrecioProducto(producto),
  }))
}

function obtenerServiciosDisponibles(cotizacion) {
  const servicios = cotizacion?.servicios_disponibles || cotizacion?.serviciosDisponibles || []
  return Array.isArray(servicios) ? servicios : []
}

function obtenerServicioSeleccionado(cotizacion, servicioSeleccionadoCodigo) {
  const servicios = obtenerServiciosDisponibles(cotizacion)

  if (!servicios.length) return null

  if (servicioSeleccionadoCodigo) {
    const encontrado = servicios.find(servicio =>
        String(servicio.serviceTypeCode) === String(servicioSeleccionadoCodigo)
    )

    if (encontrado) return encontrado
  }

  return servicios[0]
}

function obtenerValorServicio(servicio) {
  return Number(servicio?.serviceValue || servicio?.valor || servicio?.costo || 0)
}

function obtenerDescripcionServicio(servicio) {
  return servicio?.serviceDescription
      || servicio?.descripcion
      || servicio?.servicio
      || 'Servicio Chilexpress'
}

function obtenerStockPorSucursal(producto) {
  const stock =
      producto?.stock_por_sucursal
      || producto?.stockPorSucursal
      || producto?.stocks
      || []

  return Array.isArray(stock) ? stock : []
}

function obtenerSucursalIdStock(stock) {
  return stock?.sucursal_id
      || stock?.sucursalId
      || stock?.sucursal?.id
      || stock?.id_sucursal
      || null
}

function obtenerSucursalNombreStock(stock) {
  return stock?.sucursal_nombre
      || stock?.sucursalNombre
      || stock?.sucursal?.nombre
      || `Sucursal ${obtenerSucursalIdStock(stock)}`
}

function obtenerStockNeto(stock) {
  return Number(
      stock?.stock_neto
      || stock?.stockNeto
      || stock?.cantidad_disponible
      || stock?.disponible
      || stock?.stock
      || 0
  )
}

function obtenerSucursalesConStockSuficiente(items) {
  if (!items.length) {
    return {
      sucursales: [],
      productosSinStock: [],
    }
  }

  let candidatas = null
  const productosSinStock = []

  items.forEach(({ producto, cantidad }) => {
    const stockProducto = obtenerStockPorSucursal(producto)
    const cantidadRequerida = Number(cantidad || 0)

    const disponiblesProducto = stockProducto
        .map(stock => {
          const sucursalId = obtenerSucursalIdStock(stock)
          const stockNeto = obtenerStockNeto(stock)

          return {
            sucursal_id: sucursalId,
            sucursal_nombre: obtenerSucursalNombreStock(stock),
            stock_neto: stockNeto,
          }
        })
        .filter(stock =>
            stock.sucursal_id
            && stock.stock_neto >= cantidadRequerida
        )

    if (!disponiblesProducto.length) {
      productosSinStock.push(producto?.nombre || `Producto ${producto?.id || ''}`)
    }

    const mapaDisponiblesProducto = new Map(
        disponiblesProducto.map(stock => [String(stock.sucursal_id), stock])
    )

    if (candidatas === null) {
      candidatas = mapaDisponiblesProducto
      return
    }

    candidatas.forEach((stock, sucursalId) => {
      if (!mapaDisponiblesProducto.has(sucursalId)) {
        candidatas.delete(sucursalId)
      }
    })
  })

  return {
    sucursales: Array.from((candidatas || new Map()).values()),
    productosSinStock,
  }
}

function normalizarSucursalDespacho(sucursal, fallback = {}) {
  const comunaObj = typeof sucursal?.comuna === 'object' ? sucursal.comuna : null
  const regionObj =
      typeof sucursal?.region === 'object'
          ? sucursal.region
          : comunaObj?.region

  return {
    id: sucursal?.id || fallback.sucursal_id || null,
    nombre: sucursal?.nombre || sucursal?.name || fallback.sucursal_nombre || `Sucursal ${fallback.sucursal_id || ''}`,
    direccion: sucursal?.direccion || '',
    comunaNombre:
        sucursal?.comuna_nombre
        || comunaObj?.nombre
        || comunaObj?.nombre_comuna
        || '',
    regionNombre:
        sucursal?.region_nombre
        || regionObj?.nombre
        || '',
    countyCode:
        sucursal?.county_code
        || sucursal?.countyCode
        || comunaObj?.chilexpress?.county_code
        || comunaObj?.county_code
        || '',
  }
}

function normalizarCotizacionChilexpress(data, sucursalOrigen) {
  const servicios = obtenerServiciosDisponibles(data)

  return {
    ...data,
    servicios_disponibles: servicios,
    courier: data?.courier || 'Chilexpress',
    origin_county_code: data?.origin_county_code || sucursalOrigen?.countyCode || '',
    destination_county_code: data?.destination_county_code || '',
    pedido_id: data?.pedido_id || null,
    num_cajas: data?.num_cajas || 1,
    sucursal_origen: sucursalOrigen || null,
  }
}

function obtenerServicioMasBarato(servicios) {
  if (!Array.isArray(servicios) || !servicios.length) return null

  return [...servicios].sort((a, b) =>
      obtenerValorServicio(a) - obtenerValorServicio(b)
  )[0]
}

function obtenerTextoUbicacionSucursal(sucursal) {
  if (!sucursal) return 'No informado'

  const partesUbicacion = [
    sucursal.comunaNombre,
    sucursal.regionNombre,
  ].filter(Boolean)

  const ubicacion = partesUbicacion.length ? partesUbicacion.join(', ') : 'Ubicacion no informada'

  return `${sucursal.nombre || 'Sucursal'} - ${ubicacion}`
}

function obtenerTextoDestino(comuna, region) {
  const comunaNombre = comuna?.nombre || ''
  const regionNombre = obtenerNombreRegion(region)

  return [comunaNombre, regionNombre].filter(Boolean).join(', ') || 'No informado'
}

function obtenerFechaRequeridaEntrega() {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + 2)
  return fecha.toISOString()
}

function obtenerMensajeErrorPedido(errorData) {
  if (!errorData) return 'Error al crear el pedido. Intente nuevamente.'

  if (typeof errorData === 'string') return errorData

  if (errorData.detail) return errorData.detail
  if (errorData.error) return errorData.error
  if (errorData.message) return errorData.message

  const campos = Object.entries(errorData)
      .map(([campo, mensajes]) => {
        if (Array.isArray(mensajes)) {
          return `${campo}: ${mensajes.join(', ')}`
        }

        return `${campo}: ${String(mensajes)}`
      })
      .join(' | ')

  return campos || 'Error al crear el pedido. Intente nuevamente.'
}

export default function ConfirmacionPedidoPage() {
  const { items, calcularTotal, vaciarCarrito } = useCarrito()
  const { usuario } = useAuth()
  const navigate = useNavigate()

  const esB2B = usuario?.rol === 'cliente_b2b'
  const usuarioPuedeComprar = puedeComprar(usuario)
  const mensajeNoCompra = razonNoCompra(usuario)

  const [direcciones, setDirecciones] = useState([])
  const [direccionRegistrada, setDireccionRegistrada] = useState(null)
  const [cargandoDirecciones, setCargandoDirecciones] = useState(false)
  const [modoDireccion, setModoDireccion] = useState('alternativa')

  const [direccion, setDireccion] = useState('')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [regiones, setRegiones] = useState([])
  const [comunas, setComunas] = useState([])
  const [regionCodigo, setRegionCodigo] = useState('')
  const [comunaCodigo, setComunaCodigo] = useState('')

  const [cargandoRegiones, setCargandoRegiones] = useState(false)
  const [cargandoComunas, setCargandoComunas] = useState(false)

  const [cotizando, setCotizando] = useState(false)
  const [cotizacion, setCotizacion] = useState(null)
  const [servicioSeleccionadoCodigo, setServicioSeleccionadoCodigo] = useState('')
  const [errorCotizacion, setErrorCotizacion] = useState('')
  const [detalleCotizacion, setDetalleCotizacion] = useState('')

  const ultimaCotizacionAutomaticaRef = useRef('')
  const resolviendoDireccionRegistradaRef = useRef(false)

  const subtotal = calcularTotal(esB2B)
  const descuento = esB2B ? subtotal * 0.10 : 0

  const tieneDireccionRegistrada = Boolean(direccionRegistrada?.direccion)
  const usandoDireccionRegistrada = modoDireccion === 'registrada' && tieneDireccionRegistrada
  const mostrarFormularioDireccion = !usandoDireccionRegistrada

  const regionSeleccionada = regiones.find(region =>
      String(obtenerIdRegion(region)) === String(regionCodigo)
  )

  const comunaSeleccionada = comunas.find(comuna =>
      String(obtenerIdComuna(comuna)) === String(comunaCodigo)
  )

  const ciudad = comunaSeleccionada?.nombre || direccionRegistrada?.comunaNombre || ''
  const countyCodeDestino = obtenerCountyCodeComuna(comunaSeleccionada)

  const productosCotizacion = useMemo(
      () => construirProductosCotizacion(items),
      [items]
  )

  const stockParaCotizar = useMemo(
      () => obtenerSucursalesConStockSuficiente(items),
      [items]
  )

  const serviciosDisponibles = useMemo(
      () => obtenerServiciosDisponibles(cotizacion),
      [cotizacion]
  )

  const servicioSeleccionado = useMemo(
      () => obtenerServicioSeleccionado(cotizacion, servicioSeleccionadoCodigo),
      [cotizacion, servicioSeleccionadoCodigo]
  )

  const costoEnvio = servicioSeleccionado
      ? obtenerValorServicio(servicioSeleccionado)
      : 0

  const total = subtotal - descuento + costoEnvio

  const puedeCotizar = Boolean(
      direccion.trim()
      && regionCodigo
      && comunaCodigo
      && comunaSeleccionada
      && countyCodeDestino
      && productosCotizacion.length > 0
      && stockParaCotizar.sucursales.length > 0
      && !cotizando
  )

  const cotizacionValida = Boolean(
      cotizacion
      && regionCodigo
      && comunaCodigo
      && countyCodeDestino
      && cotizacion?.sucursal_origen?.id
      && servicioSeleccionado
  )

  const puedeCrearPedido = Boolean(
      usuarioPuedeComprar
      && direccion.trim()
      && regionCodigo
      && comunaCodigo
      && cotizacionValida
  )

  const obtenerMotivoBloqueoPedido = () => {
    if (!usuarioPuedeComprar) return mensajeNoCompra
    if (!items.length) return 'El carrito esta vacio.'
    if (!direccion.trim()) return 'La direccion de entrega es obligatoria.'
    if (!regionCodigo || !comunaCodigo) return 'Debes seleccionar region y comuna para continuar.'
    if (!cotizacion) return 'Debes cotizar el despacho antes de crear el pedido.'
    if (!cotizacion?.sucursal_origen?.id) return 'Debes tener una sucursal de origen seleccionada desde la cotizacion.'
    if (!servicioSeleccionado) return 'Debes seleccionar un servicio de despacho.'
    return ''
  }

  const invalidarCotizacion = useCallback(() => {
    setCotizacion(null)
    setServicioSeleccionadoCodigo('')
    setErrorCotizacion('')
    setDetalleCotizacion('')
    ultimaCotizacionAutomaticaRef.current = ''
  }, [])

  const aplicarDireccionRegistrada = useCallback((direccionBase) => {
    if (!direccionBase?.direccion) return

    setModoDireccion('registrada')
    setDireccion(direccionBase.direccion)
    setError('')
    invalidarCotizacion()

    if (direccionBase.regionId) {
      setRegionCodigo(String(direccionBase.regionId))
    }

    if (direccionBase.comunaId) {
      setComunaCodigo(String(direccionBase.comunaId))
    }
  }, [invalidarCotizacion])

  const activarDireccionAlternativa = () => {
    if (!usuarioPuedeComprar) {
      setError(mensajeNoCompra)
      return
    }
    setModoDireccion('alternativa')
    setDireccion('')
    setRegionCodigo('')
    setComunaCodigo('')
    setComunas([])
    invalidarCotizacion()
  }

  const volverADireccionRegistrada = () => {
    aplicarDireccionRegistrada(direccionRegistrada)
  }

  useEffect(() => {
    setCargandoRegiones(true)

    obtenerRegionesDespacho()
        .then(({ data }) => {
          setRegiones(normalizarLista(data, 'regiones'))
        })
        .catch(() => {
          setErrorCotizacion('No se pudieron cargar las regiones de despacho.')
        })
        .finally(() => {
          setCargandoRegiones(false)
        })
  }, [])

  useEffect(() => {
    if (!usuarioPuedeComprar) {
      setDirecciones([])
      setDireccionRegistrada(null)
      setCargandoDirecciones(false)
      return
    }

    setCargandoDirecciones(true)

    obtenerMisDirecciones()
        .then(({ data }) => {
          const listaDirecciones = normalizarLista(data, 'direcciones')
              .map(normalizarDireccionEntrega)
              .filter(Boolean)

          setDirecciones(listaDirecciones)

          const principal = listaDirecciones.find(d => d.esPrincipal) || listaDirecciones[0] || null
          setDireccionRegistrada(principal)

          if (principal) {
            aplicarDireccionRegistrada(principal)
          }
        })
        .catch(() => {
          setDirecciones([])
          setDireccionRegistrada(null)
          setModoDireccion('alternativa')
        })
        .finally(() => {
          setCargandoDirecciones(false)
        })
  }, [aplicarDireccionRegistrada, usuarioPuedeComprar])

  useEffect(() => {
    if (!regionCodigo) {
      setComunas([])
      setComunaCodigo('')
      return
    }

    setCargandoComunas(true)

    obtenerComunasDespacho(regionCodigo)
        .then(({ data }) => {
          const comunasNormalizadas = deduplicarComunas(normalizarLista(data, 'comunas'))
          setComunas(comunasNormalizadas)
        })
        .catch(() => {
          setComunas([])
          setErrorCotizacion('No se pudieron cargar las comunas de despacho.')
        })
        .finally(() => {
          setCargandoComunas(false)
        })
  }, [regionCodigo])

  useEffect(() => {
    if (!usandoDireccionRegistrada) return
    if (!direccionRegistrada) return
    if (!regionCodigo) return
    if (comunaCodigo) return
    if (!comunas.length) return

    const comunaEncontrada = comunas.find(comuna =>
        comunaCoincideConDireccion(comuna, direccionRegistrada)
    )

    if (comunaEncontrada) {
      setComunaCodigo(String(obtenerIdComuna(comunaEncontrada)))
      invalidarCotizacion()
    }
  }, [
    comunas,
    comunaCodigo,
    direccionRegistrada,
    invalidarCotizacion,
    regionCodigo,
    usandoDireccionRegistrada,
  ])

  useEffect(() => {
    if (!usandoDireccionRegistrada) return
    if (!direccionRegistrada) return
    if (!regiones.length) return
    if (regionCodigo && comunaCodigo) return
    if (resolviendoDireccionRegistradaRef.current) return

    const resolverCoberturaDireccionRegistrada = async () => {
      resolviendoDireccionRegistradaRef.current = true

      try {
        if (direccionRegistrada.regionId) {
          setRegionCodigo(String(direccionRegistrada.regionId))
          return
        }

        for (const region of regiones) {
          const regionId = obtenerIdRegion(region)

          if (!regionId) continue

          try {
            const { data } = await obtenerComunasDespacho(regionId)
            const comunasRegion = deduplicarComunas(normalizarLista(data, 'comunas'))

            const comunaEncontrada = comunasRegion.find(comuna =>
                comunaCoincideConDireccion(comuna, direccionRegistrada)
            )

            if (comunaEncontrada) {
              setRegionCodigo(String(regionId))
              setComunaCodigo(String(obtenerIdComuna(comunaEncontrada)))
              setComunas(comunasRegion)
              invalidarCotizacion()
              return
            }
          } catch {
            // Sigue intentando con la siguiente region.
          }
        }
      } finally {
        resolviendoDireccionRegistradaRef.current = false
      }
    }

    resolverCoberturaDireccionRegistrada()
  }, [
    comunaCodigo,
    direccionRegistrada,
    invalidarCotizacion,
    regiones,
    regionCodigo,
    usandoDireccionRegistrada,
  ])

  const obtenerDetalleSucursal = useCallback(async (sucursalStock) => {
    try {
      const { data } = await obtenerSucursalDespacho(sucursalStock.sucursal_id)
      return normalizarSucursalDespacho(data, sucursalStock)
    } catch {
      return normalizarSucursalDespacho(null, sucursalStock)
    }
  }, [])

  const cotizarDireccionActual = useCallback(async () => {
    if (!direccion.trim()) {
      setErrorCotizacion('Ingresa una direccion de entrega para cotizar.')
      return
    }

    if (!regionCodigo || !comunaCodigo) {
      setErrorCotizacion('Selecciona region y comuna para cotizar.')
      return
    }

    if (!comunaSeleccionada) {
      setErrorCotizacion('No se encontro la comuna seleccionada.')
      return
    }

    if (!countyCodeDestino) {
      setErrorCotizacion('La comuna seleccionada no tiene codigo de cobertura Chilexpress para cotizar.')
      return
    }

    if (!productosCotizacion.length) {
      setErrorCotizacion('No hay productos en el carrito para cotizar el despacho.')
      return
    }

    if (stockParaCotizar.productosSinStock.length) {
      setErrorCotizacion(`No hay stock suficiente para: ${stockParaCotizar.productosSinStock.join(', ')}.`)
      return
    }

    if (!stockParaCotizar.sucursales.length) {
      setErrorCotizacion('No existe una sucursal que tenga stock suficiente para todos los productos del carrito.')
      return
    }

    setCotizando(true)
    setErrorCotizacion('')
    setDetalleCotizacion('')
    setCotizacion(null)
    setServicioSeleccionadoCodigo('')

    try {
      const resultados = []

      for (const sucursalStock of stockParaCotizar.sucursales) {
        const sucursalOrigen = await obtenerDetalleSucursal(sucursalStock)

        try {
          const payloadCotizacion = {
            sucursal_id: sucursalStock.sucursal_id,
            county_code_destino: countyCodeDestino,
            productos: productosCotizacion,
          }

          console.log('Payload cotizacion despacho:', payloadCotizacion)

          const { data } = await cotizarDespacho(payloadCotizacion)
          const cotizacionNormalizada = normalizarCotizacionChilexpress(data, sucursalOrigen)
          const servicios = obtenerServiciosDisponibles(cotizacionNormalizada)
          const servicioMasBarato = obtenerServicioMasBarato(servicios)

          if (servicioMasBarato) {
            resultados.push({
              cotizacion: cotizacionNormalizada,
              servicio: servicioMasBarato,
              costo: obtenerValorServicio(servicioMasBarato),
              sucursal: sucursalOrigen,
            })
          }
        } catch (err) {
          console.warn(
              `No se pudo cotizar con sucursal ${sucursalStock.sucursal_id}:`,
              err.response?.data || err
          )
        }
      }

      if (!resultados.length) {
        setErrorCotizacion('No se pudo obtener cotizacion desde ninguna sucursal con stock disponible.')
        return
      }

      const mejorResultado = resultados.sort((a, b) => a.costo - b.costo)[0]

      setCotizacion(mejorResultado.cotizacion)
      setServicioSeleccionadoCodigo(String(mejorResultado.servicio.serviceTypeCode))

      setDetalleCotizacion(
          `Mejor opción: ${mejorResultado.servicio.serviceDescription} (${formatPrecio(mejorResultado.costo)}) desde sucursal ${mejorResultado.sucursal.nombre}.`
      )
    } catch (err) {
      console.error('Error cotizando despacho:', err.response?.data || err)

      const detalle =
          err.response?.data?.detail
          || err.response?.data?.error
          || err.response?.data?.message
          || 'No se pudo obtener cotizacion de envio. Intenta nuevamente.'

      setErrorCotizacion(detalle)
    } finally {
      setCotizando(false)
    }
  }, [
    comunaCodigo,
    comunaSeleccionada,
    countyCodeDestino,
    direccion,
    obtenerDetalleSucursal,
    productosCotizacion,
    regionCodigo,
    stockParaCotizar,
  ])

  useEffect(() => {
    if (!usandoDireccionRegistrada) return
    if (!puedeCotizar) return
    if (cotizacion || cotizando) return

    const claveCotizacion = [
      modoDireccion,
      direccion,
      regionCodigo,
      comunaCodigo,
      countyCodeDestino,
      JSON.stringify(productosCotizacion),
      JSON.stringify(stockParaCotizar.sucursales.map(s => s.sucursal_id)),
    ].join('|')

    if (ultimaCotizacionAutomaticaRef.current === claveCotizacion) return

    ultimaCotizacionAutomaticaRef.current = claveCotizacion
    cotizarDireccionActual()
  }, [
    comunaCodigo,
    cotizacion,
    cotizando,
    cotizarDireccionActual,
    countyCodeDestino,
    direccion,
    modoDireccion,
    puedeCotizar,
    productosCotizacion,
    regionCodigo,
    stockParaCotizar.sucursales,
    usandoDireccionRegistrada,
  ])

  const obtenerDireccionEntregaIdParaPedido = async () => {
    if (usandoDireccionRegistrada && direccionRegistrada?.id) {
      return direccionRegistrada.id
    }

    if (!direccion.trim()) {
      throw new Error('La direccion de entrega es obligatoria.')
    }

    if (!comunaSeleccionada) {
      throw new Error('Debes seleccionar una comuna valida para guardar la direccion alternativa.')
    }

    const payloadDireccion = {
      direccion: direccion.trim(),
      num_direccion: '',
      detalle_direccion: '',
      comuna: obtenerIdComuna(comunaSeleccionada),
      referencia: notas || '',
      nombre_receptor: `${usuario?.first_name || ''} ${usuario?.last_name || ''}`.trim(),
      telefono_receptor: usuario?.telefono || '',
      es_principal: false,
    }

    console.log('Payload crear direccion alternativa:', payloadDireccion)

    const { data } = await crearDireccionEntrega(payloadDireccion)
    const direccionCreada = normalizarDireccionEntrega(data)

    if (!direccionCreada?.id) {
      throw new Error('No se pudo obtener el ID de la direccion alternativa creada.')
    }

    return direccionCreada.id
  }

  const handleConfirmar = async () => {
    if (!usuarioPuedeComprar) {
      setError(mensajeNoCompra)
      return
    }

    if (!direccion.trim()) {
      setError('La direccion de entrega es obligatoria.')
      return
    }

    if (!puedeCrearPedido) {
      setError(obtenerMotivoBloqueoPedido() || 'Debes completar los datos de entrega y cotizar el despacho antes de crear el pedido.')
      return
    }

    if (!cotizacion?.sucursal_origen?.id) {
      setError('Debes tener una sucursal de origen seleccionada desde la cotizacion.')
      return
    }

    if (!servicioSeleccionado) {
      setError('Debes seleccionar un servicio de despacho.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const direccionEntregaId = await obtenerDireccionEntregaIdParaPedido()

      const textoOrigen = obtenerTextoUbicacionSucursal(cotizacion?.sucursal_origen)
      const textoDestino = obtenerTextoDestino(comunaSeleccionada, regionSeleccionada)

      const payload = {
        sucursal_origen_id: cotizacion.sucursal_origen.id,
        direccion_entrega_id: direccionEntregaId,

        tipo_venta: 'WEBPAY',
        tipo_despacho: 'NORMAL',
        prioridad_medica: 'NORMAL',
        fecha_requerida_entrega: obtenerFechaRequeridaEntrega(),

        observacion: [
          notas,
          `Servicio despacho: ${obtenerDescripcionServicio(servicioSeleccionado)}`,
          `Codigo servicio: ${servicioSeleccionado?.serviceTypeCode || ''}`,
          `Delivery type: ${servicioSeleccionado?.deliveryType ?? ''}`,

        ].filter(Boolean).join(' | '),

        detalles: items.map(i => ({
          producto_id: i.producto.id,
          cantidad: i.cantidad,
        })),
      }

      console.log('Payload crear pedido:', payload)

      const { data } = await crearPedido(payload)

      // Persistir la cotización Chilexpress asociada al pedido recién creado.
      // El backend no guarda costo_envio, así que el frontend mantiene el detalle
      // para mostrar el desglose correcto en el resultado del pago y en Mis Pedidos.
      if (data?.id) {
        guardarCotizacionPedido(data.id, {
          costo: costoEnvio,
          servicio: obtenerDescripcionServicio(servicioSeleccionado),
          codigo: servicioSeleccionado?.serviceTypeCode ?? null,
          peso_kg: servicioSeleccionado?.finalWeight ?? null,
          delivery_type: servicioSeleccionado?.deliveryType ?? null,
          sucursal_origen: textoOrigen,
          destino: textoDestino,
          total_con_envio: total,
        })
      }

      vaciarCarrito()
      navigate(`/resultado-pago/${data.id}`)
    } catch (err) {
      console.error('Error creando pedido:', err.response?.data || err)

      const mensaje =
          err.message
          || obtenerMensajeErrorPedido(err.response?.data)

      setError(mensaje)
    } finally {
      setLoading(false)
    }
  }

  const handleCotizar = async () => {
    await cotizarDireccionActual()
  }

  const textoOrigen = obtenerTextoUbicacionSucursal(cotizacion?.sucursal_origen)
  const textoDestino = obtenerTextoDestino(comunaSeleccionada, regionSeleccionada)

  if (!usuarioPuedeComprar) {
    return (
      <div className="page-container">
        <h1 className="page-title">Confirmar Pedido</h1>
        <div className="card">
          <div className="alert alert-warning">{mensajeNoCompra}</div>
          <button className="btn btn-secondary mt-1" onClick={() => navigate('/carrito')}>
            Volver al carrito
          </button>
        </div>
      </div>
    )
  }

  return (
      <div className="page-container">
        <h1 className="page-title">Confirmar Pedido</h1>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="confirmar-layout">
          <div>
            <div className="card">
              <h3 className="section-title">Datos de entrega</h3>

              {cargandoDirecciones && (
                  <p className="text-muted" style={{ fontSize: '0.82rem', marginBottom: 12 }}>
                    Cargando direccion registrada...
                  </p>
              )}

              {usandoDireccionRegistrada && (
                  <div className="info-box" style={{ marginBottom: 12 }}>
                    <p style={{ marginBottom: 6 }}>
                      <strong>Usaremos tu direccion registrada para calcular el despacho.</strong>
                    </p>

                    <p style={{ marginBottom: 4 }}>
                      {direccionRegistrada.direccion}
                    </p>

                    {direccionRegistrada.referencia && (
                        <p className="text-muted" style={{ fontSize: '0.78rem', marginBottom: 4 }}>
                          Referencia: {direccionRegistrada.referencia}
                        </p>
                    )}

                    {direccionRegistrada.nombreReceptor && (
                        <p className="text-muted" style={{ fontSize: '0.78rem', marginBottom: 4 }}>
                          Recibe: {direccionRegistrada.nombreReceptor}
                        </p>
                    )}

                    {direccionRegistrada.telefonoReceptor && (
                        <p className="text-muted" style={{ fontSize: '0.78rem', marginBottom: 4 }}>
                          Telefono: {direccionRegistrada.telefonoReceptor}
                        </p>
                    )}

                    <button
                        className="btn btn-secondary"
                        onClick={activarDireccionAlternativa}
                        style={{ marginTop: 8 }}
                    >
                      Usar otra direccion de entrega
                    </button>
                  </div>
              )}

              {mostrarFormularioDireccion && (
                  <>
                    {tieneDireccionRegistrada && (
                        <button
                            className="btn btn-secondary"
                            onClick={volverADireccionRegistrada}
                            style={{ marginBottom: 12 }}
                        >
                          Volver a usar mi direccion registrada
                        </button>
                    )}

                    <div className="form-group">
                      <label>Direccion de entrega *</label>
                      <textarea
                          className="textarea-direccion"
                          rows={3}
                          value={direccion}
                          onChange={e => {
                            setDireccion(e.target.value)
                            invalidarCotizacion()
                          }}
                          placeholder="Ingresa la direccion completa"
                      />
                    </div>
                  </>
              )}

              <div className="form-group">
                <label>Notas para el pedido (opcional)</label>
                <textarea
                    className="textarea-notas"
                    rows={2}
                    value={notas}
                    onChange={e => setNotas(e.target.value)}
                    placeholder="Instrucciones especiales, referencias, etc."
                />
              </div>
            </div>

            <div className="card mt-2">
              <h3 className="section-title">
                Cotizar despacho
                <span
                    className="badge badge-info"
                    style={{ marginLeft: 8, fontSize: '0.7rem', verticalAlign: 'middle' }}
                >
                Requerido
              </span>
              </h3>

              <p className="text-muted" style={{ fontSize: '0.82rem', marginBottom: 12 }}>
                {usandoDireccionRegistrada
                    ? 'El despacho se cotizara automaticamente usando tu direccion registrada.'
                    : 'Selecciona cobertura desde MEDISTOCK. El envio cotizado se suma al total a pagar.'}
              </p>

              {!usandoDireccionRegistrada && (
                  <div className="cotizar-grid">
                    <div className="form-group">
                      <label>Region *</label>
                      <select
                          value={regionCodigo}
                          onChange={e => {
                            setRegionCodigo(e.target.value)
                            setComunaCodigo('')
                            invalidarCotizacion()
                          }}
                          disabled={cargandoRegiones}
                      >
                        <option value="">
                          {cargandoRegiones ? 'Cargando regiones...' : 'Selecciona region'}
                        </option>

                        {regiones.map(region => {
                          const regionId = obtenerIdRegion(region)
                          return (
                              <option key={regionId} value={regionId}>
                                {obtenerNombreRegion(region)}
                              </option>
                          )
                        })}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Comuna *</label>
                      <select
                          value={comunaCodigo}
                          onChange={e => {
                            setComunaCodigo(e.target.value)
                            invalidarCotizacion()
                          }}
                          disabled={!regionCodigo || cargandoComunas}
                      >
                        <option value="">
                          {cargandoComunas ? 'Cargando comunas...' : 'Selecciona comuna'}
                        </option>

                        {comunas.map(comuna => (
                            <option key={obtenerIdComuna(comuna)} value={obtenerIdComuna(comuna)}>
                              {comuna.nombre}
                            </option>
                        ))}
                      </select>
                    </div>
                  </div>
              )}

              {usandoDireccionRegistrada && (
                  <div className="info-box" style={{ marginBottom: 12 }}>
                    <p style={{ marginBottom: 4 }}>
                      <strong>Direccion seleccionada:</strong> Direccion registrada
                    </p>

                    <p className="text-muted" style={{ fontSize: '0.78rem', marginBottom: 4 }}>
                      {direccion}
                    </p>

                    {regionSeleccionada && comunaSeleccionada && (
                        <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                          Destino: {textoDestino}
                          {countyCodeDestino ? ` (${countyCodeDestino})` : ' - Sin codigo Chilexpress'}
                        </p>
                    )}

                    {!regionSeleccionada && !comunaSeleccionada && (
                        <p className="text-muted" style={{ fontSize: '0.78rem', marginBottom: 0 }}>
                          Buscando cobertura asociada a tu direccion registrada...
                        </p>
                    )}
                  </div>
              )}

              {regionSeleccionada && comunaSeleccionada && !usandoDireccionRegistrada && (
                  <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                    Destino: {textoDestino}
                    {countyCodeDestino ? ` (${countyCodeDestino})` : ' - Sin codigo Chilexpress'}
                  </p>
              )}

              {stockParaCotizar.sucursales.length > 0 && (
                  <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                    Sucursales con stock suficiente: {stockParaCotizar.sucursales.map(s => s.sucursal_nombre).join(', ')}
                  </p>
              )}

              {stockParaCotizar.productosSinStock.length > 0 && (
                  <div className="alert alert-error" style={{ marginTop: 10, fontSize: '0.82rem' }}>
                    Sin stock suficiente para: {stockParaCotizar.productosSinStock.join(', ')}.
                  </div>
              )}

              <button
                  className="btn btn-secondary"
                  onClick={handleCotizar}
                  disabled={!puedeCotizar}
                  style={{ marginTop: 4 }}
              >
                {cotizando
                    ? 'Buscando envio mas barato...'
                    : usandoDireccionRegistrada
                        ? 'Reintentar cotizacion'
                        : 'Cotizar despacho'}
              </button>

              {detalleCotizacion && (
                  <div className="alert alert-success" style={{ marginTop: 10, fontSize: '0.82rem' }}>
                    {detalleCotizacion}
                  </div>
              )}

              {errorCotizacion && (
                  <div className="alert alert-error" style={{ marginTop: 10, fontSize: '0.82rem' }}>
                    {errorCotizacion}
                  </div>
              )}

              {cotizacion && (
                  <div className="cotizacion-resultado">
                    <div className="cotizacion-fila">
                      <span>Courier</span>
                      <strong>{cotizacion.courier}</strong>
                    </div>

                    <div className="cotizacion-fila">
                      <span>Origen</span>
                      <span>{textoOrigen}</span>
                    </div>

                    <div className="cotizacion-fila">
                      <span>Destino</span>
                      <span>{textoDestino}</span>
                    </div>

                    <div className="cotizacion-fila">
                      <span>Cajas</span>
                      <span>{cotizacion.num_cajas || 1}</span>
                    </div>

                    {serviciosDisponibles.length > 1 && (
                        <div className="form-group" style={{ marginTop: 12 }}>
                          <label>Servicio de despacho *</label>
                          <select
                              value={servicioSeleccionadoCodigo}
                              onChange={e => setServicioSeleccionadoCodigo(e.target.value)}
                          >
                            {serviciosDisponibles.map(servicio => (
                                <option
                                    key={servicio.serviceTypeCode}
                                    value={servicio.serviceTypeCode}
                                >
                                  {obtenerDescripcionServicio(servicio)} - {formatPrecio(obtenerValorServicio(servicio))}
                                </option>
                            ))}
                          </select>
                          <p className="text-muted" style={{ fontSize: '0.72rem', marginTop: 4 }}>
                            Se selecciono automaticamente el servicio mas barato de la sucursal con menor costo.
                          </p>
                        </div>
                    )}

                    {servicioSeleccionado && (
                        <>
                          <div className="cotizacion-fila">
                            <span>Servicio</span>
                            <strong>{obtenerDescripcionServicio(servicioSeleccionado)}</strong>
                          </div>

                          <div className="cotizacion-fila">
                            <span>Codigo servicio</span>
                            <span>{servicioSeleccionado.serviceTypeCode}</span>
                          </div>

                          <div className="cotizacion-fila">
                            <span>Peso final</span>
                            <span>{servicioSeleccionado.finalWeight} kg</span>
                          </div>

                          <div className="cotizacion-fila">
                            <span>Costo de envio</span>
                            <strong style={{ color: 'var(--color-primary)' }}>
                              {formatPrecio(obtenerValorServicio(servicioSeleccionado))}
                            </strong>
                          </div>
                        </>
                    )}
                  </div>
              )}
            </div>

            <div className="card mt-2">
              <h3 className="section-title">Productos ({items.length})</h3>

              {items.map(({ producto, cantidad }) => {
                const precio = obtenerPrecioProducto(producto, esB2B)

                return (
                    <div key={producto.id} className="confirmar-item">
                      <span className="confirmar-nombre">{producto.nombre}</span>
                      <span className="text-muted">x{cantidad}</span>
                      <span className="confirmar-precio">
                    {formatPrecio(parseFloat(precio) * cantidad)}
                  </span>
                    </div>
                )
              })}
            </div>
          </div>

          <div className="card confirmar-resumen">
            <h3 className="section-title">Resumen</h3>

            <div className="resumen-row">
              <span>Subtotal productos</span>
              <span>{formatPrecio(subtotal)}</span>
            </div>

            {esB2B && (
                <div className="resumen-row" style={{ color: 'var(--color-success)' }}>
                  <span>Descuento B2B (10%)</span>
                  <span>- {formatPrecio(descuento)}</span>
                </div>
            )}

            {servicioSeleccionado && (
                <div className="resumen-row" style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>
                  <span>Envio ({obtenerDescripcionServicio(servicioSeleccionado)})</span>
                  <span>{formatPrecio(costoEnvio)}</span>
                </div>
            )}

            <hr className="divider" />

            <div className="resumen-row resumen-total">
              <span>Total a pagar</span>
              <span>{formatPrecio(total)}</span>
            </div>

            {servicioSeleccionado && (
                <p className="text-muted" style={{ fontSize: '0.72rem', marginTop: 4 }}>
                  * El costo de envio seleccionado se incluye en el total del pedido y sera cobrado en el pago.
                </p>
            )}

            <div className="info-box mt-2">
              <p>
                <strong>Tipo de cliente:</strong> {esB2B ? 'Institucional (B2B)' : 'Particular (B2C)'}
              </p>

              <p>
                <strong>Usuario:</strong> {usuario?.first_name} {usuario?.last_name}
              </p>

              {usandoDireccionRegistrada && (
                  <p><strong>Entrega:</strong> Direccion registrada</p>
              )}

              {!usandoDireccionRegistrada && (
                  <p><strong>Entrega:</strong> Direccion alternativa</p>
              )}

              {cotizacion?.sucursal_origen && (
                  <p>
                    <strong>Sucursal origen:</strong> {textoOrigen}
                  </p>
              )}

              {servicioSeleccionado && (
                  <p>
                    <strong>Servicio:</strong> {obtenerDescripcionServicio(servicioSeleccionado)}
                  </p>
              )}
            </div>

            <button
                className="btn btn-primary btn-block btn-lg mt-2"
                onClick={handleConfirmar}
                disabled={loading || items.length === 0}
            >
              {loading ? 'Creando pedido...' : 'Crear pedido y pagar ->'}
            </button>

            <button
                className="btn btn-secondary btn-block mt-1"
                onClick={() => navigate('/carrito')}
            >
              Volver al carrito
            </button>
          </div>
        </div>
      </div>
  )
}
