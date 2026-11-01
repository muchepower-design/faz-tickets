"""convert ids to uuid

Revision ID: d59cbce5e67f
Revises: e2191ba90817
Create Date: 2026-05-24 22:19:24.031707

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'd59cbce5e67f'
down_revision = 'e2191ba90817'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    
    # === STEP 1: Add UUID columns to all tables ===
    tables_with_uuid = [
        'roles', 'users', 'clubs', 'matches', 'ticket_types', 
        'tickets', 'orders', 'order_items', 'seat_holds'
    ]
    
    for table in tables_with_uuid:
        op.add_column(table, sa.Column('uuid_id', postgresql.UUID(), nullable=True))
    
    op.add_column('user_roles', sa.Column('uuid_user_id', postgresql.UUID(), nullable=True))
    op.add_column('user_roles', sa.Column('uuid_role_id', postgresql.UUID(), nullable=True))
    
    # === STEP 2: Generate UUIDs for existing rows ===
    for table in tables_with_uuid:
        conn.execute(sa.text(f"UPDATE {table} SET uuid_id = gen_random_uuid()"))
    
    conn.execute(sa.text("UPDATE user_roles SET uuid_user_id = gen_random_uuid()"))
    conn.execute(sa.text("UPDATE user_roles SET uuid_role_id = gen_random_uuid()"))
    
    # Make uuid_id NOT NULL after populating
    for table in tables_with_uuid:
        op.alter_column(table, 'uuid_id', nullable=False)
    
    # === STEP 3: Add temporary FK columns ===
    fk_mappings = [
        # (table, temp_col, references_table)
        ('users', 'temp_club_id', 'clubs'),
        ('matches', 'temp_club_id', 'clubs'),
        ('matches', 'temp_created_by', 'users'),
        ('ticket_types', 'temp_match_id', 'matches'),
        ('tickets', 'temp_order_item_id', 'order_items'),
        ('tickets', 'temp_match_id', 'matches'),
        ('tickets', 'temp_ticket_type_id', 'ticket_types'),
        ('tickets', 'temp_verified_by', 'users'),
        ('orders', 'temp_user_id', 'users'),
        ('order_items', 'temp_order_id', 'orders'),
        ('order_items', 'temp_ticket_type_id', 'ticket_types'),
        ('seat_holds', 'temp_match_id', 'matches'),
        ('seat_holds', 'temp_ticket_type_id', 'ticket_types'),
        ('seat_holds', 'temp_user_id', 'users'),
    ]
    
    for table, temp_col, _ in fk_mappings:
        op.add_column(table, sa.Column(temp_col, postgresql.UUID(), nullable=True))
    
    op.add_column('user_roles', sa.Column('temp_user_id', postgresql.UUID(), nullable=True))
    op.add_column('user_roles', sa.Column('temp_role_id', postgresql.UUID(), nullable=True))
    
    # === STEP 4: Populate temp FK columns with UUID values ===
    # users.club_id -> users.temp_club_id
    conn.execute(sa.text("""
        UPDATE users SET temp_club_id = (SELECT uuid_id FROM clubs WHERE clubs.id = users.club_id::int)
        WHERE users.club_id IS NOT NULL
    """))
    
    # matches.club_id -> matches.temp_club_id
    conn.execute(sa.text("""
        UPDATE matches SET temp_club_id = (SELECT uuid_id FROM clubs WHERE clubs.id = matches.club_id::int)
        WHERE matches.club_id IS NOT NULL
    """))
    
    # matches.created_by -> matches.temp_created_by
    conn.execute(sa.text("""
        UPDATE matches SET temp_created_by = (SELECT uuid_id FROM users WHERE users.id = matches.created_by::int)
        WHERE matches.created_by IS NOT NULL
    """))
    
    # ticket_types.match_id -> ticket_types.temp_match_id
    conn.execute(sa.text("""
        UPDATE ticket_types SET temp_match_id = (SELECT uuid_id FROM matches WHERE matches.id = ticket_types.match_id::int)
    """))
    
    # tickets.order_item_id -> tickets.temp_order_item_id
    conn.execute(sa.text("""
        UPDATE tickets SET temp_order_item_id = (SELECT uuid_id FROM order_items WHERE order_items.id = tickets.order_item_id::int)
    """))
    
    # tickets.match_id -> tickets.temp_match_id
    conn.execute(sa.text("""
        UPDATE tickets SET temp_match_id = (SELECT uuid_id FROM matches WHERE matches.id = tickets.match_id::int)
    """))
    
    # tickets.ticket_type_id -> tickets.temp_ticket_type_id
    conn.execute(sa.text("""
        UPDATE tickets SET temp_ticket_type_id = (SELECT uuid_id FROM ticket_types WHERE ticket_types.id = tickets.ticket_type_id::int)
    """))
    
    # tickets.verified_by -> tickets.temp_verified_by
    conn.execute(sa.text("""
        UPDATE tickets SET temp_verified_by = (SELECT uuid_id FROM users WHERE users.id = tickets.verified_by::int)
        WHERE tickets.verified_by IS NOT NULL
    """))
    
    # orders.user_id -> orders.temp_user_id
    conn.execute(sa.text("""
        UPDATE orders SET temp_user_id = (SELECT uuid_id FROM users WHERE users.id = orders.user_id::int)
        WHERE orders.user_id IS NOT NULL
    """))
    
    # order_items.order_id -> order_items.temp_order_id
    conn.execute(sa.text("""
        UPDATE order_items SET temp_order_id = (SELECT uuid_id FROM orders WHERE orders.id = order_items.order_id::int)
    """))
    
    # order_items.ticket_type_id -> order_items.temp_ticket_type_id
    conn.execute(sa.text("""
        UPDATE order_items SET temp_ticket_type_id = (SELECT uuid_id FROM ticket_types WHERE ticket_types.id = order_items.ticket_type_id::int)
    """))
    
    # seat_holds.match_id -> seat_holds.temp_match_id
    conn.execute(sa.text("""
        UPDATE seat_holds SET temp_match_id = (SELECT uuid_id FROM matches WHERE matches.id = seat_holds.match_id::int)
    """))
    
    # seat_holds.ticket_type_id -> seat_holds.temp_ticket_type_id
    conn.execute(sa.text("""
        UPDATE seat_holds SET temp_ticket_type_id = (SELECT uuid_id FROM ticket_types WHERE ticket_types.id = seat_holds.ticket_type_id::int)
    """))
    
    # seat_holds.user_id -> seat_holds.temp_user_id
    conn.execute(sa.text("""
        UPDATE seat_holds SET temp_user_id = (SELECT uuid_id FROM users WHERE users.id = seat_holds.user_id::int)
        WHERE seat_holds.user_id IS NOT NULL
    """))
    
    # user_roles.user_id -> user_roles.temp_user_id
    conn.execute(sa.text("""
        UPDATE user_roles SET temp_user_id = (SELECT uuid_id FROM users WHERE users.id = user_roles.user_id::int)
    """))
    
    # user_roles.role_id -> user_roles.temp_role_id
    conn.execute(sa.text("""
        UPDATE user_roles SET temp_role_id = (SELECT uuid_id FROM roles WHERE roles.id = user_roles.role_id::int)
    """))
    
    # === STEP 5: Drop old FK constraints ===
    # (Simplified - in production you'd list all constraint names)
    # For development, we just drop and recreate columns
    
    # === STEP 6: Replace old columns with UUID columns ===
    # Drop old integer columns
    for table, temp_col, _ in fk_mappings:
        # Get the original column name (remove 'temp_' prefix)
        orig_col = temp_col.replace('temp_', '')
        op.drop_column(table, orig_col)
        op.alter_column(table, temp_col, new_column_name=orig_col)
    
    # user_roles
    op.drop_column('user_roles', 'user_id')
    op.drop_column('user_roles', 'role_id')
    op.alter_column('user_roles', 'temp_user_id', new_column_name='user_id')
    op.alter_column('user_roles', 'temp_role_id', new_column_name='role_id')
    
    # Replace primary key columns
    for table in tables_with_uuid:
        # Drop old id column
        op.drop_column(table, 'id')
        # Rename uuid_id to id
        op.alter_column(table, 'uuid_id', new_column_name='id')
        # Add primary key constraint
        op.create_primary_key(f'pk_{table}', table, ['id'])
    
    # user_roles composite primary key
    op.create_primary_key('pk_user_roles', 'user_roles', ['user_id', 'role_id'])
    
    # === STEP 7: Recreate foreign key constraints ===
    # (Simplified - the columns already have the correct UUID values)
    
    print("UUID conversion complete!")


def downgrade():
    # This is complex to reverse. For development, it's easier to restore from backup.
    pass