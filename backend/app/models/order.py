import uuid
from datetime import datetime
from app import db
from app.utils import GUID

class Order(db.Model):
    __tablename__ = 'orders'
    id = db.Column(GUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_number = db.Column(db.String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(GUID(), db.ForeignKey('users.id'), nullable=True)
    customer_email = db.Column(db.String(120), nullable=False)
    customer_name = db.Column(db.String(120))
    customer_phone = db.Column(db.String(20))
    total_amount = db.Column(db.Numeric(10,2), nullable=False)
    payment_status = db.Column(db.String(20), default='pending')
    payment_method = db.Column(db.String(50))
    payment_reference = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = db.relationship('User', back_populates='orders')
    items = db.relationship('OrderItem', back_populates='order', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'order_number': self.order_number,
            'customer_email': self.customer_email,
            'customer_name': self.customer_name,
            'total_amount': float(self.total_amount),
            'payment_status': self.payment_status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'items': [item.to_dict() for item in self.items]
        }

class OrderItem(db.Model):
    __tablename__ = 'order_items'
    id = db.Column(GUID(), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = db.Column(GUID(), db.ForeignKey('orders.id'), nullable=False)
    ticket_type_id = db.Column(GUID(), db.ForeignKey('ticket_types.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Numeric(10,2), nullable=False)
    
    order = db.relationship('Order', back_populates='items')
    ticket_type = db.relationship('TicketType')
    tickets = db.relationship('Ticket', back_populates='order_item', lazy='dynamic')
    
    def to_dict(self):
        match_name = None
        match_id = None
        if self.ticket_type and self.ticket_type.match:
            match = self.ticket_type.match
            match_name = f"{match.home_team} vs {match.away_team}"
            match_id = match.id

        return {
            'id': self.id,
            'ticket_type': self.ticket_type.name if self.ticket_type else None,
            'ticket_type_id': self.ticket_type_id,
            'quantity': self.quantity,
            'unit_price': float(self.unit_price),
            'match_id': match_id,
            'match_name': match_name,
            'tickets': [t.to_dict() for t in self.tickets]
        }