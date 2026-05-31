import EmptyState from './EmptyState'

/**
 * Tabla declarativa reusable.
 *
 * Props:
 *   columnas: [{ key, header, render?(item), align? }]
 *   datos:    array de items
 *   rowKey:   función (item, idx) => key   (default: item.id || idx)
 *   empty:    { icon, titulo, descripcion, accion }
 *   className: clases extra para el contenedor scrollable
 *
 * Devuelve una tabla con la clase global .data-table (definida en PanelPage.css)
 * envuelta en .tabla-container para overflow horizontal.
 */
export default function DataTable({
  columnas = [],
  datos = [],
  rowKey,
  empty,
  className = '',
}) {
  if (!datos.length) {
    return <EmptyState compact {...(empty || { titulo: 'Sin datos para mostrar' })} />
  }

  const obtenerKey = rowKey || ((item, idx) => item?.id ?? idx)

  return (
    <div className={`tabla-container ${className}`.trim()}>
      <table className="data-table">
        <thead>
          <tr>
            {columnas.map((col) => (
              <th key={col.key} style={col.align ? { textAlign: col.align } : undefined}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {datos.map((item, idx) => (
            <tr key={obtenerKey(item, idx)}>
              {columnas.map((col) => (
                <td key={col.key} style={col.align ? { textAlign: col.align } : undefined}>
                  {col.render ? col.render(item, idx) : (item?.[col.key] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
