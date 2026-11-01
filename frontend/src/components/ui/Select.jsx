import { forwardRef } from 'react'

const Select = forwardRef(({ 
  label,
  error,
  options = [],
  className = '',
  placeholder = 'Select an option',
  ...props 
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          className={`
            w-full px-4 py-2.5 pr-10
            border border-gray-200 rounded-xl
            focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
            transition-all duration-200
            bg-white hover:border-gray-300
            appearance-none cursor-pointer
            ${error ? 'border-red-300 focus:ring-red-500' : ''}
            ${className}
          `}
          {...props}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          ▼
        </span>
      </div>
      {error && (
        <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  )
})

Select.displayName = 'Select'

export default Select