/**
 * Capa cosmética sobre el catálogo del backend.
 *
 * El backend devuelve productos con SKU tipo "SKU-TEST-N" y nombres genéricos.
 * Acá los enriquecemos en frontend con nombres reales (Paracetamol, etc.),
 * miligramaje y descripciones clínicas, sin tocar la base de datos.
 *
 * Si el backend luego expone los nombres reales en `nombre` o `descripcion`,
 * basta con borrar el mapeo correspondiente para que vuelva a usar la BD.
 */

const ENRIQUECIMIENTO = {
  // ---------- MEDICAMENTOS (categoria_test_1 a _4) ----------
  'SKU-TEST-1':  { nombre: 'Paracetamol',     dosis: '500mg',  tipo: 'Medicamento · Analgésico', uso: 'Analgésico y antipirético básico. Alivio de dolor leve a moderado y fiebre.' },
  'SKU-TEST-2':  { nombre: 'Ibuprofeno',      dosis: '400mg',  tipo: 'Medicamento · AINE',       uso: 'Antiinflamatorio no esteroidal (AINE) para dolor, fiebre e inflamación.' },
  'SKU-TEST-3':  { nombre: 'Amoxicilina',     dosis: '500mg',  tipo: 'Medicamento · Antibiótico', uso: 'Antibiótico de amplio espectro para infecciones bacterianas comunes.' },
  'SKU-TEST-4':  { nombre: 'Loratadina',      dosis: '10mg',   tipo: 'Medicamento · Antihistamínico', uso: 'Antihistamínico de segunda generación para alergias estacionales.' },
  'SKU-TEST-11': { nombre: 'Omeprazol',       dosis: '20mg',   tipo: 'Medicamento · IBP',         uso: 'Protector gástrico y antiácido. Inhibidor de bomba de protones.' },
  'SKU-TEST-12': { nombre: 'Losartán',        dosis: '50mg',   tipo: 'Medicamento · Antihipertensivo', uso: 'Control de presión arterial. Antagonista del receptor de angiotensina II.' },
  'SKU-TEST-13': { nombre: 'Metformina',      dosis: '850mg',  tipo: 'Medicamento · Antidiabético', uso: 'Control de glucosa en sangre. Tratamiento de diabetes tipo 2.' },
  'SKU-TEST-14': { nombre: 'Aspirina',        dosis: '100mg',  tipo: 'Medicamento · Antiagregante', uso: 'Prevención cardiovascular. Dosis baja para profilaxis antiagregante.' },
  'SKU-TEST-21': { nombre: 'Cetirizina',      dosis: '10mg',   tipo: 'Medicamento · Antihistamínico', uso: 'Antialérgico de acción rápida para rinitis y urticaria.' },
  'SKU-TEST-22': { nombre: 'Diclofenaco',     dosis: '50mg',   tipo: 'Medicamento · AINE',         uso: 'Antiinflamatorio para dolor muscular, articular y posquirúrgico.' },
  'SKU-TEST-23': { nombre: 'Naproxeno',       dosis: '250mg',  tipo: 'Medicamento · AINE',         uso: 'Analgésico para dolor articular, menstrual y traumatismos leves.' },
  'SKU-TEST-24': { nombre: 'Azitromicina',    dosis: '500mg',  tipo: 'Medicamento · Antibiótico',  uso: 'Antibiótico macrólido para infecciones de vías respiratorias.' },

  // ---------- INSUMOS MÉDICOS (categoria_test_5 a _8) ----------
  'SKU-TEST-5':  { nombre: 'Termómetro digital',     tipo: 'Insumo Médico · Diagnóstico',     uso: 'Medición rápida y precisa de temperatura corporal.' },
  'SKU-TEST-6':  { nombre: 'Tensiómetro digital',    tipo: 'Insumo Médico · Diagnóstico',     uso: 'Monitor automático de presión arterial para uso clínico y domiciliario.' },
  'SKU-TEST-7':  { nombre: 'Oxímetro de pulso',      tipo: 'Insumo Médico · Diagnóstico',     uso: 'Mide saturación de oxígeno (SpO₂) y frecuencia cardíaca en segundos.' },
  'SKU-TEST-8':  { nombre: 'Jeringas 5ml',           tipo: 'Insumo Médico · Aplicación',      uso: 'Jeringa estéril desechable para administración de inyectables.' },
  'SKU-TEST-15': { nombre: 'Agujas 21G',             tipo: 'Insumo Médico · Aplicación',      uso: 'Agujas hipodérmicas calibre 21G para inyección intramuscular.' },
  'SKU-TEST-16': { nombre: 'Gasas estériles',        tipo: 'Insumo Médico · Curación',        uso: 'Gasas estériles para limpieza y cobertura de heridas.' },
  'SKU-TEST-17': { nombre: 'Vendas elásticas',       tipo: 'Insumo Médico · Soporte',         uso: 'Soporte y compresión articular post-trauma o cirugía.' },
  'SKU-TEST-18': { nombre: 'Cinta Micropore',        tipo: 'Insumo Médico · Curación',        uso: 'Cinta adhesiva transpirable para fijación de apósitos.' },

  // ---------- BIENESTAR (categoria_test_9 a _10) ----------
  'SKU-TEST-9':  { nombre: 'Zinc Picolinato',        tipo: 'Bienestar · Suplemento',          uso: 'Apoyo al sistema inmune. Forma de alta biodisponibilidad de zinc.' },
  'SKU-TEST-10': { nombre: 'Magnesio Citrato',       tipo: 'Bienestar · Suplemento',          uso: 'Relajación muscular y mejora de la calidad del sueño.' },
  'SKU-TEST-19': { nombre: 'Omega 3',                tipo: 'Bienestar · Suplemento',          uso: 'Ácidos grasos esenciales para salud cardiovascular y cognitiva.' },
  'SKU-TEST-20': { nombre: 'Vitamina D3',            tipo: 'Bienestar · Suplemento',          uso: 'Soporte óseo y metabólico. Colecalciferol en alta absorción.' },
}

/**
 * Devuelve los datos enriquecidos para un SKU dado, o null si no hay mapeo.
 */
export function obtenerEnriquecimiento(sku) {
  if (!sku) return null
  return ENRIQUECIMIENTO[String(sku).toUpperCase()] || null
}

/**
 * Aplica el enriquecimiento sobre un objeto producto normalizado.
 * Si no hay mapeo, retorna el producto sin cambios.
 */
export function enriquecerProducto(producto = {}) {
  const data = obtenerEnriquecimiento(producto.codigo || producto.sku)
  if (!data) return producto

  const nombreCompleto = data.dosis ? `${data.nombre} ${data.dosis}` : data.nombre
  return {
    ...producto,
    nombre: nombreCompleto,
    descripcion: data.uso,
    tipo_producto: data.tipo,
    detalle_uso: data.uso,
    dosis: data.dosis || null,
  }
}

/**
 * Devuelve el nombre enriquecido (con dosis si aplica) para un SKU dado.
 * Útil para vistas que solo necesitan el nombre, como tablas de inventario.
 * Si no hay mapeo, devuelve el nombre original.
 */
export function nombreEnriquecido(sku, nombreOriginal = '') {
  const data = obtenerEnriquecimiento(sku)
  if (!data) return nombreOriginal
  return data.dosis ? `${data.nombre} ${data.dosis}` : data.nombre
}
