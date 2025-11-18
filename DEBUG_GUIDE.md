# PDF Parsing Debug Guide

## ✅ Verified Working with WinCan Format

The parser has been tested and verified to work with WinCan Section Profile tables that look like:

```
No.  PSR  Upstream MH      Downstream MH    Date         Material  Total Length  Length Surveyed
82   797  138-33-20-028    138-33-20-027    11/20/2024   VCP       61.20        61.20
```

## Changes Made

### 1. Improved Section Profile Extraction
- Finds "Section Profile" header in PDF
- Uses multiline regex to match line-by-line
- Handles MH format with dashes (e.g., 138-33-20-028)
- Validates each entry before adding
- Adds debug logging for troubleshooting

### 2. Cross-Reference Matching
- If PSR is missing from Inspection Report, matches it with Section Profile data
- Uses Upstream MH + Downstream MH + Date to find matches
- Automatically fills in missing Material data from Section Profile

### 3. Improved PSR Detection (`pdfParser.js`)
Added multiple regex patterns to detect PSR (Pipe Segment Reference) field:
- `Pipe Segment Ref.: 123`
- `PSR: 123`
- `Ref.: 123`
- `Segment Reference: 123`

All patterns are now case-insensitive and handle variations in formatting.

### 2. Enhanced Rating Data Extraction
Added fallback extraction for performance ratings when the table pattern doesn't match:
- QSR, QMR, QOR (Quality ratings)
- SPR, MPR, OPR (Performance ratings)
- SPRI, MPRI, OPRI (Performance indices)

Now tries both table-based and individual field extraction.

### 3. Debug Logging
Added console logging when PDFs are uploaded showing:
- Number of Section Profile entries found
- Number of Inspection Reports found
- Values of key fields (PSR, Date, MH locations, OPRI)

### 4. Debug API Endpoint
New endpoint: `GET /api/data/:id/debug`

Returns:
- Preview of raw PDF text
- All fields found in first inspection report
- Field extraction status (found vs missing)

## How to Debug Your PDF

### Step 1: Check Backend Console
After uploading a PDF, check the backend terminal for output like:

```
=== PDF Parsing Results ===
Filename: your_file.pdf
Section Profile entries: 5
Inspection Reports: 5

First Inspection Report Fields:
  PSR: NOT FOUND    <-- This tells you what's missing
  Date: 1/15/2024
  Upstream MH: MH-1
  Downstream MH: MH-2
  OPRI: 2.5
=========================
```

### Step 2: Use Debug Endpoint
After uploading a PDF, note the `dataId` from the response.

Then visit: `http://localhost:3001/api/data/[dataId]/debug`

This shows:
1. Raw text preview from the PDF
2. Exact fields extracted
3. Missing fields marked as `null`

### Step 3: Compare Patterns
Look at the raw text preview and compare it to the regex patterns in `pdfParser.js`:

**For PSR (lines 52-56):**
```javascript
/Pipe\s+Segment\s+Ref\.?:?\s*(\d+)/i
/PSR\s*:?\s*(\d+)/i
/Ref\.?:?\s*(\d+)/
/Segment\s+(?:Reference|Ref)\.?:?\s*(\d+)/i
```

**For Ratings (lines 125-150):**
```javascript
/QSR\s*:?\s*(\d+)/i
/OPRI\s*:?\s*([\d.]+)/i
// ... etc
```

### Step 4: Test Specific Pattern
If you see text like "Pipe Segment: 123" but PSR isn't found, you may need to add a pattern like:
```javascript
section.match(/Pipe\s+Segment\s*:?\s*(\d+)/i)
```

## Common Issues

### PSR shows "N/A"
- Check if PDF uses different terminology (e.g., "Segment ID", "Pipe ID")
- Look at debug endpoint to see actual text format
- May need to add new regex pattern

### OPRI and ratings show "N/A"
- Check if ratings are in a table or labeled format
- Table format: `3 2 1 4.5 3.2 2.1 4.1 3.0 2.5`
- Labeled format: `OPRI: 2.5`
- Current code tries both

### Some fields work, others don't
- PDF text extraction may have unexpected spacing/formatting
- Use debug endpoint to see raw text
- Adjust regex patterns for your specific PDF format

## Next Steps

1. **Upload your PDF** to the app
2. **Check backend console** for immediate feedback
3. **Visit debug endpoint** to see raw text and extracted fields
4. **Share findings** if you need help adjusting patterns

## Example Debug Response

```json
{
  "success": true,
  "debug": {
    "textPreview": "Inspection report\nDate: 1/15/2024\nPipe Segment Ref.: 1\n...",
    "firstReportFields": {
      "psr": "1",
      "date": "1/15/2024",
      "upstreamMH": "MH-1",
      "downstreamMH": "MH-2",
      "opri": 2.5,
      "allFields": ["psr", "date", "upstreamMH", "downstreamMH", "opri", "observations"]
    },
    "totalReports": 5,
    "totalSectionProfile": 5
  }
}
```

If `psr: null`, the field wasn't found and you need to check the text format.

