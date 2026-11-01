const variants = {
  success: 'bg-green-100 text-green-700 border-green-200',
  warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  danger: 'bg-red-100 text-red-700 border-red-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
  primary: 'bg-green-100 text-green-700 border-green-200',
  secondary: 'bg-gray-100 text-gray-700 border-gray-200',
  orange: 'bg-orange-100 text-orange-700 border-orange-200',
}

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
}

export default function Badge({ 
  children, 
  variant = 'primary', 
  size = 'md',
  className = '',
  dot = false,
  rounded = 'full'
}) {
  const roundedClasses = {
    none: '',
    md: 'rounded-lg',
    full: 'rounded-full',
  }

  return (
    <span className={`inline-flex items-center font-medium border ${variants[variant]} ${sizes[size]} ${roundedClasses[rounded]} ${className}`}>
      {dot && (
        <span className={`w-2 h-2 rounded-full mr-1.5 ${
          variant === 'success' ? 'bg-green-500' :
          variant === 'warning' ? 'bg-yellow-500' :
          variant === 'danger' ? 'bg-red-500' :
          variant === 'info' ? 'bg-blue-500' :
          variant === 'orange' ? 'bg-orange-500' : 'bg-green-500'
        }`} />
      )}
      {children}
    </span>
  )
}