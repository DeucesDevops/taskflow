from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field


class Event(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    id: UUID
    userId: UUID
    type: Literal["task.created", "task.updated"]
    message: str = Field(min_length=1, max_length=500)
    taskId: UUID
    projectId: UUID
    createdAt: AwareDatetime

    def notification(self) -> dict:
        return self.model_dump(mode="json", exclude={"userId"})
