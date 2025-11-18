#!/usr/bin/env python3
"""
PDF Parser using pdfminer.six for better table extraction
This preserves layout and spacing properly
"""

import sys
import json
import re
from io import StringIO
from pdfminer.high_level import extract_text_to_fp
from pdfminer.layout import LAParams

def extract_section_profile(text):
    """Extract Section Profile data from PDF text with vertical layout handling"""
    psr_data = []
    
    # Find Section Profile section - grab EVERYTHING until "Inspection report"
    # This handles multi-page tables with repeated headers
    section_match = re.search(r'Section Profile(.*?)(?=Inspection report|$)', text, re.DOTALL | re.IGNORECASE)
    
    if not section_match:
        print("No Section Profile section found", file=sys.stderr)
        return psr_data
    
    section = section_match.group(1)
    print(f"Section Profile text length: {len(section)} chars", file=sys.stderr)
    
    # Try horizontal layout first (rows)
    lines = section.split('\n')
    horizontal_matches = 0
    
    for line in lines:
        # Skip headers and empty lines
        if not line.strip() or 'No.' in line or 'PSR' in line or 'Upstream' in line or 'Circular' in line or 'Surveyed' in line:
            continue
        
        # Pattern with proper spacing (normal table layout)
        match = re.match(r'\s*(\d+)\s+(\d+)\s+([\d\-A-Z]+)\s+([\d\-A-Z]+)\s+(\d{1,2}/\d{1,2}/\d{4})\s+([A-Z]+)\s+([\d.]+)\s+([\d.]+)', line)
        
        if match:
            horizontal_matches += 1
            entry = {
                'no': int(match.group(1)),  # Convert to int for proper sorting
                'psr': int(match.group(2)),  # Convert to int for proper sorting
                'upstreamMH': match.group(3),
                'downstreamMH': match.group(4),
                'date': match.group(5),
                'material': match.group(6),
                'totalLength': float(match.group(7)),
                'lengthSurveyed': float(match.group(8))
            }
            psr_data.append(entry)
    
    # If horizontal didn't work, try vertical layout (column-based extraction)
    if horizontal_matches == 0:
        print("Trying vertical/column-based extraction...", file=sys.stderr)
        
        # Strategy: The PDF has a vertical layout where each column's values are listed top-to-bottom
        # We need to extract each column separately, handling repeated headers across pages
        
        # Find all individual numbers, MH IDs, dates, materials (in order as they appear)
        # Then match them up based on their positions
        
        # Split section into lines to process sequentially  
        lines = [line.strip() for line in section.split('\n') if line.strip()]
        
        # Use state machine to track which column we're currently reading
        current_state = 'unknown'
        nos_temp = []
        psrs_temp = []
        mh_ids_temp = []
        dates_temp = []
        materials_temp = []
        lengths_temp = []
        
        # Simpler approach: collect all data by type, then match up based on MH ID count
        # PSR numbers typically appear just before MH IDs
        
        for i, line in enumerate(lines):
            # Skip headers and summary lines
            if line in ['No.', 'PSR', 'Upstream MH', 'Downstream MH', 'Date', 'Material', 'Total Length', 'Length', 'Surveyed', 'Project', '2024 Sewerline Cleaning & CCTV- Hays_ KS', 'Section Profile']:
                continue
            if 'Circular' in line or 'Total Length (' in line:
                continue
            
            # Classify by pattern
            # MH ID pattern
            if re.match(r'^\d{2,3}-\d{2}-\d{2}-\d{3}[A-Z]?$', line):
                # Check if previous line was a number (likely PSR)
                if i > 0 and re.match(r'^\d+$', lines[i-1]) and lines[i-1] not in ['No.', 'PSR']:
                    psr_candidate = lines[i-1]
                    if psr_candidate not in psrs_temp:  # Avoid duplicates
                        psrs_temp.append(psr_candidate)
                mh_ids_temp.append(line)
            # Date pattern
            elif re.match(r'^\d{1,2}/\d{1,2}/\d{4}$', line):
                dates_temp.append(line)
            # Material pattern
            elif line in ['VCP', 'PVC', 'RCP', 'CMP', 'DIP']:
                materials_temp.append(line)
            # Length pattern
            elif re.match(r'^\d+\.\d{2}$', line):
                lengths_temp.append(line)
        
        print(f"Extracted: {len(nos_temp)} No., {len(psrs_temp)} PSR, {len(mh_ids_temp)} MH IDs, {len(dates_temp)} dates, {len(materials_temp)} materials, {len(lengths_temp)} lengths", file=sys.stderr)
        
        # Pair up MH IDs (upstream/downstream)
        mh_pairs = []
        for i in range(0, len(mh_ids_temp) - 1, 2):
            mh_pairs.append((mh_ids_temp[i], mh_ids_temp[i+1]))
        
        # Now match everything up - each entry needs: No, PSR, MH pair, date, material, 2 lengths
        # Base count on MH pairs (most reliable), use PSRs where available, generate No. sequentially
        min_count = min(len(mh_pairs), len(dates_temp), len(materials_temp), len(lengths_temp) // 2)
        
        print(f"Building {min_count} entries (have {len(psrs_temp)} PSRs)...", file=sys.stderr)
        
        for i in range(min_count):
            length_idx = i * 2
            
            # Convert PSR to int if available
            psr_val = psrs_temp[i] if i < len(psrs_temp) else '0'
            try:
                psr_int = int(psr_val)
            except (ValueError, TypeError):
                psr_int = 0
            
            entry = {
                'no': i + 1,  # Generate sequential No. as integer
                'psr': psr_int,  # Store as integer for proper sorting
                'upstreamMH': mh_pairs[i][0],
                'downstreamMH': mh_pairs[i][1],
                'date': dates_temp[i] if i < len(dates_temp) else '',
                'material': materials_temp[i] if i < len(materials_temp) else '',
                'totalLength': float(lengths_temp[length_idx]) if length_idx < len(lengths_temp) else 0.0,
                'lengthSurveyed': float(lengths_temp[length_idx + 1]) if length_idx + 1 < len(lengths_temp) else 0.0
            }
            psr_data.append(entry)
            if i < 5:  # Show first 5
                print(f"Extracted entry: No.{entry['no']}, PSR {entry['psr']}, {entry['upstreamMH']} → {entry['downstreamMH']}", file=sys.stderr)
    
    # Deduplicate entries (same PSR + MH combination)
    seen = set()
    unique_data = []
    for entry in psr_data:
        key = f"{entry['psr']}-{entry['upstreamMH']}-{entry['downstreamMH']}"
        if key not in seen:
            unique_data.append(entry)
            seen.add(key)
    
    print(f"Total: {len(psr_data)} entries, {len(unique_data)} unique", file=sys.stderr)
    if unique_data:
        print(f"PSR range: {unique_data[0]['psr']} to {unique_data[-1]['psr']}", file=sys.stderr)
    
    return unique_data

def extract_inspection_reports(text):
    """Extract Inspection Report data"""
    reports = []
    
    # Split by "Inspection report"
    sections = re.split(r'Inspection report', text, flags=re.IGNORECASE)
    
    for i, section in enumerate(sections[1:], 1):  # Skip first (before first report)
        report = {}
        
        # Extract fields
        date_match = re.search(r'Date:\s*(\d{1,2}/\d{1,2}/\d{4})', section)
        if date_match:
            report['date'] = date_match.group(1)
        
        cert_match = re.search(r'Certificate Number:\s*([\w\-]+)', section)
        if cert_match:
            report['certificateNumber'] = cert_match.group(1)
        
        psr_match = re.search(r'Pipe\s+Segment\s+Ref\.?:?\s*(\d+)', section, re.IGNORECASE) or \
                    re.search(r'PSR\s*:?\s*(\d+)', section, re.IGNORECASE) or \
                    re.search(r'Ref\.?:?\s*(\d+)', section)
        if psr_match:
            report['psr'] = psr_match.group(1)
        
        surveyed_by_match = re.search(r'Surveyed By:\s*([^\n]+)', section)
        if surveyed_by_match:
            report['surveyedBy'] = surveyed_by_match.group(1).strip()
        
        upstream_match = re.search(r'Upstream MH:\s*([\w\-]+)', section)
        if upstream_match:
            report['upstreamMH'] = upstream_match.group(1)
        
        downstream_match = re.search(r'Downstream MH:\s*([\w\-]+)', section)
        if downstream_match:
            report['downstreamMH'] = downstream_match.group(1)
        
        shape_match = re.search(r'Pipe shape:\s*(\w+)', section)
        if shape_match:
            report['pipeShape'] = shape_match.group(1)
        
        size_match = re.search(r'Pipe size:\s*([\d\s"]+?)(?:\s+Sewer Category:|\s+Purpose:|$)', section)
        if size_match:
            report['pipeSize'] = size_match.group(1).strip()
        
        material_match = re.search(r'Pipe material:\s*([^\n]+?)(?:\s+Purpose:|\s+Lining Method:|$)', section)
        if material_match:
            report['pipeMaterial'] = material_match.group(1).strip()
        
        total_length_match = re.search(r'Total Length:\s*([\d.]+)\s*[\'"]', section)
        if total_length_match:
            report['totalLength'] = float(total_length_match.group(1))
        
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
        
        street_match = re.search(r'Street:\s*([^\n]+)', section)
        if street_match:
            report['street'] = street_match.group(1).strip()
        
        city_match = re.search(r'City:\s*([^\n]+)', section)
        if city_match:
            report['city'] = city_match.group(1).strip()
        
        # Extract observations
        observations = []
        obs_pattern = r'([\d.]+)\s+([A-Z]+)\s+([^\n]+?)\s+(\d{2}:\d{2}:\d{2})'
        for obs_match in re.finditer(obs_pattern, section):
            observations.append({
                'distance': float(obs_match.group(1)),
                'code': obs_match.group(2),
                'observation': obs_match.group(3).strip(),
                'counter': obs_match.group(4)
            })
        
        if observations:
            report['observations'] = observations
        
        if report:  # Only add if we found something
            reports.append(report)
    
    return reports

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'success': False, 'error': 'No PDF file path provided'}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    
    try:
        # Extract text with layout preservation
        output_string = StringIO()
        with open(pdf_path, 'rb') as pdf_file:
            # LAParams tuned for table extraction (wider margins to keep rows together)
            laparams = LAParams(
                line_margin=0.3,      # Tighter line grouping
                word_margin=0.05,     # Smaller word gaps
                char_margin=1.0,      # Tighter char grouping
                boxes_flow=0.5,       # Try to maintain reading order
                detect_vertical=False # Don't treat as vertical text
            )
            extract_text_to_fp(pdf_file, output_string, laparams=laparams)
        
        text = output_string.getvalue()
        
        # Save raw extracted text to file for debugging
        debug_output_path = pdf_path.replace('.pdf', '_extracted_text.txt')
        try:
            with open(debug_output_path, 'w', encoding='utf-8') as f:
                f.write(text)
            print(f"Saved extracted text to: {debug_output_path}", file=sys.stderr)
        except Exception as e:
            print(f"Could not save debug text: {e}", file=sys.stderr)
        
        # Debug: print first 500 chars to stderr
        print(f"Extracted text length: {len(text)}", file=sys.stderr)
        print(f"First 500 chars:\n{text[:500]}", file=sys.stderr)
        
        # Extract data
        section_profile = extract_section_profile(text)
        inspection_reports = extract_inspection_reports(text)
        
        print(f"Extracted {len(section_profile)} Section Profile entries", file=sys.stderr)
        print(f"Extracted {len(inspection_reports)} Inspection Reports", file=sys.stderr)
        
        # Output JSON
        result = {
            'success': True,
            'data': {
                'sectionProfile': section_profile,
                'inspectionReports': inspection_reports,
                'metadata': {
                    'totalPSREntries': len(section_profile),
                    'totalInspectionReports': len(inspection_reports),
                    'totalObservations': sum(len(r.get('observations', [])) for r in inspection_reports)
                }
            }
        }
        
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main()

