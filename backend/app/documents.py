"""Validated, memory-only document preparation for multimodal Gemma requests."""
from dataclasses import dataclass
from io import BytesIO

import pypdfium2 as pdfium
from PIL import Image, ImageOps, UnidentifiedImageError


class DocumentError(ValueError):
    pass


@dataclass
class PageImage:
    data: bytes
    mime_type: str
    page: int
    text: str = ""


def _encode_page(image: Image.Image) -> tuple[bytes, str]:
    """Keep inline image payloads small enough for hosted inference."""
    image = ImageOps.exif_transpose(image)
    image.thumbnail((2200, 2200), Image.Resampling.LANCZOS)
    converted = image.convert("RGB")
    buf = BytesIO()
    converted.save(buf, format="PNG", optimize=True)
    png = buf.getvalue()
    if len(png) <= 1_500_000:
        return png, "image/png"
    # A high-resolution photograph can be many MB even when the source PDF is
    # small. JPEG compression avoids exceeding the provider's inline-data cap.
    buf = BytesIO()
    converted.save(buf, format="JPEG", quality=86, optimize=True)
    return buf.getvalue(), "image/jpeg"


def prepare_document(data: bytes, filename: str, max_pages: int = 5) -> list[PageImage]:
    if not data:
        raise DocumentError("The uploaded document is empty.")

    if data.startswith(b"%PDF-"):
        try:
            doc = pdfium.PdfDocument(data)
            try:
                count = len(doc)
                if count < 1:
                    raise DocumentError("This PDF has no pages.")
                if count > max_pages:
                    raise DocumentError(f"PDFs are limited to {max_pages} pages. Split the document and try again.")
                pages: list[PageImage] = []
                for index in range(count):
                    page = doc[index]
                    try:
                        width, height = page.get_size()
                        # Higher-resolution page text, still bounded for hosted inline inference.
                        scale = min(2.8, 2400 / max(width, height))
                        bitmap = page.render(scale=scale)
                        try:
                            img = bitmap.to_pil()
                            encoded, mime = _encode_page(img)
                            try:
                                text_page = page.get_textpage()
                                try:
                                    text = text_page.get_text_range()
                                finally:
                                    text_page.close()
                            except Exception:
                                # An unreadable text layer must not discard a usable page image.
                                text = ""
                            pages.append(PageImage(encoded, mime, index + 1, text))
                        finally:
                            bitmap.close()
                    finally:
                        page.close()
                return pages
            finally:
                doc.close()
        except DocumentError:
            raise
        except Exception as exc:
            raise DocumentError("This PDF cannot be read. Try exporting it again.") from exc

    # Do not trust browser-provided MIME type or filename extensions.
    try:
        with Image.open(BytesIO(data)) as image:
            if image.format not in {"JPEG", "PNG"}:
                raise DocumentError("Upload a PDF, JPG, or PNG file.")
            if image.width * image.height > 20_000_000:
                raise DocumentError("Image dimensions exceed the 20 megapixel limit. Resize and try again.")
            image.verify()
        with Image.open(BytesIO(data)) as image:
            encoded, mime = _encode_page(image)
            return [PageImage(encoded, mime, 1)]
    except DocumentError:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise DocumentError("Upload a valid PDF, JPG, or PNG file.") from exc


def reliable_page_text(text: str) -> bool:
    import unicodedata
    letters = sum(c.isalpha() for c in text)
    corrupted = sum(c == '\ufffd' or unicodedata.category(c) == 'Co' for c in text)
    return letters >= 10 and corrupted <= max(1, len(text) * .01)
