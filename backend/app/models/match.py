import uuid
from datetime import datetime
from app import db
from app.utils import GUID
from sqlalchemy import func

class Match(db.Model):
    __tablename__ = 'matches'
    id = db.Column(GUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    home_team = db.Column(db.String(100), nullable=False)
    away_team = db.Column(db.String(100), nullable=False)
    match_type = db.Column(db.String(20), nullable=False)
    club_id = db.Column(GUID(), db.ForeignKey('clubs.id'), nullable=True)
    venue = db.Column(db.String(200), nullable=False)
    date_time = db.Column(db.DateTime, nullable=False)
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(GUID(), db.ForeignKey('users.id'))

    club = db.relationship('Club', back_populates='matches')
    ticket_types = db.relationship('TicketType', back_populates='match', lazy='dynamic', cascade='all, delete-orphan')
    tickets = db.relationship('Ticket', back_populates='match', lazy='dynamic')

    def to_dict(self):
        from app.models.hold import SeatHold

        total_capacity = sum(tt.capacity for tt in self.ticket_types)
        total_sold = sum(tt.tickets_sold for tt in self.ticket_types)

        holds = db.session.query(
            SeatHold.ticket_type_id,
            func.sum(SeatHold.quantity).label('held')
        ).filter(
            SeatHold.match_id == self.id,
            SeatHold.expires_at > datetime.utcnow()
        ).group_by(SeatHold.ticket_type_id).all()
        held_map = {h.ticket_type_id: h.held for h in holds}

        for tt in self.ticket_types:
            tt.held = held_map.get(tt.id, 0)
            tt.dynamic_available = tt.capacity - tt.tickets_sold - tt.held

        return {
            'id': self.id,
            'home_team': self.home_team,
            'away_team': self.away_team,
            'match_type': self.match_type,
            'club_id': self.club_id,
            'venue': self.venue,
            'date_time': self.date_time.isoformat() if self.date_time else None,
            'description': self.description,
            'is_active': self.is_active,
            'ticket_types': [tt.to_dict() for tt in self.ticket_types],
            'total_capacity': total_capacity,
            'total_tickets_sold': total_sold,
            'total_available': total_capacity - total_sold - sum(held_map.values())
        }