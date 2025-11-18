# Python PDF Parser Setup

## Why Python?

JavaScript PDF parsers struggle with table extraction because they don't preserve spacing properly. **pdfminer** (Python) is the gold standard for PDF table extraction.

## Installation Steps

### 1. Install Python

**Windows:**
- Download from https://python.org (Python 3.8 or higher)
- **IMPORTANT:** Check "Add Python to PATH" during installation

**Mac/Linux:**
```bash
# Mac
brew install python3

# Ubuntu/Debian
sudo apt-get install python3 python3-pip
```

### 2. Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

Or manually:
```bash
pip install pdfminer.six
```

### 3. Verify Installation

```bash
python --version    # Should show Python 3.x
python -c "import pdfminer; print('pdfminer OK')"
```

### 4. Restart Backend

```bash
cd backend
npm start
```

## How It Works

### Parser Priority

1. **Python pdfminer** (best) - Tries first, preserves layout perfectly
2. **pdf2json** (good) - Fallback, uses positioning data
3. **pdf-parse** (basic) - Last resort, simple text extraction

### What Happens When You Upload

```
Attempting parse with Python pdfminer...
=== Python PDFMiner Parsing ===
Python: Extracted text length: 150000
Python: First 500 chars:
Section Profile
No.  PSR  Upstream MH  ...
Python: Extracted 40 Section Profile entries
Python: Extracted 40 Inspection Reports
✓ Successfully parsed with Python pdfminer
  Section Profile entries: 40
  Inspection Reports: 40

First 3 Section Profile entries:
  1. No.82, PSR 797, 138-33-20-028 → 138-33-20-027
  2. No.91, PSR 787, 138-33-20-018 → 138-33-20-017
  3. No.191, PSR 642, 138-28-40-050 → 138-28-40-049
```

## Troubleshooting

### "Python not found"

- Make sure Python is installed and in PATH
- Try `python3` instead of `python` (on Mac/Linux)
- Restart terminal after installing Python

### "No module named 'pdfminer'"

```bash
pip install pdfminer.six
# or
pip3 install pdfminer.six
```

### Python works but no data extracted

Check backend console for:
- "Extracted text length: 0" → PDF might be scanned/image-based
- Pattern match issues → Share output with developer

### Still not working?

The app will automatically fall back to JavaScript parsers, but they may have spacing issues.

## Testing Python Parser Directly

You can test the Python parser independently:

```bash
cd backend
python pdfParser.py "path/to/your/file.pdf"
```

This outputs JSON with all extracted data.

## Benefits of Python Parser

✓ **Perfect spacing** - Preserves layout exactly
✓ **All data captured** - No missing No.2, PSR 408, etc.
✓ **Robust** - Handles complex PDF structures
✓ **Industry standard** - pdfminer is used in production everywhere

