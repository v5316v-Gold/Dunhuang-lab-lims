# Initial migration - users, samples, assignments, test_items, test_results, audit_logs

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable UUID extension
    op.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")

    # Users
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("username", sa.String(50), unique=True, nullable=False),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(100), nullable=False),
        sa.Column("role", sa.Enum("ADMIN", "QA_MANAGER", "LAB_MANAGER", "TECHNICIAN", "SAMPLER", "CLIENT", "AUDITOR", name="role_enum"), nullable=False),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("is_superuser", sa.Boolean(), default=False),
        sa.Column("client_id", sa.String(36), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_users_username", "users", ["username"])
    op.create_index("ix_users_email", "users", ["email"])

    # Test items (检测方法目录)
    op.create_table(
        "test_items",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("code", sa.String(50), unique=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("unit", sa.String(20), nullable=False),
        sa.Column("default_limit", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("loq", sa.String(50), nullable=True),
        sa.Column("lod", sa.String(50), nullable=True),
    )
    op.create_index("ix_test_items_code", "test_items", ["code"])

    # Samples
    op.create_table(
        "samples",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("sample_number", sa.String(50), unique=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("status", sa.Enum("RECEIVED", "PENDING", "ASSIGNED", "IN_PROGRESS", "REVIEWING", "REPORTED", "ARCHIVED", name="sample_status_enum"), nullable=False),
        sa.Column("priority", sa.Enum("ROUTINE", "URGENT", "STAT", name="sample_priority_enum"), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("client_id", sa.String(36), nullable=False),
        sa.Column("created_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("assigned_to", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("received_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("due_date", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("archived_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_samples_status_client", "samples", ["status", "client_id"])
    op.create_index("ix_samples_due_date", "samples", ["due_date"])

    # Assignments
    op.create_table(
        "assignments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("sample_id", sa.String(36), sa.ForeignKey("samples.id"), nullable=False),
        sa.Column("assigned_to", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("test_item_id", sa.String(36), sa.ForeignKey("test_items.id"), nullable=False),
        sa.Column("status", sa.Enum("PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED", name="assignment_status_enum"), nullable=False),
        sa.Column("method_code", sa.String(50), nullable=False),
        sa.Column("method_name", sa.String(255), nullable=False),
        sa.Column("assigned_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("due_date", sa.DateTime(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("result_metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_assignments_sample_status", "assignments", ["sample_id", "status"])

    # Test results
    op.create_table(
        "test_results",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("assignment_id", sa.String(36), sa.ForeignKey("assignments.id"), nullable=False),
        sa.Column("test_item_id", sa.String(36), sa.ForeignKey("test_items.id"), nullable=False),
        sa.Column("numeric_value", sa.Numeric(18, 6), nullable=True),
        sa.Column("text_value", sa.Text(), nullable=True),
        sa.Column("unit", sa.String(20), nullable=False),
        sa.Column("is_qualitative", sa.Boolean(), default=False),
        sa.Column("status", sa.Enum("PRELIMINARY", "FINAL", "VERIFIED", "LOCKED", name="result_status_enum"), nullable=False),
        sa.Column("raw_data_path", sa.String(500), nullable=True),
        sa.Column("attachments", sa.JSON(), nullable=True),
        sa.Column("is_oos", sa.Boolean(), default=False),
        sa.Column("is_loq_below", sa.Boolean(), default=False),
        sa.Column("submitted_by", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("verified_by", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("verified_at", sa.DateTime(), nullable=True),
        sa.Column("change_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_test_results_assignment", "test_results", ["assignment_id"])

    # Audit logs
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("operator_id", sa.String(36), nullable=False),
        sa.Column("operator_name", sa.String(100), nullable=False),
        sa.Column("operator_ip", sa.String(45), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.String(36), nullable=False),
        sa.Column("entity_repr", sa.String(255), nullable=False),
        sa.Column("changes", sa.JSON(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("digest", sa.String(64), nullable=False),
        sa.Column("prev_digest", sa.String(64), nullable=True),
        sa.Column("occurred_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_audit_entity", "audit_logs", ["entity_type", "entity_id"])
    op.create_index("ix_audit_operator_time", "audit_logs", ["operator_id", "occurred_at"])
    op.create_index("ix_audit_time", "audit_logs", ["occurred_at"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("test_results")
    op.drop_table("assignments")
    op.drop_table("samples")
    op.drop_table("test_items")
    op.drop_table("users")