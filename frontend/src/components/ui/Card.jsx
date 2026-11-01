export default function Card({ 
  children, 
  className = '', 
  padding = 'md',
  hover = false,
  bordered = true,
  gradient = false
}) {
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-10',
  }

  const baseClasses = 'bg-white rounded-2xl transition-all duration-300'
  const borderClass = bordered ? 'border border-gray-100' : ''
  const hoverClass = hover ? 'hover:shadow-2xl hover:-translate-y-1' : 'shadow-lg'
  const gradientClass = gradient ? 'bg-gradient-to-br from-white to-gray-50' : ''

  return (
    <div className={`${baseClasses} ${borderClass} ${hoverClass} ${gradientClass} ${paddings[padding]} ${className}`}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '', bordered = false }) {
  return (
    <div className={`${bordered ? 'border-b border-gray-100 pb-4 mb-4' : ''} ${className}`}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '' }) {
  return (
    <h3 className={`text-xl font-bold text-gray-800 ${className}`}>
      {children}
    </h3>
  )
}

export function CardBody({ children, className = '' }) {
  return (
    <div className={className}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className = '', bordered = false }) {
  return (
    <div className={`${bordered ? 'border-t border-gray-100 pt-4 mt-4' : ''} ${className}`}>
      {children}
    </div>
  )
}