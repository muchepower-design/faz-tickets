from flask import Blueprint

bp = Blueprint('club', __name__)

from app.club import routes
