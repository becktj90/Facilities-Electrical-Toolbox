# Revit Panel Schedule OCR

A static single-page web application for extracting circuit data from Revit panel schedule images and printing a clean half-sheet panel schedule.

## Features

- Client-side OCR with **Tesseract.js** loaded from a CDN
- Drag-and-drop image upload plus a classic file picker
- Editable circuit grid for fixing OCR mistakes before printing
- Professional print layout sized to **4.25 in × 11 in** for half-sheet cardstock
- Static hosting compatibility with **GitHub Pages**

## Usage

1. Open `index.html` in a modern web browser.
2. Upload or drag in a Revit panel schedule image.
3. Click **Read Schedule** to run OCR.
4. Review the extracted text and editable circuit table.
5. Click **Print Schedule** for the clean half-sheet output.

## Notes

- OCR accuracy depends heavily on image quality, alignment, and contrast.
- If OCR misses fields, edit the raw text or table manually before printing.
- No build step or backend is required.
