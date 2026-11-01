from flask import Blueprint

bp = Blueprint('api', __name__)

# Import routes after bp is defined
from app.api import matches
from app.api import clubs
from app.api import orders
from app.api import tickets
from app.api import holds