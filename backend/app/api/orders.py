from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity, decode_token
from app.api import bp
from app import db
from app.models.order import Order, OrderItem
from app.models.ticket import TicketType
from app.models.hold import SeatHold
import uuid

@bp.route('/orders', methods=['POST'])
def create_order():
    try:
        data = request.get_json()
        
        # Get user_id if token is present (optional)
        user_id = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            try:
                token = auth_header.split(' ')[1]
                decoded = decode_token(token)
                user_id = int(decoded['sub'])
            except:
                pass  # Guest checkout
        
        customer_email = data.get('customer_email')
        customer_name = data.get('customer_name')
        customer_phone = data.get('customer_phone')
        items = data.get('items', [])
        hold_tokens = data.get('hold_tokens', [])   # list of hold tokens to release

        if not customer_email or not items:
            return jsonify({'error': 'Email and items required'}), 400

        with db.session.begin_nested():
            total = 0
            order_items = []
            for item in items:
                ticket_type_id = item.get('ticket_type_id')
                quantity = item.get('quantity')
                if not ticket_type_id or not quantity or quantity <= 0:
                    db.session.rollback()
                    return jsonify({'error': 'Invalid item data'}), 400

                # Lock the row to prevent over‑selling
                ticket_type = db.session.query(TicketType).filter(
                    TicketType.id == ticket_type_id
                ).with_for_update().one_or_none()
                if not ticket_type:
                    db.session.rollback()
                    return jsonify({'error': f'Ticket type {ticket_type_id} not found'}), 404

                available = ticket_type.capacity - ticket_type.tickets_sold
                if quantity > available:
                    db.session.rollback()
                    return jsonify({'error': f'Only {available} tickets available for {ticket_type.name}'}), 400

                total += float(ticket_type.price) * quantity
                order_items.append({
                    'ticket_type': ticket_type,
                    'quantity': quantity,
                    'price': float(ticket_type.price)
                })

                # Reserve seats immediately
                ticket_type.tickets_sold += quantity
                db.session.add(ticket_type)

            # Create order (pending payment)
            order = Order(
                user_id=user_id,
                customer_email=customer_email,
                customer_name=customer_name,
                customer_phone=customer_phone,
                total_amount=total,
                payment_status='pending',
                payment_method='demo'
            )
            db.session.add(order)
            db.session.flush()

            # Create order items
            for item in order_items:
                order_item = OrderItem(
                    order_id=order.id,
                    ticket_type_id=item['ticket_type'].id,
                    quantity=item['quantity'],
                    unit_price=item['ticket_type'].price
                )
                db.session.add(order_item)

            # Delete the hold tokens if provided (they are no longer needed)
            for token in hold_tokens:
                hold = SeatHold.query.filter_by(hold_token=token).first()
                if hold:
                    db.session.delete(hold)

        db.session.commit()
        return jsonify(order.to_dict()), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error creating order: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@bp.route('/orders/<int:order_id>/cancel', methods=['POST'])
def cancel_order(order_id):
    """Cancel a pending order and release reserved seats."""
    order = Order.query.get_or_404(order_id)
    if order.payment_status != 'pending':
        return jsonify({'error': 'Only pending orders can be cancelled'}), 400

    # Release reserved seats
    for item in order.items:
        ticket_type = TicketType.query.get(item.ticket_type_id)
        if ticket_type:
            ticket_type.tickets_sold = max(0, ticket_type.tickets_sold - item.quantity)
            db.session.add(ticket_type)

    db.session.delete(order)
    db.session.commit()
    return jsonify({'message': 'Order cancelled'}), 200


@bp.route('/orders/by-number/<string:order_number>', methods=['GET'])
def get_order_by_number(order_number):
    order = Order.query.filter_by(order_number=order_number).first_or_404()
    return jsonify(order.to_dict()), 200

@bp.route('/orders/<int:order_id>', methods=['GET'])
def get_order(order_id):
    order = Order.query.get_or_404(order_id)
    return jsonify(order.to_dict()), 200