from flask import jsonify, request
from app.api import bp
from app.models.match import Match
from app.models.ticket import TicketType
from app.api.holds import clean_expired_holds

@bp.route('/matches', methods=['GET'])
def get_matches():
    match_type = request.args.get('type')  # 'national' or 'club'
    club_id = request.args.get('club_id')
    active_only = request.args.get('active_only', 'true').lower() == 'true'
    
    query = Match.query
    if match_type:
        query = query.filter_by(match_type=match_type)
    if club_id:
        query = query.filter_by(club_id=club_id)
    if active_only:
        query = query.filter_by(is_active=True)
    
    matches = query.order_by(Match.date_time.asc()).all()
    return jsonify([m.to_dict() for m in matches]), 200

@bp.route('/matches/<int:match_id>', methods=['GET'])
def get_match(match_id):
    clean_expired_holds()          # ensure availability is accurate
    match = Match.query.get_or_404(match_id)
    return jsonify(match.to_dict()), 200

@bp.route('/matches/<int:match_id>/ticket-types', methods=['GET'])
def get_match_ticket_types(match_id):
    match = Match.query.get_or_404(match_id)
    ticket_types = TicketType.query.filter_by(match_id=match_id).all()
    return jsonify([tt.to_dict() for tt in ticket_types]), 200