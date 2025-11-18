# Camelot PDF Table Extraction Setup

## Why Camelot?

**Camelot** is specifically designed for extracting tables from PDFs and handles complex table structures much better than text-based parsing. Perfect for Section Profile tables!

## Installation

### 1. Install Ghostscript (Required for Camelot)

**Windows:**
1. Download Ghostscript from: https://ghostscript.com/releases/gsdnload.html
2. Install the 64-bit version
3. Add to PATH (usually `C:\Program Files\gs\gs10.XX.X\bin`)

**Mac:**
```bash
brew install ghostscript
```

**Linux:**
```bash
sudo apt-get install ghostscript
```

### 2. Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

This installs:
- `camelot-py[cv]` - Table extraction library
- `opencv-python` - Image processing for table detection
- `pdfminer.six` - Fallback for text extraction

### 3. Verify Installation

```bash
python -c "import camelot; print('Camelot OK')"
python -c "import cv2; print('OpenCV OK')"
```

### 4. Restart Backend

```bash
cd backend
npm start
```

## How It Works

### Camelot (Default)
- **Purpose:** Extract Section Profile table
- **Method:** Detects table structure using layout analysis
- **Accuracy:** High - preserves rows/columns properly
- **Output:** Structured DataFrame → JSON

### PDFMiner (Fallback)
- **Purpose:** Extract Inspection Reports (text-based)
- **Method:** Text extraction with regex patterns
- **Use:** When Camelot fails or for non-table data

## What You'll See

```
=== Python Camelot (table extraction) Parsing ===
Python: Extracting tables with Camelot...
Python: Found 15 tables in PDF
Python: Found Section Profile table at index 0
Python: Table shape: (425, 8)
Python: Extracted: No.82, PSR 797
Python: Extracted: No.91, PSR 787
Python: Extracted: No.191, PSR 642
...
Python: Total extracted: 422 Section Profile entries
✓ Successfully parsed with Python Camelot (table extraction)
  Section Profile entries: 422
  Inspection Reports: 420
```

## Troubleshooting

### "No module named 'camelot'"
```bash
pip install camelot-py[cv]
```

### "Ghostscript not found"
- Install Ghostscript (see step 1)
- Make sure it's in your PATH
- Restart terminal after installation

### "No module named 'cv2'"
```bash
pip install opencv-python
```

### Camelot finds 0 tables
- PDF might have tables without borders
- Try switching to 'lattice' flavor in code
- Or fall back to pdfminer parsing

### Still not working?
- Check backend console for specific error
- Share error message for help
- System will fall back to pdfminer automatically

## Benefits Over Text Parsing

✓ **Accurate column detection** - No confusion between No. and PSR
✓ **Handles multi-page tables** - Automatically continues across pages
✓ **Preserves table structure** - Rows and columns stay aligned
✓ **Ignores repeated headers** - Filters out header rows
✓ **Fast processing** - Table extraction is optimized

## Testing

Upload your PDF and check:
1. **422 ± 2 entries** should be extracted
2. **No. and PSR correctly separated**
3. **All MH IDs, dates, materials present**
4. **Fast processing** (< 10 seconds)

If Camelot works well, you'll see consistent, accurate data extraction! 🎯

