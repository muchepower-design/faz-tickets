from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.api import bp
from app import db
from app.models.ticket import Ticket
from app.models.match import Match

@bp.route('/tickets/verify', methods=['POST'])
@jwt_required()
def verify_ticket():
    data = request.get_json()
    ticket_number = data.get('ticket_number')
    
    if not ticket_number:
        return jsonify({'valid': False, 'message': 'Ticket number required'}), 400
    
    ticket = Ticket.query.filter_by(ticket_number=ticket_number).first()
    if not ticket:
        return jsonify({'valid': False, 'message': 'Ticket not found'}), 404
    
    if ticket.is_used:
        return jsonify({'valid': False, 'message': 'Ticket already used'}), 400
    
    # Mark as used
    ticket.is_used = True
    ticket.used_at = db.func.now()
    ticket.verified_by = get_jwt_identity()
    db.session.commit()
    
    return jsonify({
        'valid': True,
        'ticket': ticket.to_dict(),
        'match': ticket.match.to_dict() if ticket.match else None
    }), 200

@bp.route('/tickets/<string:ticket_number>', methods=['GET'])
def get_ticket(ticket_number):
    ticket = Ticket.query.filter_by(ticket_number=ticket_number).first_or_404()
    return jsonify(ticket.to_dict()), 200