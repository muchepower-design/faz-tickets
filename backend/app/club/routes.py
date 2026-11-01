from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.club import bp
from app import db
from app.models.user import User
from app.models.club import Club
from app.models.match import Match
from app.models.ticket import TicketType
from functools import wraps

def club_access_required(f):
    """Allow club officers, admins, and handle missing club gracefully"""
    @wraps(f)
    @jwt_required()
    def decorated(*args, **kwargs):
        user_id = get_jwt_identity()
        user = User.query.get(int(user_id))
        if not user:
            return jsonify({'error': 'User not found'}), 401
        
        # Admins always pass
        if user.has_role('super_admin') or user.has_role('faz_admin'):
            return f(*args, **kwargs)
        
        # Club officers pass (even without club_id - route will handle)
        if user.has_role('club_admin') or user.has_role('club_officer'):
            return f(*args, **kwargs)
        
        return jsonify({'error': 'Access denied'}), 403
    return decorated


@bp.route('/dashboard', methods=['GET'])
@club_access_required
def dashboard():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    
    # Handle case where user has no club assigned
    if (user.has_role('club_admin') or user.has_role('club_officer')) and not user.club_id:
        return jsonify({
            'club': None,
            'upcoming_matches': [],
            'total_tickets_sold': 0,
            'total_revenue': 0,
            'needs_club_assignment': True,
            'message': 'Your account is not yet linked to a club. Please contact an administrator.'
        }), 200
    
    # Determine club for admins
    if (user.has_role('super_admin') or user.has_role('faz_admin')) and not user.club_id:
        club = Club.query.filter_by(is_active=True).first()
        if not club:
            return jsonify({
                'club': None,
                'upcoming_matches': [],
                'total_tickets_sold': 0,
                'total_revenue': 0,
                'needs_club_setup': True,
                'message': 'No active clubs found. Please create a club first.'
            }), 200
    else:
        club = Club.query.get(user.club_id)
        if not club:
            return jsonify({'error': 'Club not found'}), 404
    
    matches = Match.query.filter_by(club_id=club.id, match_type='club').order_by(Match.date_time.desc()).limit(5).all()
    
    return jsonify({
        'club': club.to_dict(),
        'upcoming_matches': [m.to_dict() for m in matches],
        'total_tickets_sold': 0,  # Placeholder
        'total_revenue': 0        # Placeholder
    }), 200


@bp.route('/matches', methods=['POST'])
@club_access_required
def create_match():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    data = request.get_json()
    
    # Determine club_id
    if user.has_role('super_admin') or user.has_role('faz_admin'):
        club_id = data.get('club_id')
        if not club_id:
            club = Club.query.filter_by(is_active=True).first()
            if not club:
                return jsonify({'error': 'No active clubs found. Please create a club first.'}), 400
            club_id = club.id
    else:
        club_id = user.club_id
        if not club_id:
            return jsonify({'error': 'Your account is not linked to a club. Cannot create match.'}), 400
    
    match = Match(
        home_team=data['home_team'],
        away_team=data['away_team'],
        match_type='club',
        club_id=club_id,
        venue=data['venue'],
        date_time=data['date_time'],
        description=data.get('description'),
        created_by=user_id
    )
    db.session.add(match)
    db.session.flush()
    
    for tt_data in data.get('ticket_types', []):
        tt = TicketType(
            match_id=match.id,
            name=tt_data['name'],
            price=tt_data['price'],
            capacity=tt_data['capacity']
        )
        db.session.add(tt)
    
    db.session.commit()
    return jsonify(match.to_dict()), 201


@bp.route('/matches', methods=['GET'])
@club_access_required
def get_club_matches():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    # Club officer without club
    if (user.has_role('club_admin') or user.has_role('club_officer')) and not user.club_id:
        return jsonify([]), 200
    
    if user.has_role('super_admin') or user.has_role('faz_admin'):
        club_id_param = request.args.get('club_id')
        if club_id_param:
            matches = Match.query.filter_by(club_id=int(club_id_param), match_type='club').order_by(Match.date_time.desc()).all()
        else:
            matches = Match.query.filter_by(match_type='club').order_by(Match.date_time.desc()).all()
    else:
        matches = Match.query.filter_by(club_id=user.club_id, match_type='club').order_by(Match.date_time.desc()).all()
    
    return jsonify([m.to_dict() for m in matches]), 200


@bp.route('/matches/<int:match_id>', methods=['PUT'])
@club_access_required
def update_match(match_id):
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    match = Match.query.get_or_404(match_id)
    
    if not (user.has_role('super_admin') or user.has_role('faz_admin')):
        if match.club_id != user.club_id:
            return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    updatable = ['home_team', 'away_team', 'venue', 'date_time', 'description', 'is_active']
    for field in updatable:
        if field in data:
            setattr(match, field, data[field])
    db.session.commit()
    return jsonify(match.to_dict()), 200