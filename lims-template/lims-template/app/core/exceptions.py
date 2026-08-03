"""
Custom LIMS Exceptions
"""
from fastapi import status


class LIMSException(Exception):
    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    message: str = "Internal server error"

    def __init__(self, message: str | None = None):
        if message:
            self.message = message
        super().__init__(self.message)


class NotFoundError(LIMSException):
    status_code = status.HTTP_404_NOT_FOUND
    message = "Resource not found"


class PermissionDeniedError(LIMSException):
    status_code = status.HTTP_403_FORBIDDEN
    message = "Permission denied"


class ValidationError(LIMSException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    message = "Validation failed"


class ConflictError(LIMSException):
    status_code = status.HTTP_409_CONFLICT
    message = "Resource conflict"


class AuthenticationError(LIMSException):
    status_code = status.HTTP_401_UNAUTHORIZED
    message = "Authentication failed"


class InvalidTransitionError(LIMSException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    message = "Invalid status transition"


class ResultLockedError(LIMSException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    message = "Result is locked and cannot be modified"