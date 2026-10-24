import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def png_bytes():
    image = Image.new("RGB", (120, 80), "white")
    out = io.BytesIO()
    image.save(out, "PNG")
    return out.getvalue()
