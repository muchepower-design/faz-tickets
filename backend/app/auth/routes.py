from flask import request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app import db
from app.models.user import User, Role
from app.auth import bp

@bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    email = data.get('email')
    password = data.get('password')
    first_name = data.get('first_name')
    last_name = data.get('last_name')
    phone = data.get('phone')
    
    if not email or not password:
        return jsonify({'error': 'Email and password required'}), 400
    
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409
    
    user = User(
        email=email,
        first_name=first_name,
        last_name=last_name,
        phone=phone
    )
    user.set_password(password)
    
    customer_role = Role.query.filter_by(name='customer').first()
    if customer_role:
        user.roles.append(customer_role)
    
    db.session.add(user)
    db.session.commit()
    
    # Convert user.id to string
    access_token = create_access_token(identity=str(user.id))
    return jsonify({
        'message': 'Registration successful',
        'user': user.to_dict(),
        'access_token': access_token
    }), 201

@bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid email or password'}), 401
    
    if not user.is_active:
        return jsonify({'error': 'Account disabled'}), 403
    
    # Convert user.id to string
    access_token = create_access_token(identity=str(user.id))
    return jsonify({
        'user': user.to_dict(),
        'access_token': access_token
    }), 200

@bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    user_id = get_jwt_identity()
    # Convert string back to int for database query
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(user.to_dict()), 200