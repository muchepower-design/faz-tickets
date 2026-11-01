import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import QRCode from 'react-qr-code'
import { useAuth } from '../context/AuthContext'
import MainLayout from '../layouts/MainLayout'
import { Button, Card, Badge, Spinner, Alert } from '../components/ui'
import toast from 'react-hot-toast'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'


/* =====================================================================
 * Helpers
 * ===================================================================== */

function resolveImageUrl(url) {
  if (!url) return null
  if (/^(https?:|data:|blob:)/i.test(url)) return url
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`
}

/**
 * Fetch an image and trigger a browser download.
 * Using fetch+blob avoids the cross-origin "opens in tab" problem
 * that a plain <a download> has when the image lives on another host.
 */
async function downloadImage(url, filename) {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename || 'ticket.png'
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Give the browser a tick to start the download before revoking
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500)
    return true
  } catch (err) {
    console.error('Download failed:', err)
    return false
  }
}

/**
 * Build a standalone HTML document for the print popup.
 * Contains ONLY the tickets passed in, so a single-ticket print
 * shows one ticket and Print All shows every ticket, one per page.
 */
function buildPrintHtml(tickets, title) {
  const ticketsHtml = tickets.map((t, i) => {
    const imgUrl = resolveImageUrl(t.image_url)
    const body = imgUrl
      ? `<img class="ticket-img" src="${imgUrl}" alt="Ticket #${i + 1}" />`
      : `<div class="no-image">
           <div class="no-image-label">Ticket Number</div>
           <div class="no-image-value">${t.ticket_number || '—'}</div>
         </div>`
    return `
      <div class="ticket">
        <div class="ticket-header">
          <span class="ticket-title">Ticket #${i + 1}${t.ticket_type ? ` — ${t.ticket_type}` : ''}</span>
          ${t.ticket_number ? `<span class="ticket-no">${t.ticket_number}</span>` : ''}
        </div>
        ${body}
      </div>
    `
  }).join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      margin: 0; padding: 24px; color: #111;
    }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
    .ticket {
      page-break-after: always;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 16px;
      max-width: 680px;
      margin: 0 auto 20px;
    }
    .ticket:last-child { page-break-after: auto; }
    .ticket-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 12px; gap: 12px;
    }
    .ticket-title { font-weight: 600; font-size: 14px; }
    .ticket-no {
      font-family: ui-monospace, monospace; font-size: 11px;
      color: #555; word-break: break-all;
    }
    .ticket-img { width: 100%; display: block; border-radius: 6px; }
    .no-image {
      padding: 28px; text-align: center; color: #666;
      border: 1px dashed #ccc; border-radius: 6px;
    }
    .no-image-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
    .no-image-value { font-family: ui-monospace, monospace; font-size: 14px; word-break: break-all; }
    @media print {
      body { padding: 0; }
      .ticket { border: none; box-shadow: none; margin-bottom: 0; }
      .no-image { border-color: #999; }
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">Generated: ${new Date().toLocaleString()}</div>
  ${ticketsHtml}
  <script>
    (function () {
      const imgs = Array.from(document.images);
      let pending = imgs.length;
      const done = () => {
        pending -= 1;
        if (pending <= 0) {
          window.focus();
          setTimeout(() => window.print(), 200);
        }
      };
      if (pending === 0) { window.focus(); window.print(); return; }
      imgs.forEach(img => {
        if (img.complete) done();
        else {
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        }
      });
    })();
  </script>
</body>
</html>`
}

function openPrintWindow(html) {
  const w = window.open('', '_blank', 'width=900,height=1000')
  if (!w) {
    toast.error('Please allow popups to print tickets')
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
}


/* =====================================================================
 * Image viewer modal
 * ===================================================================== */

function TicketImageViewer({ ticket, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  const url = resolveImageUrl(ticket.image_url)
  if (!url) return null

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Ticket preview"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl font-bold flex items-center justify-center"
      >
        ×
      </button>

      <img
        src={url}
        alt="Ticket"
        className="max-w-full max-h-full object-contain rounded shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-xs bg-black/50 px-3 py-1.5 rounded-full">
        Press Esc or click outside to close
      </div>
    </div>
  )
}


/* =====================================================================
 * Single ticket card
 * ===================================================================== */

function TicketDisplay({ ticket, idx, onView, onDownload, onPrint, busy }) {
  const [imageFailed, setImageFailed] = useState(false)
  const url = resolveImageUrl(ticket.image_url)
  const showImage = url && !imageFailed

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
        <p className="font-semibold">
          Ticket #{idx + 1}
          {ticket.ticket_type ? ` — ${ticket.ticket_type}` : ''}
        </p>

        <div className="flex items-center gap-2">
          {showImage && (
            <>
              <button
                type="button"
                onClick={() => onView(ticket)}
                className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-gray-700"
              >
                View
              </button>
              <button
                type="button"
                onClick={() => onDownload(ticket, idx)}
                disabled={busy}
                className="text-sm px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
              >
                Download
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onPrint(ticket, idx)}
            className="text-sm px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-900 text-white"
          >
            Print
          </button>
        </div>
      </div>

      {showImage ? (
        <img
          src={url}
          alt={`Ticket ${idx + 1}`}
          className="w-full rounded-md shadow-sm cursor-zoom-in"
          onClick={() => onView(ticket)}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="flex justify-between items-center gap-4 p-4 bg-gray-50 rounded">
          <div>
            <p className="text-sm text-gray-500">Ticket number</p>
            <p className="font-mono text-sm break-all">{ticket.ticket_number}</p>
          </div>
          <div className="bg-white p-2 border rounded">
            <QRCode value={ticket.ticket_number || ''} size={110} />
          </div>
        </div>
      )}

      <div className="mt-3 text-xs text-gray-500">
        No: <span className="font-mono">{ticket.ticket_number}</span>
      </div>
    </div>
  )
}


/* =====================================================================
 * Page
 * ===================================================================== */

export default function OrderConfirmationPage() {
  const { orderNumber } = useParams()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState(null)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const { api } = useAuth()

  useEffect(() => {
    let cancelled = false
    api
      .get(`/api/ticketing/orders/by-number/${orderNumber}`)
      .then(res => { if (!cancelled) setOrder(res.data) })
      .catch(() => { if (!cancelled) toast.error('Failed to fetch order details') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [orderNumber, api])

  const allTickets = order ? (order.items || []).flatMap(item => item.tickets || []) : []
  const isPaid = order?.payment_status === 'paid'

  const handleView = useCallback((ticket) => setViewing(ticket), [])
  const handleCloseView = useCallback(() => setViewing(null), [])

  const handleDownload = useCallback(async (ticket, idx) => {
    const url = resolveImageUrl(ticket.image_url)
    if (!url) {
      toast.error('No ticket image available')
      return
    }
    const filename = `ticket-${ticket.ticket_number || idx + 1}.png`
    const ok = await downloadImage(url, filename)
    if (ok) toast.success('Ticket downloaded')
    else toast.error('Failed to download ticket')
  }, [])

  const handlePrintOne = useCallback((ticket, idx) => {
    const html = buildPrintHtml([ticket], `Ticket #${idx + 1}`)
    openPrintWindow(html)
  }, [])

  const handlePrintAll = useCallback(() => {
    if (allTickets.length === 0) {
      toast.error('No tickets to print')
      return
    }
    const html = buildPrintHtml(allTickets, 'All Tickets')
    openPrintWindow(html)
  }, [allTickets])

  const handleDownloadAll = useCallback(async () => {
    const downloadable = allTickets.filter(t => resolveImageUrl(t.image_url))
    if (downloadable.length === 0) {
      toast.error('No downloadable tickets')
      return
    }
    setDownloadingAll(true)
    let okCount = 0
    try {
      for (let i = 0; i < downloadable.length; i++) {
        const t = downloadable[i]
        const url = resolveImageUrl(t.image_url)
        const filename = `ticket-${t.ticket_number || i + 1}.png`
        const ok = await downloadImage(url, filename)
        if (ok) okCount += 1
        // Small gap so the browser doesn't block a burst of downloads
        if (i < downloadable.length - 1) {
          await new Promise(r => setTimeout(r, 400))
        }
      }
      if (okCount === downloadable.length) {
        toast.success(`Downloaded ${okCount} ticket(s)`)
      } else {
        toast.error(`Downloaded ${okCount} of ${downloadable.length} ticket(s)`)
      }
    } finally {
      setDownloadingAll(false)
    }
  }, [allTickets])

  if (loading) {
    return (
      <MainLayout>
        <div className="flex justify-center py-20"><Spinner size="xl" /></div>
      </MainLayout>
    )
  }

  if (!order) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8">
          <Alert variant="error">Order not found</Alert>
          <div className="mt-6">
            <Link to="/matches"><Button variant="outline">← Back to Matches</Button></Link>
          </div>
        </div>
      </MainLayout>
    )
  }

  const firstTicket = allTickets[0]
  const matchStats = firstTicket?.match
    ? {
        totalCapacity: firstTicket.match.total_capacity,
        totalSold: firstTicket.match.total_tickets_sold,
        totalAvailable: firstTicket.match.total_available,
      }
    : null

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className={`rounded-lg px-6 py-4 mb-6 ${isPaid ? 'bg-green-100 border border-green-400 text-green-700' : 'bg-yellow-100 border border-yellow-400 text-yellow-700'}`}>
          <h1 className="text-2xl font-bold">
            {isPaid ? '✅ Order Confirmed!' : '⏳ Payment Pending'}
          </h1>
          <p>Order Number: {order.order_number}</p>
          <p>
            Status: <Badge variant={isPaid ? 'success' : 'warning'}>{order.payment_status}</Badge>
          </p>
          {isPaid && <p>Your tickets have been sent to: {order.customer_email}</p>}
        </div>

        <Card padding="lg" className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Order Details</h2>
          <p><span className="font-medium">Customer:</span> {order.customer_name}</p>
          <p><span className="font-medium">Email:</span> {order.customer_email}</p>
          <p><span className="font-medium">Total:</span> ZMW {parseFloat(order.total_amount || 0).toFixed(2)}</p>
        </Card>

        {matchStats && (
          <Card padding="lg" className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Match Statistics</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{matchStats.totalCapacity ?? '—'}</p>
                <p className="text-sm text-gray-500">Total Seats</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{matchStats.totalSold ?? '—'}</p>
                <p className="text-sm text-gray-500">Sold</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{matchStats.totalAvailable ?? '—'}</p>
                <p className="text-sm text-gray-500">Available</p>
              </div>
            </div>
          </Card>
        )}

        {isPaid && allTickets.length > 0 && (
          <Card padding="lg">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
              <h2 className="text-xl font-semibold">Your Tickets</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadAll}
                  disabled={downloadingAll}
                  className="text-sm px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
                >
                  {downloadingAll ? 'Downloading…' : `Download All (${allTickets.length})`}
                </button>
                <button
                  type="button"
                  onClick={handlePrintAll}
                  className="text-sm px-4 py-2 rounded bg-gray-800 hover:bg-gray-900 text-white"
                >
                  Print All ({allTickets.length})
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {allTickets.map((ticket, idx) => (
                <TicketDisplay
                  key={ticket.id}
                  ticket={ticket}
                  idx={idx}
                  onView={handleView}
                  onDownload={handleDownload}
                  onPrint={handlePrintOne}
                  busy={downloadingAll}
                />
              ))}
            </div>

            <div className="mt-6 flex gap-4 print:hidden">
              <Link
                to="/matches"
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Browse More Matches
              </Link>
            </div>
          </Card>
        )}

        {!isPaid && (
          <Card padding="lg">
            <Alert variant="info">
              Your payment is being processed. Once confirmed, your tickets will appear here.
            </Alert>
            <div className="mt-4">
              <Link to="/matches" className="text-green-600 font-medium hover:underline">
                Browse Other Matches
              </Link>
            </div>
          </Card>
        )}

        {viewing && (
          <TicketImageViewer ticket={viewing} onClose={handleCloseView} />
        )}
      </div>
    </MainLayout>
  )
}