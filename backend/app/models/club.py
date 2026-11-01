import uuid
from datetime import datetime
from app import db
from app.utils import GUID

class Club(db.Model):
    __tablename__ = 'clubs'
    id = db.Column(GUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False, unique=True)
    short_name = db.Column(db.String(10))
    logo_url = db.Column(db.String(255))
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    officers = db.relationship('User', back_populates='club', lazy='dynamic', 
                               foreign_keys='User.club_id')
    matches = db.relationship('Match', back_populates='club', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'short_name': self.short_name,
            'logo_url': self.logo_url,
            'description': self.description,
            'is_active': self.is_active
        }