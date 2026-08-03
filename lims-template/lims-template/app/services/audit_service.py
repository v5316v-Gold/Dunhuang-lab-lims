"""
Audit service - log entity changes
"""
import hashlib
import json
from datetime import datetime


class AuditService:
    """
    Minimal audit logger. In production, route to Elasticsearch
    and/or write to PostgreSQL audit_logs table via a DB trigger.
    """

    def __init__(self, db_session=None):
        self._db = db_session

    async def log(
        self,
        db,
        action: str,
        entity_type: str,
        entity_id: str,
        entity_repr: str,
        operator_id: str,
        operator_name: str,
        operator_ip: str,
        changes: dict | None = None,
        reason: str | None = None,
    ):
        """
        Write to the AuditLog table. In production also push to Elasticsearch.
        """
        from app.models.audit_log import AuditLog

        # Build digest chain
        prev_digest = await self._get_last_digest(db, entity_type, entity_id)
        raw_digest = f"{action}|{entity_id}|{operator_id}|{json.dumps(changes or {}, sort_keys=True)}|{prev_digest or ''}"
        digest = hashlib.sha256(raw_digest.encode()).hexdigest()

        log_entry = AuditLog(
            id=__import__("uuid").uuid4().hex,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_repr=entity_repr,
            operator_id=operator_id,
            operator_name=operator_name,
            operator_ip=operator_ip,
            changes=changes,
            reason=reason,
            digest=digest,
            prev_digest=prev_digest,
            occurred_at=datetime.utcnow(),
        )
        db.add(log_entry)
        await db.flush()
        return log_entry

    async def _get_last_digest(self, db, entity_type: str, entity_id: str) -> str | None:
        from sqlalchemy import select
        from app.models.audit_log import AuditLog

        result = await db.execute(
            select(AuditLog.digest)
            .where(AuditLog.entity_type == entity_type, AuditLog.entity_id == entity_id)
            .order_by(AuditLog.occurred_at.desc())
            .limit(1)
        )
        row = result.scalar_one_or_none()
        return row