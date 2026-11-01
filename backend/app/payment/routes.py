import os
import uuid
import requests
from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.payment import bp
from app import db
from app.models.order import Order, OrderItem
from app.models.ticket import Ticket, TicketType
from dotenv import load_dotenv

load_dotenv()

PAWAPAY_API_KEY = os.environ.get('PAWAPAY_API_KEY', 'your-api-key-here')
PAWAPAY_BASE_URL = "https://api.pawapay.io/v2"

def get_pawapay_headers():
    return {
        "Authorization": f"Bearer {PAWAPAY_API_KEY}",
        "Content-Type": "application/json"
    }

@bp.route('/providers', methods=['GET'])
def get_providers():
    """Get available mobile money providers for Zambia"""
    try:
        resp = requests.get(
            f"{PAWAPAY_BASE_URL}/availability",
            headers=get_pawapay_headers(),
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            providers = []
            for country in data:
                if country.get('country') == 'ZMB':
                    for prov in country.get('providers', []):
                        deposit_status = prov.get('operationTypes', {}).get('DEPOSIT', 'CLOSED')
                        providers.append({
                            'provider': prov['provider'],
                            'name': prov['provider'].replace('_ZMB', '').replace('_OAPI_ZMB', '').replace('MOMO', ' Mobile Money'),
                            'country': 'ZMB',
                            'deposit_operational': deposit_status == 'OPERATIONAL'
                        })
            return jsonify(providers), 200
        else:
            return jsonify({'error': 'Failed to fetch providers'}), 502
    except requests.exceptions.RequestException:
        return jsonify({'error': 'Service temporarily unavailable'}), 503

@bp.route('/deposit', methods=['POST'])
def initiate_deposit():
    """
    Initiate a mobile money payment via PawaPay.
    Expects JSON: { order_id, provider, phone_number, amount, customer_email }
    Returns depositId on success (when prompt is sent).
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    order_id = data.get('order_id')
    provider = data.get('provider')
    phone_number = data.get('phone_number')
    amount = data.get('amount')
    customer_email = data.get('customer_email')

    if not all([order_id, provider, phone_number, amount]):
        return jsonify({'error': 'Missing required parameters'}), 400

    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404

    if order.payment_status != 'pending':
        return jsonify({'error': 'Order is already paid or cancelled'}), 400

    deposit_id = str(uuid.uuid4())
    client_ref = f"FAZ-{order.id}-{uuid.uuid4().hex[:6].upper()}"

    payload = {
        "depositId": deposit_id,
        "payer": {
            "type": "MMO",
            "accountDetails": {
                "phoneNumber": phone_number,
                "provider": provider
            }
        },
        "amount": str(amount),
        "currency": "ZMW",
        "clientReferenceId": client_ref,
        "customerMessage": f"FAZ Order {order.id}"[:22],
        "metadata": [
            {"orderId": str(order.id)},
            {"customerId": customer_email or order.customer_email, "isPII": True}
        ]
    }

    try:
        resp = requests.post(
            f"{PAWAPAY_BASE_URL}/deposits",
            json=payload,
            headers=get_pawapay_headers(),
            timeout=30
        )
        pawa_resp = resp.json()

        if resp.status_code == 200:
            status = pawa_resp.get('status')
            if status in ['ACCEPTED', 'DUPLICATE_IGNORED']:
                # Save deposit ID to order for later polling
                order.payment_reference = pawa_resp.get('depositId', deposit_id)
                order.payment_method = provider
                db.session.commit()
                return jsonify({
                    'success': True,
                    'depositId': order.payment_reference,
                    'message': 'Payment request sent. Please check your phone to approve.'
                }), 200
            else:
                # Immediately rejected (e.g., invalid phone, provider unavailable)
                return jsonify({
                    'success': False,
                    'status': status,
                    'failureReason': pawa_resp.get('failureReason')
                }), 200
        else:
            return jsonify({
                'success': False,
                'status': pawa_resp.get('status', 'ERROR'),
                'failureReason': pawa_resp.get('failureReason'),
                'http_status': resp.status_code
            }), 200 if resp.status_code in [400, 401, 403] else 502

    except requests.exceptions.RequestException:
        return jsonify({'error': 'Payment service unavailable'}), 503

@bp.route('/deposit/<deposit_id>/check', methods=['GET'])
def check_deposit_status(deposit_id):
    """
    Poll PawaPay for the deposit status.
    If COMPLETED, validate seat availability and generate tickets.
    If FAILED or NOT_FOUND, mark the order as failed.
    """
    # Find the order by deposit ID stored in payment_reference
    order = Order.query.filter_by(payment_reference=deposit_id).first()
    if not order:
        return jsonify({'error': 'Deposit not found'}), 404

    try:
        resp = requests.get(
            f"{PAWAPAY_BASE_URL}/deposits/{deposit_id}",
            headers=get_pawapay_headers(),
            timeout=10
        )
        data = resp.json()

        if resp.status_code == 200:
            status = data.get('status')
            deposit_data = data.get('data') if status == 'FOUND' else None

            if status == 'FOUND' and deposit_data:
                deposit_status = deposit_data.get('status')

                if deposit_status == 'COMPLETED':
                    # Double‑check that all ordered ticket types still have enough capacity
                    for item in order.items:
                        ticket_type = TicketType.query.get(item.ticket_type_id)
                        if not ticket_type:
                            order.payment_status = 'failed'
                            db.session.commit()
                            return jsonify({
                                'success': False,
                                'status': 'FAILED',
                                'failureReason': {'failureMessage': 'Ticket type no longer exists'}
                            }), 200
                        available = ticket_type.capacity - ticket_type.tickets_sold
                        if item.quantity > available:
                            # Not enough seats left – fail the order
                            order.payment_status = 'failed'
                            db.session.commit()
                            return jsonify({
                                'success': False,
                                'status': 'FAILED',
                                'failureReason': {
                                    'failureMessage': f'Only {available} tickets available for {ticket_type.name}'
                                }
                            }), 200

                    # All items are available – generate tickets and update sold counts
                    for item in order.items:
                        ticket_type = TicketType.query.get(item.ticket_type_id)
                        for _ in range(item.quantity):
                            ticket = Ticket(
                                ticket_number=str(uuid.uuid4()),
                                order_item_id=item.id,
                                match_id=ticket_type.match_id,
                                ticket_type_id=ticket_type.id
                            )
                            ticket.generate_qr_code()
                            db.session.add(ticket)
                        ticket_type.tickets_sold += item.quantity
                        db.session.add(ticket_type)

                    order.payment_status = 'paid'
                    db.session.commit()
                    return jsonify({
                        'success': True,
                        'status': 'COMPLETED',
                        'message': 'Payment completed. Tickets generated.'
                    }), 200

                elif deposit_status == 'FAILED':
                    order.payment_status = 'failed'
                    db.session.commit()
                    return jsonify({
                        'success': False,
                        'status': 'FAILED',
                        'failureReason': deposit_data.get('failureReason')
                    }), 200

                elif deposit_status in ['ACCEPTED', 'PROCESSING', 'IN_RECONCILIATION']:
                    return jsonify({
                        'success': True,   # still pending, not a failure
                        'status': deposit_status,
                        'message': 'Payment still pending'
                    }), 200

                else:
                    return jsonify({'success': False, 'status': 'UNKNOWN'}), 200

            elif status == 'NOT_FOUND':
                order.payment_status = 'failed'
                db.session.commit()
                return jsonify({'success': False, 'status': 'NOT_FOUND'}), 200

            else:
                return jsonify({'success': False, 'status': 'UNKNOWN'}), 200

        else:
            return jsonify({
                'success': False,
                'status': 'ERROR',
                'failureReason': data.get('failureReason')
            }), 502

    except requests.exceptions.RequestException:
        return jsonify({'error': 'Payment service unavailable'}), 503