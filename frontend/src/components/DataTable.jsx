import { useState, useMemo, useRef } from 'react'
import ReactPaginate from 'react-paginate'
import Papa from 'papaparse'
import { Button, Input, Select, Card } from './ui'
import { ChevronLeft, ChevronRight, Grid, List, Download, Printer, Search, X } from 'lucide-react'

export default function DataTable({
  columns,
  data,
  loading,
  title,
  actions,
  searchable = true,
  exportable = true,
  pageSizeOptions = [5, 10, 20, 50],
  defaultPageSize = 5,
  gridView = false,
  onRowClick,
  showSerialNumber = true,
  emptyState = {
    icon: '📭',
    title: 'No data found',
    description: 'There are no items to display.'
  }
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [viewMode, setViewMode] = useState(gridView ? 'grid' : 'table')
  const [columnFilters, setColumnFilters] = useState({})
  const tableRef = useRef(null)

  // Filter data based on search and column filters
  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Global search
      if (searchTerm) {
        const matchesSearch = columns.some(col => {
          const value = col.accessor ? col.accessor(item) : item[col.key]
          return String(value).toLowerCase().includes(searchTerm.toLowerCase())
        })
        if (!matchesSearch) return false
      }

      // Column filters
      for (const [key, filterValue] of Object.entries(columnFilters)) {
        if (!filterValue) continue
        const col = columns.find(c => c.key === key)
        const value = col?.accessor ? col.accessor(item) : item[key]
        if (!String(value).toLowerCase().includes(filterValue.toLowerCase())) return false
      }

      return true
    })
  }, [data, searchTerm, columnFilters, columns])

  // Pagination
  const pageCount = Math.ceil(filteredData.length / pageSize)
  const paginatedData = filteredData.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  )

  const handlePageChange = ({ selected }) => setCurrentPage(selected)

  // Export: only visible columns (no actions)
  const exportColumns = showSerialNumber 
    ? [{ key: 'sn', header: 'S/N', accessor: (_, idx) => idx + 1 }, ...columns]
    : columns

  const getExportData = () => {
    return filteredData.map((item, index) => {
      const row = {}
      exportColumns.forEach(col => {
        const value = col.accessor 
          ? col.accessor(item, index + (currentPage * pageSize))
          : item[col.key]
        row[col.header] = value
      })
      return row
    })
  }

  const handleExportCSV = () => {
    const exportData = getExportData()
    const csv = Papa.unparse(exportData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${title || 'export'}.csv`
    link.click()
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    const tableHtml = tableRef.current?.cloneNode(true)
    // Remove actions column from print
    if (tableHtml) {
      const rows = tableHtml.querySelectorAll('tr')
      rows.forEach(row => {
        const lastCell = row.lastElementChild
        if (lastCell && lastCell.textContent.includes('Actions')) {
          lastCell.remove()
        } else if (row.cells.length > exportColumns.length) {
          // Remove extra cells (actions)
          for (let i = exportColumns.length; i < row.cells.length; i++) {
            row.deleteCell(-1)
          }
        }
      })
    }
    printWindow.document.write(`
      <html>
        <head><title>${title || 'Print'}</title>
        <style>
          body { font-family: sans-serif; margin: 20px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f5f5f5; }
        </style>
        </head>
        <body>${tableHtml?.outerHTML || ''}</body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const handleExportPDF = () => {
    // Use browser print to save as PDF
    handlePrint()
  }

  const clearAllFilters = () => {
    setSearchTerm('')
    setColumnFilters({})
  }

  const hasActiveFilters = searchTerm || Object.values(columnFilters).some(v => v)

  // Add serial number to columns if enabled
  const displayColumns = showSerialNumber 
    ? [{ key: 'sn', header: 'S/N', render: (_, idx) => <span className="text-gray-500 text-sm">{idx + 1 + (currentPage * pageSize)}</span> }, ...columns]
    : columns

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {searchable && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
              />
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          {hasActiveFilters && (
            <span className="text-sm text-gray-500">{filteredData.length} results</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 ${viewMode === 'table' ? 'bg-green-100 text-green-700' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              title="Table view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-green-100 text-green-700' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              title="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>

          {/* Export buttons */}
          {exportable && (
            <>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-1" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                <Printer className="w-4 h-4 mr-1" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-1" /> Print
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Column Filters */}
      {columns.some(col => col.filterable) && (
        <div className="flex flex-wrap gap-2">
          {columns.filter(col => col.filterable).map(col => (
            <Input
              key={col.key}
              placeholder={`Filter ${col.header}`}
              value={columnFilters[col.key] || ''}
              onChange={(e) => setColumnFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
              className="w-40 text-sm"
            />
          ))}
        </div>
      )}

      {/* Table/Grid View */}
      {filteredData.length === 0 ? (
        <Card padding="lg" className="text-center py-16">
          <div className="text-5xl mb-4">{emptyState.icon}</div>
          <h3 className="text-lg font-bold text-gray-800">{emptyState.title}</h3>
          <p className="text-gray-500">{emptyState.description}</p>
        </Card>
      ) : viewMode === 'table' ? (
        <div className="overflow-x-auto border border-gray-200 rounded-xl" ref={tableRef}>
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {displayColumns.map(col => (
                  <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {col.header}
                  </th>
                ))}
                {actions && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedData.map((item, idx) => (
                <tr
                  key={item.id || idx}
                  className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onRowClick?.(item)}
                >
                  {displayColumns.map(col => (
                    <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {col.render ? col.render(item, idx) : (col.accessor ? col.accessor(item, idx) : item[col.key])}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {actions(item)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedData.map((item, idx) => (
            <Card key={item.id || idx} padding="md" hover className="cursor-pointer" onClick={() => onRowClick?.(item)}>
              <div className="space-y-2">
                {showSerialNumber && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">S/N:</span>
                    <span className="text-sm font-medium text-gray-800">{idx + 1 + (currentPage * pageSize)}</span>
                  </div>
                )}
                {columns.slice(0, 4).map(col => (
                  <div key={col.key} className="flex justify-between">
                    <span className="text-sm text-gray-500">{col.header}:</span>
                    <span className="text-sm font-medium text-gray-800">
                      {col.render ? col.render(item, idx) : (col.accessor ? col.accessor(item, idx) : item[col.key])}
                    </span>
                  </div>
                ))}
                {actions && <div className="pt-2 border-t">{actions(item)}</div>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Rows per page:</span>
          <Select
            value={String(pageSize)}
            onChange={(e) => setPageSize(Number(e.target.value))}
            options={pageSizeOptions.map(n => ({ value: String(n), label: String(n) }))}
            className="w-20"
          />
          <span className="text-sm text-gray-500 ml-2">
            Showing {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, filteredData.length)} of {filteredData.length}
          </span>
        </div>
        <ReactPaginate
          previousLabel={<ChevronLeft className="w-4 h-4" />}
          nextLabel={<ChevronRight className="w-4 h-4" />}
          breakLabel="..."
          pageCount={pageCount}
          marginPagesDisplayed={2}
          pageRangeDisplayed={3}
          onPageChange={handlePageChange}
          forcePage={currentPage}
          containerClassName="flex items-center gap-1"
          pageClassName="px-3 py-1 rounded-lg hover:bg-gray-100"
          activeClassName="bg-green-600 text-white hover:bg-green-700"
          previousClassName="p-1 rounded-lg hover:bg-gray-100"
          nextClassName="p-1 rounded-lg hover:bg-gray-100"
          disabledClassName="opacity-50 cursor-not-allowed"
        />
      </div>
    </div>
  )
}