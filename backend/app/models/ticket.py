import uuid
from datetime import datetime
import qrcode
import io
import base64
from app import db
from app.utils import GUID

class TicketType(db.Model):
    __tablename__ = 'ticket_types'
    id = db.Column(GUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    match_id = db.Column(GUID(), db.ForeignKey('matches.id'), nullable=False)
    name = db.Column(db.String(50), nullable=False)
    price = db.Column(db.Numeric(10,2), nullable=False)
    capacity = db.Column(db.Integer, nullable=False)
    tickets_sold = db.Column(db.Integer, default=0)
    
    match = db.relationship('Match', back_populates='ticket_types')
    tickets = db.relationship('Ticket', back_populates='ticket_type', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'price': float(self.price),
            'capacity': self.capacity,
            'tickets_sold': self.tickets_sold,
            'available': self.capacity - self.tickets_sold - getattr(self, 'held', 0),
            'held': getattr(self, 'held', 0),
            'dynamic_available': self.capacity - self.tickets_sold - getattr(self, 'held', 0)
        }

class Ticket(db.Model):
    __tablename__ = 'tickets'
    id = db.Column(GUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_number = db.Column(db.String(36), unique=True, nullable=False, index=True)
    order_item_id = db.Column(GUID(), db.ForeignKey('order_items.id'), nullable=False)
    match_id = db.Column(GUID(), db.ForeignKey('matches.id'), nullable=False)
    ticket_type_id = db.Column(GUID(), db.ForeignKey('ticket_types.id'), nullable=False)
    qr_code_data = db.Column(db.Text)
    is_used = db.Column(db.Boolean, default=False)
    used_at = db.Column(db.DateTime)
    verified_by = db.Column(GUID(), db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    match = db.relationship('Match', back_populates='tickets')
    ticket_type = db.relationship('TicketType', back_populates='tickets')
    order_item = db.relationship('OrderItem', back_populates='tickets')
    
    def generate_qr_code(self):
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        data = f"FAZ-TICKET:{self.ticket_number}:{self.match_id}:{self.ticket_type_id}"
        qr.add_data(data)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffered = io.BytesIO()
        img.save(buffered, "PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        self.qr_code_data = img_str
        return img_str
    
    def to_dict(self):
        return {
            'id': self.id,
            'ticket_number': self.ticket_number,
            'match_id': self.match_id,
            'ticket_type': self.ticket_type.name if self.ticket_type else None,
            'qr_code': self.qr_code_data,
            'is_used': self.is_used,
            'used_at': self.used_at.isoformat() if self.used_at else None,
            'match': self.match.to_dict() if self.match else None
        }