import uuid
from datetime import datetime
from app import db
from app.utils import GUID
from werkzeug.security import generate_password_hash, check_password_hash

class Role(db.Model):
    __tablename__ = 'roles'
    id = db.Column(GUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.String(200))
    
    users = db.relationship('User', secondary='user_roles', back_populates='roles')

class UserRole(db.Model):
    __tablename__ = 'user_roles'
    user_id = db.Column(GUID(), db.ForeignKey('users.id'), primary_key=True)
    role_id = db.Column(GUID(), db.ForeignKey('roles.id'), primary_key=True)

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(GUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    first_name = db.Column(db.String(64))
    last_name = db.Column(db.String(64))
    phone = db.Column(db.String(20))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    roles = db.relationship('Role', secondary='user_roles', back_populates='users')
    club_id = db.Column(GUID(), db.ForeignKey('clubs.id'), nullable=True)
    club = db.relationship('Club', back_populates='officers', foreign_keys=[club_id])
    orders = db.relationship('Order', back_populates='user', lazy='dynamic')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def has_role(self, role_name):
        return any(role.name == role_name for role in self.roles)
    
    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'phone': self.phone,
            'is_active': self.is_active,
            'roles': [role.name for role in self.roles],
            'club_id': self.club_id
        }