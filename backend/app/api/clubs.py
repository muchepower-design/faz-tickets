from flask import jsonify, request
from app.api import bp
from app.models.club import Club

@bp.route('/clubs', methods=['GET'])
def get_clubs():
    active_only = request.args.get('active_only', 'true').lower() == 'true'
    query = Club.query
    if active_only:
        query = query.filter_by(is_active=True)
    clubs = query.all()
    return jsonify([c.to_dict() for c in clubs]), 200

@bp.route('/clubs/<int:club_id>', methods=['GET'])
def get_club(club_id):
    club = Club.query.get_or_404(club_id)
    return jsonify(club.to_dict()), 200
