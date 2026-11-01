from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.admin import bp
from app import db
from app.models.user import User, Role
from app.models.club import Club
from app.models.match import Match
from app.models.ticket import TicketType
from app.models.order import Order
from functools import wraps

def admin_required(f):
    @wraps(f)
    @jwt_required()
    def decorated(*args, **kwargs):
        user_id = get_jwt_identity()
        user = User.query.get(int(user_id))
        if not user or not (user.has_role('super_admin') or user.has_role('faz_admin')):
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated

# ==================== CLUBS ====================
@bp.route('/clubs', methods=['POST'])
@admin_required
def create_club():
    data = request.get_json()
    club = Club(
        name=data['name'],
        short_name=data.get('short_name'),
        logo_url=data.get('logo_url'),
        description=data.get('description')
    )
    db.session.add(club)
    db.session.commit()
    return jsonify(club.to_dict()), 201

@bp.route('/clubs/<int:club_id>', methods=['PUT'])
@admin_required
def update_club(club_id):
    club = Club.query.get_or_404(club_id)
    data = request.get_json()
    for field in ['name', 'short_name', 'logo_url', 'description', 'is_active']:
        if field in data:
            setattr(club, field, data[field])
    db.session.commit()
    return jsonify(club.to_dict()), 200

@bp.route('/clubs/<int:club_id>', methods=['DELETE'])
@admin_required
def delete_club(club_id):
    club = Club.query.get_or_404(club_id)
    club.is_active = False
    db.session.commit()
    return jsonify({'message': 'Club deactivated'}), 200

# ==================== MATCHES ====================
@bp.route('/matches', methods=['POST'])
@admin_required
def create_match():
    data = request.get_json()
    user_id = get_jwt_identity()
    match = Match(
        home_team=data['home_team'],
        away_team=data['away_team'],
        match_type=data['match_type'],
        club_id=data.get('club_id'),
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

@bp.route('/matches/<int:match_id>', methods=['PUT'])
@admin_required
def update_match(match_id):
    match = Match.query.get_or_404(match_id)
    data = request.get_json()
    
    # Update basic match fields
    updatable = ['home_team', 'away_team', 'venue', 'date_time', 'description', 'is_active']
    for field in updatable:
        if field in data:
            setattr(match, field, data[field])
    
    # Handle ticket types
    if 'ticket_types' in data:
        incoming = []
        for tt_data in data['ticket_types']:
            name = tt_data.get('name', '').strip()
            price = tt_data.get('price')
            capacity = tt_data.get('capacity')
            if name and price is not None and capacity is not None:
                incoming.append({
                    'id': tt_data.get('id'),
                    'name': name,
                    'price': float(price),
                    'capacity': int(capacity)
                })
        
        # Get existing ticket types
        existing_map = {tt.id: tt for tt in match.ticket_types}
        
        # Track which existing IDs are kept
        kept_ids = set()
        
        for item in incoming:
            if item['id'] and item['id'] in existing_map:
                # Update existing
                tt = existing_map[item['id']]
                tt.name = item['name']
                tt.price = item['price']
                tt.capacity = item['capacity']
                kept_ids.add(item['id'])
            else:
                # Create new ticket type
                new_tt = TicketType(
                    match_id=match.id,
                    name=item['name'],
                    price=item['price'],
                    capacity=item['capacity']
                )
                db.session.add(new_tt)
                db.session.flush()  # Force assignment of ID
                kept_ids.add(new_tt.id)
        
        # Delete ticket types not in kept_ids
        for tt in match.ticket_types:
            if tt.id not in kept_ids:
                db.session.delete(tt)
    
    try:
        db.session.commit()
        print("Commit successful")
    except Exception as e:
        db.session.rollback()
        print(f"Commit failed: {e}")
        return jsonify({'error': str(e)}), 500
    
    # Refresh match to get updated ticket types
    db.session.refresh(match)
    return jsonify(match.to_dict()), 200



# ==================== USERS ====================
@bp.route('/users', methods=['GET'])
@admin_required
def get_users():
    users = User.query.all()
    return jsonify([u.to_dict() for u in users]), 200

@bp.route('/users', methods=['POST'])
@admin_required
def create_user():
    data = request.get_json()
    user = User(
        email=data['email'],
        first_name=data.get('first_name'),
        last_name=data.get('last_name'),
        phone=data.get('phone')
    )
    user.set_password(data['password'])
    
    for role_name in data.get('roles', []):
        role = Role.query.filter_by(name=role_name).first()
        if role:
            user.roles.append(role)
    
    if 'club_id' in data and data['club_id']:
        user.club_id = data['club_id']
    
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201

@bp.route('/users/<int:user_id>', methods=['PUT'])
@admin_required
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    
    updatable = ['email', 'first_name', 'last_name', 'phone', 'club_id', 'is_active']
    for field in updatable:
        if field in data:
            setattr(user, field, data[field])
    
    if 'password' in data and data['password']:
        user.set_password(data['password'])
    
    if 'roles' in data:
        user.roles = []
        for role_name in data['roles']:
            role = Role.query.filter_by(name=role_name).first()
            if role:
                user.roles.append(role)
    
    db.session.commit()
    return jsonify(user.to_dict()), 200

# ==================== ORDERS (ADMIN) ====================
@bp.route('/orders', methods=['GET'])
@admin_required
def get_all_orders():
    """Get all orders (admin only)"""
    orders = Order.query.order_by(Order.created_at.desc()).all()
    return jsonify([o.to_dict() for o in orders]), 200

@bp.route('/orders/<int:order_id>', methods=['GET'])
@admin_required
def get_order_detail(order_id):
    """Get single order details (admin only)"""
    order = Order.query.get_or_404(order_id)
    return jsonify(order.to_dict()), 200


@bp.route('/matches/<int:match_id>', methods=['DELETE'])
@admin_required
def delete_match(match_id):
    match = Match.query.get_or_404(match_id)
    # Ticket types and tickets will be automatically deleted due to cascade
    db.session.delete(match)
    db.session.commit()
    return jsonify({'message': 'Match deleted'}), 200