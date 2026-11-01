import Button from './Button'

export default function EmptyState({ 
  title = 'No data found',
  description = 'There are no items to display at this time.',
  icon = '📭',
  actionLabel,
  actionTo,
  onAction,
  className = ''
}) {
  return (
    <div className={`text-center py-16 px-4 ${className}`}>
      <div className="text-6xl mb-4 opacity-50">{icon}</div>
      <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
      <p className="text-gray-500 mb-6 max-w-md mx-auto">{description}</p>
      {actionLabel && (actionTo || onAction) && (
        <Button 
          to={actionTo} 
          onClick={onAction}
          variant="primary"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  )
}