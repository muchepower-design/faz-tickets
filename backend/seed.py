from app import create_app, db
from app.models.user import User, Role
from app.models.club import Club

def seed_roles():
    roles = [
        ('super_admin', 'Full system access'),
        ('faz_admin', 'FAZ administration'),
        ('club_admin', 'Club administrator'),
        ('club_officer', 'Club officer'),
        ('scanner', 'Ticket scanner'),
        ('customer', 'Regular customer')
    ]
    for name, desc in roles:
        if not Role.query.filter_by(name=name).first():
            db.session.add(Role(name=name, description=desc))
    db.session.commit()
    print("Roles seeded")

def seed_super_admin():
    if not User.query.filter_by(email='admin@faz.co.zm').first():
        admin = User(
            email='admin@faz.co.zm',
            first_name='FAZ',
            last_name='Administrator',
            is_active=True
        )
        admin.set_password('Admin@123')
        super_admin_role = Role.query.filter_by(name='super_admin').first()
        faz_admin_role = Role.query.filter_by(name='faz_admin').first()
        admin.roles.extend([super_admin_role, faz_admin_role])
        db.session.add(admin)
        db.session.commit()
        print("Super admin created (admin@faz.co.zm / Admin@123)")

if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        db.create_all()
        seed_roles()
        seed_super_admin()
        print("Database seeded!")
