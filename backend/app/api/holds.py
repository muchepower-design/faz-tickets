from flask import jsonify, request
from app.api import bp
from app import db
from app.models.hold import SeatHold
from app.models.ticket import TicketType
from datetime import datetime, timedelta

def clean_expired_holds():
    """Delete expired holds."""
    SeatHold.query.filter(SeatHold.expires_at < datetime.utcnow()).delete()
    db.session.commit()

@bp.route('/matches/<int:match_id>/hold', methods=['POST'])
def hold_tickets(match_id):
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    ticket_type_id = data.get('ticket_type_id')
    try:
        quantity = int(data.get('quantity', 0))
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid quantity'}), 400

    hold_token = data.get('hold_token')

    clean_expired_holds()

    ticket_type = TicketType.query.get(ticket_type_id)
    if not ticket_type or ticket_type.match_id != match_id:
        return jsonify({'error': 'Ticket type not found'}), 404

    current_hold = None
    if hold_token:
        current_hold = SeatHold.query.filter_by(hold_token=hold_token).first()
        if not current_hold:
            return jsonify({'error': 'Hold token not found'}), 404

    held_by_others = db.session.query(db.func.sum(SeatHold.quantity)).filter(
        SeatHold.ticket_type_id == ticket_type_id,
        SeatHold.id != (current_hold.id if current_hold else 0)
    ).scalar() or 0

    available = ticket_type.capacity - ticket_type.tickets_sold - held_by_others
    if quantity > available:
        return jsonify({'error': f'Only {available} seats available', 'available': available}), 409

    if current_hold:
        current_hold.quantity = quantity
        current_hold.expires_at = datetime.utcnow() + timedelta(minutes=10)
        db.session.commit()
        return jsonify({
            'hold_token': current_hold.hold_token,
            'quantity': quantity,
            'available': available - quantity
        }), 200
    else:
        if quantity == 0:
            return jsonify({'error': 'Quantity must be positive'}), 400
        new_hold = SeatHold(
            match_id=match_id,
            ticket_type_id=ticket_type_id,
            quantity=quantity
        )
        db.session.add(new_hold)
        db.session.commit()
        return jsonify({
            'hold_token': new_hold.hold_token,
            'quantity': quantity,
            'available': available - quantity
        }), 201

@bp.route('/matches/<int:match_id>/hold/<hold_token>', methods=['DELETE'])
def release_hold(match_id, hold_token):
    hold = SeatHold.query.filter_by(hold_token=hold_token, match_id=match_id).first()
    if not hold:
        return jsonify({'error': 'Hold not found'}), 404
    db.session.delete(hold)
    db.session.commit()
    return jsonify({'message': 'Hold released'}), 200