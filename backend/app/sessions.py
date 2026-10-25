"""Bounded process-local bearer sessions; absolute TTL, no files or shared user context."""
import asyncio
import secrets
import time
from dataclasses import dataclass, field
from typing import Callable

from .documents import PageImage
from .schemas import ExtractedAnalysis, StudentProfile


@dataclass
class DocumentSession:
    pages: list[PageImage]
    profile: StudentProfile
    analysis: ExtractedAnalysis
    expires_at: float
    size: int
    history: list[dict] = field(default_factory=list)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class SessionStore:
    def __init__(self, ttl: int = 1200, max_count: int = 32, max_bytes: int = 64 * 1024 * 1024,
                 clock: Callable[[], float] = time.monotonic):
        self.ttl, self.max_count, self.max_bytes, self.clock = ttl, max_count, max_bytes, clock
        self._items: dict[str, DocumentSession] = {}

    def cleanup(self) -> None:
        for token in list(self._items):
            if self._items[token].expires_at <= self.clock():
                del self._items[token]

    def create(self, pages: list[PageImage], profile: StudentProfile, analysis: ExtractedAnalysis) -> str:
        self.cleanup()
        size = sum(len(p.data) + len(p.text.encode()) for p in pages)
        size += len(profile.model_dump_json().encode()) + len(analysis.model_dump_json().encode()) + 256_000
        if size > self.max_bytes:
            raise ValueError("Document context exceeds session memory limit.")
        while self._items and (len(self._items) >= self.max_count or
                              sum(s.size for s in self._items.values()) + size > self.max_bytes):
            del self._items[next(iter(self._items))]
        token = secrets.token_urlsafe(32)
        self._items[token] = DocumentSession(pages, profile, analysis, self.clock() + self.ttl, size)
        return token

    def get(self, token: str) -> DocumentSession | None:
        self.cleanup()
        return self._items.get(token)

    def delete(self, token: str) -> None:
        self._items.pop(token, None)

    def clear(self) -> None:
        self._items.clear()
