import './EmptyState.css'

/**
 * Estado vacío reusable para tablas, listados o secciones sin datos.
 *
 * Props:
 *   - icon:        emoji o nodo a mostrar arriba (default: 📭)
 *   - titulo:      heading principal
 *   - descripcion: párrafo explicativo
 *   - accion:      botón o link opcional para invitar a una siguiente acción
 *   - compact:     versión más pequeña (para usar dentro de tabs/cards)
 */
export default function EmptyState({
  icon = '📭',
  titulo,
  descripcion,
  accion,
  compact = false,
}) {
  return (
    <div className={`ui-empty-state ${compact ? 'ui-empty-state-compact' : ''}`}>
      {icon && <div className="ui-empty-state-icon" aria-hidden="true">{icon}</div>}
      {titulo && <h3>{titulo}</h3>}
      {descripcion && <p className="text-muted">{descripcion}</p>}
      {accion && <div className="ui-empty-state-action">{accion}</div>}
    </div>
  )
}
