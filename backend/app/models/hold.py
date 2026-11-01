import uuid
from datetime import datetime, timedelta
from app import db
from app.utils import GUID

class SeatHold(db.Model):
    __tablename__ = 'seat_holds'

    id = db.Column(GUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    hold_token = db.Column(db.String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    match_id = db.Column(GUID(), db.ForeignKey('matches.id'), nullable=False)
    ticket_type_id = db.Column(GUID(), db.ForeignKey('ticket_types.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    user_id = db.Column(GUID(), db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.expires_at:
            self.expires_at = datetime.utcnow() + timedelta(minutes=10)

    def is_expired(self):
        return datetime.utcnow() > self.expires_at