#!/usr/bin/env python3
"""
PDF Parser using Camelot for table extraction
Camelot is specifically designed for extracting tables from PDFs
"""

import sys
import json
import re
import camelot

def extract_section_profile_with_camelot(pdf_path, pages='1-10'):
    """Extract Section Profile table using Camelot
    
    Args:
        pdf_path: Path to PDF file
        pages: Page range string (e.g., '1-10', 'all'). Default '1-10' for Section Profile.
    """
    psr_data = []
    
    print(f"Extracting tables with Camelot from pages {pages}...", file=sys.stderr)
    
    try:
        # Try both flavors to find tables
        # flavor='lattice' for tables with borders, 'stream' for tables without borders
        print("Trying Camelot with 'lattice' flavor...", file=sys.stderr)
        tables_lattice = camelot.read_pdf(pdf_path, pages=pages, flavor='lattice')
        print(f"Lattice found {len(tables_lattice)} tables", file=sys.stderr)
        
        print("Trying Camelot with 'stream' flavor...", file=sys.stderr)
        tables_stream = camelot.read_pdf(pdf_path, pages=pages, flavor='stream')
        print(f"Stream found {len(tables_stream)} tables", file=sys.stderr)
        
        # Use whichever found more tables
        tables = tables_lattice if len(tables_lattice) > len(tables_stream) else tables_stream
        flavor_used = 'lattice' if len(tables_lattice) > len(tables_stream) else 'stream'
        
        print(f"Using '{flavor_used}' flavor with {len(tables)} tables", file=sys.stderr)
        
        # Look for the Section Profile table
        for idx, table in enumerate(tables):
            df = table.df
            
            # Check if this is the Section Profile table
            # Look for 8-column tables with MH ID patterns (e.g., "138-33-20-097")
            if df.shape[1] == 8 and df.shape[0] > 10:  # Exactly 8 columns and more than 10 rows
                print(f"\nCandidate table {idx}: shape {df.shape}, page {table.page}", file=sys.stderr)
                # Check if first few rows contain MH ID patterns (format: XXX-XX-XX-XXX)
                has_mh_pattern = False
                for i in range(min(5, len(df))):
                    row_text = ' '.join(df.iloc[i].astype(str).tolist())
                    # Look for MH ID pattern: numbers with dashes
                    if re.search(r'\d{3}-\d{2}-\d{2}-\d{3}', row_text):
                        has_mh_pattern = True
                        break
                
                if has_mh_pattern:
                    print(f"✓ Found Section Profile table at index {idx}", file=sys.stderr)
                    print(f"  Table shape: {df.shape}", file=sys.stderr)
                    
                    # Parse the table - start from row 0 since there's no header row
                    # (Camelot already skipped the header)
                    start_row = 0
                    entries_before = len(psr_data)
                    
                    # Check if first row looks like a header
                    first_row_text = ' '.join(df.iloc[0].astype(str).tolist()).lower()
                    if 'no.' in first_row_text or 'upstream' in first_row_text or 'psr' in first_row_text:
                        start_row = 1
                        print(f"  Skipping header row", file=sys.stderr)
                    
                    # DEBUG: Show first data row structure
                    if start_row < len(df):
                        sample_row = df.iloc[start_row]
                        print(f"  Sample row {start_row}: {list(sample_row)}", file=sys.stderr)
                    
                    # Extract data rows
                    for i in range(start_row, len(df)):
                        row = df.iloc[i]
                        
                        # Skip empty or summary rows
                        row_text = ' '.join(row.astype(str).tolist())
                        if 'circular' in row_text.lower() or not row_text.strip():
                            continue
                        
                        # Try to extract fields (order: No, PSR, Upstream MH, Downstream MH, Date, Material, Total Length, Length Surveyed)
                        try:
                            if len(row) >= 8:
                                # Check if all data is crammed in column 0 with newlines
                                col0 = str(row.iloc[0]).strip()
                                col1 = str(row.iloc[1]).strip()
                                
                                # If column 0 has newlines and other columns are empty, split on newlines
                                if '\n' in col0 and (not col1 or col1 == ''):
                                    parts = col0.split('\n')
                                    if len(parts) >= 8:
                                        no = parts[0].strip()
                                        psr = parts[1].strip()
                                        upstream_mh = parts[2].strip()
                                        downstream_mh = parts[3].strip()
                                        date = parts[4].strip()
                                        material = parts[5].strip()
                                        total_length = parts[6].strip()
                                        length_surveyed = parts[7].strip()
                                    else:
                                        continue
                                else:
                                    # Normal case: each column has its own data
                                    no = col0
                                    psr = col1
                                    upstream_mh = str(row.iloc[2]).strip()
                                    downstream_mh = str(row.iloc[3]).strip()
                                    date = str(row.iloc[4]).strip()
                                    material = str(row.iloc[5]).strip()
                                    total_length = str(row.iloc[6]).strip()
                                    length_surveyed = str(row.iloc[7]).strip()
                                
                                # DEBUG: Show first row validation
                                if i == start_row:
                                    print(f"  First row values: no={no}, psr={psr}, up={upstream_mh}, down={downstream_mh}", file=sys.stderr)
                                
                                # Validate that we have required fields
                                # Check: no and psr are numbers, MH IDs have dashes, not 'nan'
                                if (no and no != 'nan' and psr and psr != 'nan' and 
                                    '-' in upstream_mh and '-' in downstream_mh and
                                    upstream_mh != 'nan' and downstream_mh != 'nan'):
                                    
                                    # Convert no and psr to integers for proper sorting
                                    try:
                                        no_int = int(no)
                                        psr_int = int(psr)
                                    except ValueError:
                                        # Skip if not valid integers
                                        continue
                                    
                                    entry = {
                                        'no': no_int,  # Store as integer
                                        'psr': psr_int,  # Store as integer
                                        'upstreamMH': upstream_mh,
                                        'downstreamMH': downstream_mh,
                                        'date': date,
                                        'material': material,
                                        'totalLength': float(total_length) if total_length and total_length != 'nan' else 0.0,
                                        'lengthSurveyed': float(length_surveyed) if length_surveyed and length_surveyed != 'nan' else 0.0
                                    }
                                    psr_data.append(entry)
                                    
                                    # Log first entry from this table
                                    if i == start_row:
                                        print(f"  ✓ First entry valid: No.{entry['no']}, PSR {entry['psr']}", file=sys.stderr)
                                elif i == start_row:
                                    print(f"  ✗ First row failed validation", file=sys.stderr)
                        except (ValueError, IndexError) as e:
                            # Skip rows that don't parse correctly
                            if i == start_row:
                                print(f"  ✗ Error parsing first row: {e}", file=sys.stderr)
                            continue
                    
                    # Show how many entries were extracted from this table
                    entries_added = len(psr_data) - entries_before
                    print(f"  Extracted {entries_added} entries from this table", file=sys.stderr)
        
        print(f"Total extracted: {len(psr_data)} Section Profile entries", file=sys.stderr)
        
    except Exception as e:
        print(f"Camelot extraction error: {e}", file=sys.stderr)
    
    return psr_data

def extract_inspection_reports_text(pdf_path):
    """Extract inspection reports using text-based parsing (fallback to pdfminer)"""
    from pdfminer.high_level import extract_text
    
    reports = []
    
    try:
        text = extract_text(pdf_path)
        
        # Split by "Inspection report"
        sections = re.split(r'Inspection report', text, flags=re.IGNORECASE)
        
        for i, section in enumerate(sections[1:], 1):
            report = {}
            
            # Extract PSR (Pipe Segment Ref)
            psr_match = re.search(r'Pipe\s+Segment\s+Ref\.?:?\s*(\d+)', section, re.IGNORECASE) or \
                        re.search(r'PSR\s*:?\s*(\d+)', section, re.IGNORECASE)
            if psr_match:
                report['psr'] = psr_match.group(1)  # Keep as string for consistency
            
            # Extract Date
            date_match = re.search(r'Date:\s*(\d{1,2}/\d{1,2}/\d{4})', section)
            if date_match:
                report['date'] = date_match.group(1)
            
            # Extract Surveyed By
            surveyed_match = re.search(r'Surveyed\s+By:\s*([^\n]+)', section, re.IGNORECASE)
            if surveyed_match:
                report['surveyedBy'] = surveyed_match.group(1).strip()
            
            # Extract Certificate Number
            cert_match = re.search(r'Certificate\s+Number:\s*([^\n]+)', section, re.IGNORECASE)
            if cert_match:
                report['certificateNumber'] = cert_match.group(1).strip()
            
            # Extract Pre-cleaning / Pipe Cleaning
            cleaning_match = re.search(r'Pre-cleaning:\s*([^\n]+)', section, re.IGNORECASE) or \
                            re.search(r'Pipe\s+[Cc]leaning:\s*([^\n]+)', section, re.IGNORECASE)
            if cleaning_match:
                report['pipeCleaning'] = cleaning_match.group(1).strip()
            
            # Extract Direction
            direction_match = re.search(r'Direction:\s*([^\n]+)', section, re.IGNORECASE)
            if direction_match:
                report['direction'] = direction_match.group(1).strip()
            
            # Extract Total Length
            total_length_match = re.search(r'Total\s+Length:\s*([\d.]+)', section, re.IGNORECASE)
            if total_length_match:
                report['totalLength'] = float(total_length_match.group(1))
            
            # Extract Length Surveyed
            surveyed_length_match = re.search(r'Length\s+Surveyed:\s*([\d.]+)', section, re.IGNORECASE)
            if surveyed_length_match:
                report['lengthSurveyed'] = float(surveyed_length_match.group(1))
            
            # Extract Upstream MH
            upstream_match = re.search(r'Upstream\s+MH:\s*([\w\-]+)', section, re.IGNORECASE)
            if upstream_match:
                report['upstreamMH'] = upstream_match.group(1)
            
            # Extract Downstream MH
            downstream_match = re.search(r'Downstream\s+MH:\s*([\w\-]+)', section, re.IGNORECASE)
            if downstream_match:
                report['downstreamMH'] = downstream_match.group(1)
            
            # Extract City from Location Code (City field is empty, value is in Location Code)
            # Pattern: Location Code:\n\nHays, KS\n
            # We need to find the line after "Location Code:" that contains the city name
            location_code_idx = section.find('Location Code:')
            if location_code_idx != -1:
                # Get text after "Location Code:"
                after_location_code = section[location_code_idx + len('Location Code:'):]
                # Split by newlines and find first non-empty line that's not "Location Details:"
                lines = after_location_code.split('\n')
                for line in lines[:5]:  # Check first 5 lines after Location Code
                    line = line.strip()
                    if line and line != 'Location Details:' and not line.startswith('Sheet'):
                        # If it looks like "City, State" format
                        if ',' in line and any(char.isalpha() for char in line):
                            report['city'] = line.split(',')[0].strip()
                            break
            
            # Default to Hays if not found
            if 'city' not in report:
                report['city'] = 'Hays'
            
            # Extract Street from Drainage Area (Street field is empty, value is in Drainage Area)
            # Pattern: Drainage Area:\n\nHall & Canal, 32nd & 33rd Media Label:\n
            drainage_area_idx = section.find('Drainage Area:')
            if drainage_area_idx != -1:
                # Get text after "Drainage Area:"
                after_drainage = section[drainage_area_idx + len('Drainage Area:'):]
                # Find the line that contains street info (before "Media Label:" or "Upstream MH:")
                lines = after_drainage.split('\n')
                for line in lines[:5]:  # Check first 5 lines after Drainage Area
                    line = line.strip()
                    if line and 'Media Label:' not in line and 'Upstream MH:' not in line:
                        # Remove "Media Label:" suffix if present
                        line = re.sub(r'\s+Media Label:.*$', '', line).strip()
                        if line and line != 'Location Details:':
                            report['street'] = line
                            break
            
            # Extract Pipe Shape
            shape_match = re.search(r'Pipe\s+shape:\s*(\w+)', section, re.IGNORECASE)
            if shape_match:
                report['pipeShape'] = shape_match.group(1)
            
            # Extract Pipe Size
            size_match = re.search(r'Pipe\s+size:\s*([\d\s"]+?)(?:\s+Sewer Category:|\s+Purpose:|$)', section, re.IGNORECASE)
            if size_match:
                report['pipeSize'] = size_match.group(1).strip()
            
            # Extract Pipe Material
            material_match = re.search(r'Pipe\s+material:\s*([^\n]+?)(?:\s+Purpose:|\s+Lining Method:|$)', section, re.IGNORECASE)
            if material_match:
                report['pipeMaterial'] = material_match.group(1).strip()
            
            # Extract ratings - handle both proper format and concatenated format
            # Also look ahead into the next section since ratings can spill over
            ratings_section = section
            if i < len(sections) - 1:
                next_section = sections[i + 1]
                # Include first 2000 chars of next section, but stop at "Section Pictures" or next page marker
                end_idx = 2000
                section_pictures_idx = next_section.find('Section Pictures')
                page_marker_idx = next_section.find('// Page:')
                
                if section_pictures_idx != -1 and section_pictures_idx < end_idx:
                    end_idx = section_pictures_idx
                elif page_marker_idx != -1 and page_marker_idx < end_idx:
                    end_idx = page_marker_idx + 50
                
                end_idx = min(end_idx, len(next_section))
                ratings_section = section + '\n' + next_section[:end_idx]
            
            # Try proper format first (label on one line, value on next)
            qsr_match = re.search(r'QSR\s*:?\s*[\r\n]+\s*(\d+)', ratings_section, re.IGNORECASE)
            qmr_match = re.search(r'QMR\s*:?\s*[\r\n]+\s*(\d+)', ratings_section, re.IGNORECASE)
            qor_match = re.search(r'QOR\s*:?\s*[\r\n]+\s*(\d+)', ratings_section, re.IGNORECASE)
            spr_match = re.search(r'SPR\s*:?\s*[\r\n]+\s*([\d.]+)', ratings_section, re.IGNORECASE)
            mpr_match = re.search(r'MPR\s*:?\s*[\r\n]+\s*([\d.]+)', ratings_section, re.IGNORECASE)
            spri_match = re.search(r'SPRI\s*:?\s*[\r\n]+\s*([\d.]+)', ratings_section, re.IGNORECASE)
            mpri_match = re.search(r'MPRI\s*:?\s*[\r\n]+\s*([\d.]+)', ratings_section, re.IGNORECASE)
            opri_match = re.search(r'OPRI\s*:?\s*[\r\n]+\s*([\d.]+)', ratings_section, re.IGNORECASE)
            opr_match = re.search(r'OPR\s*:?\s*[\r\n]+\s*([\d.]+)', ratings_section, re.IGNORECASE)
            
            used_concatenated_format = False
            
            # If proper format didn't work, try concatenated format
            if not qsr_match:
                # Look for pattern: QSRQMR... on one line, then all numbers on the next
                concat_match = re.search(r'QSRQMR[^\n]*[\r\n]+\s*([\d.]+)', ratings_section, re.IGNORECASE)
                if concat_match:
                    numbers_line = concat_match.group(1)
                    # Extract QSR (4 digits), QMR (4 digits), then decimal ratings
                    if len(numbers_line) >= 8:
                        qsr_str = numbers_line[0:4]
                        qmr_str = numbers_line[4:8]
                        decimal_part = numbers_line[8:]
                        
                        # Extract all X.Y patterns (single digits only)
                        decimals = re.findall(r'\d\.\d', decimal_part)
                        
                        if qsr_str.isdigit() and qmr_str.isdigit() and len(decimals) >= 6:
                            report['qsr'] = int(qsr_str)
                            report['qmr'] = int(qmr_str)
                            # Corrected order based on visual layout: SPR, MPR, SPRI, MPRI, OPRI, OPR
                            report['spr'] = float(decimals[0])
                            report['mpr'] = float(decimals[1])
                            report['spri'] = float(decimals[2])
                            report['mpri'] = float(decimals[3])
                            report['opri'] = float(decimals[4])
                            report['opr'] = float(decimals[5])
                            used_concatenated_format = True
                
                # QOR appears separately even in concatenated format
                if not used_concatenated_format:
                    qor_match = re.search(r'QOR[\r\n]+\s*(\d+)', ratings_section, re.IGNORECASE)
                else:
                    qor_match = re.search(r'QOR[\r\n]+\s*(\d+)', ratings_section, re.IGNORECASE)
            
            # Apply matches from proper format only if we didn't use concatenated format
            if not used_concatenated_format:
                if qsr_match:
                    report['qsr'] = int(qsr_match.group(1))
                if qmr_match:
                    report['qmr'] = int(qmr_match.group(1))
                if qor_match:
                    report['qor'] = int(qor_match.group(1))
                if spr_match:
                    report['spr'] = float(spr_match.group(1))
                if mpr_match:
                    report['mpr'] = float(mpr_match.group(1))
                if spri_match:
                    report['spri'] = float(spri_match.group(1))
                if mpri_match:
                    report['mpri'] = float(mpri_match.group(1))
                if opri_match:
                    report['opri'] = float(opri_match.group(1))
                if opr_match:
                    report['opr'] = float(opr_match.group(1))
            else:
                # Even in concatenated format, apply QOR since it appears separately
                if qor_match:
                    report['qor'] = int(qor_match.group(1))
            
            # Only add if we have at least PSR
            if 'psr' in report:
                reports.append(report)
        
        print(f"Extracted {len(reports)} inspection reports", file=sys.stderr)
        
    except Exception as e:
        print(f"Error extracting inspection reports: {e}", file=sys.stderr)
    
    return reports

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'success': False, 'error': 'No PDF file path provided'}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    
    # Optional: page range for Section Profile (default: first 10 pages)
    section_profile_pages = sys.argv[2] if len(sys.argv) > 2 else '1-10'
    
    try:
        # Extract Section Profile using Camelot (table extraction)
        print(f"Section Profile pages: {section_profile_pages}", file=sys.stderr)
        section_profile = extract_section_profile_with_camelot(pdf_path, pages=section_profile_pages)
        
        # Extract Inspection Reports using text parsing
        inspection_reports = extract_inspection_reports_text(pdf_path)
        
        # Output JSON
        result = {
            'success': True,
            'data': {
                'sectionProfile': section_profile,
                'inspectionReports': inspection_reports,
                'metadata': {
                    'totalPSREntries': len(section_profile),
                    'totalInspectionReports': len(inspection_reports),
                    'totalObservations': 0
                }
            }
        }
        
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main()

