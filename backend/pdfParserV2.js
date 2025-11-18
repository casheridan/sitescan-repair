const PDFParser = require("pdf2json");

/**
 * Parse PDF using pdf2json which preserves positioning
 * This handles tables much better than pdf-parse
 */
async function parsePDFWithPositioning(dataBuffer) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    
    pdfParser.on("pdfParser_dataError", (errData) => {
      console.error('PDF Parser Error:', errData.parserError);
      reject(new Error(errData.parserError));
    });
    
    pdfParser.on("pdfParser_dataReady", (pdfData) => {
      try {
        console.log('\n=== PDF2JSON Parsing ===');
        console.log(`Total pages: ${pdfData.Pages.length}`);
        
        // Use POSITIONING data to reconstruct proper spacing
        let rawText = '';
        
        for (const page of pdfData.Pages) {
          if (page.Texts) {
            // Group text items by Y position (rows) and sort by X position (columns)
            const textItems = page.Texts.map(item => ({
              x: item.x,
              y: item.y,
              text: item.R && item.R.length > 0 ? decodeURIComponent(item.R[0].T) : ''
            })).filter(item => item.text.trim().length > 0);
            
            // Group by Y position (same row = similar Y value)
            const rows = {};
            const yThreshold = 0.5; // Items within 0.5 units are same row
            
            for (const item of textItems) {
              // Find existing row with similar Y
              let rowKey = null;
              for (const existingY of Object.keys(rows)) {
                if (Math.abs(parseFloat(existingY) - item.y) < yThreshold) {
                  rowKey = existingY;
                  break;
                }
              }
              
              if (rowKey === null) {
                rowKey = item.y.toFixed(2);
                rows[rowKey] = [];
              }
              
              rows[rowKey].push(item);
            }
            
            // Sort rows by Y position (top to bottom)
            const sortedRowKeys = Object.keys(rows).sort((a, b) => parseFloat(a) - parseFloat(b));
            
            for (const rowKey of sortedRowKeys) {
              // Sort items in row by X position (left to right)
              const rowItems = rows[rowKey].sort((a, b) => a.x - b.x);
              
              let rowText = '';
              let lastX = 0;
              
              for (let i = 0; i < rowItems.length; i++) {
                const item = rowItems[i];
                const xGap = item.x - lastX;
                
                // Add spaces based on X position gap
                if (i > 0 && xGap > 1) {
                  // Significant gap = add space(s)
                  const numSpaces = Math.max(1, Math.floor(xGap / 2));
                  rowText += ' '.repeat(numSpaces);
                }
                
                rowText += item.text;
                lastX = item.x + item.text.length;
              }
              
              rawText += rowText + '\n';
            }
          }
        }
        
        console.log('Raw text extracted with positioning, length:', rawText.length);
        console.log('First 800 chars:\n', rawText.substring(0, 800));
        
        if (rawText.length === 0) {
          throw new Error('No text extracted from PDF - pdf2json failed');
        }
        
        // Extract section profile data using better text
        const sectionProfile = extractSectionProfileFromText(rawText);
        
        // Extract inspection reports
        const inspectionReports = extractInspectionReportsFromText(rawText);
        
        resolve({
          success: true,
          rawText: rawText,
          data: {
            sectionProfile: sectionProfile,
            inspectionReports: inspectionReports,
            metadata: {
              totalPages: pdfData.Pages.length,
              totalPSREntries: sectionProfile.length,
              totalInspectionReports: inspectionReports.length,
              totalObservations: inspectionReports.reduce((sum, r) => 
                sum + (r.observations ? r.observations.length : 0), 0)
            }
          }
        });
      } catch (error) {
        console.error('Error processing PDF data:', error);
        reject(error);
      }
    });
    
    // Parse the buffer
    pdfParser.parseBuffer(dataBuffer);
  });
}

/**
 * Extract Section Profile data from text with proper spacing
 */
function extractSectionProfileFromText(text) {
  const psrData = [];
  
  console.log('\n=== Section Profile Extraction (pdf2json) ===');
  
  // Find Section Profile section
  const sectionMatch = text.match(/Section Profile[\s\S]*?(?=\n\n\n|\nInspection report|$)/i);
  
  if (!sectionMatch) {
    console.log('❌ No Section Profile section found');
    return psrData;
  }
  
  console.log('✓ Found Section Profile section');
  const section = sectionMatch[0];
  
  // Split into lines
  const lines = section.split('\n');
  
  for (const line of lines) {
    // Skip headers and empty lines
    if (!line.trim() || 
        line.includes('No.') || 
        line.includes('PSR') || 
        line.includes('Upstream') ||
        line.includes('Circular') ||
        line.includes('Total Length') ||
        line.includes('Surveyed')) {
      continue;
    }
    
    // Pattern with proper spacing (pdf2json should preserve this better)
    // Try spaced pattern first
    const spacedMatch = line.match(/^\s*(\d+)\s+(\d+)\s+([\d\-A-Z]+)\s+([\d\-A-Z]+)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+([A-Z]+)\s+([\d.]+)\s+([\d.]+)/);
    
    if (spacedMatch) {
      const entry = {
        no: spacedMatch[1],
        psr: spacedMatch[2],
        upstreamMH: spacedMatch[3],
        downstreamMH: spacedMatch[4],
        date: spacedMatch[5],
        material: spacedMatch[6],
        totalLength: parseFloat(spacedMatch[7]),
        lengthSurveyed: parseFloat(spacedMatch[8])
      };
      psrData.push(entry);
      if (psrData.length <= 5) {
        console.log(`  Entry ${psrData.length}: No.${entry.no}, PSR ${entry.psr}, ${entry.upstreamMH} → ${entry.downstreamMH}`);
      }
    } else {
      // Try no-space pattern as fallback
      // Find MH IDs first
      const mhPattern = /(\d{2,3}-\d{2}-\d{2}-\d{3}[A-Z]?)/g;
      const mhMatches = [...line.matchAll(mhPattern)];
      
      if (mhMatches.length >= 2) {
        const upstreamMH = mhMatches[0][0];
        const downstreamMH = mhMatches[1][0];
        const mhStartIdx = line.indexOf(upstreamMH);
        const beforeMH = line.substring(0, mhStartIdx).trim();
        
        // Try to split No and PSR
        const digitsMatch = beforeMH.match(/^(\d+)$/);
        if (digitsMatch) {
          const allDigits = digitsMatch[1];
          let no, psr;
          
          // Smart split based on length
          if (allDigits.length === 4) {
            no = allDigits[0];
            psr = allDigits.substring(1);
          } else if (allDigits.length === 5) {
            no = allDigits.substring(0, 2);
            psr = allDigits.substring(2);
          } else if (allDigits.length === 6) {
            no = allDigits.substring(0, 3);
            psr = allDigits.substring(3);
          } else if (allDigits.length >= 7) {
            no = allDigits.substring(0, allDigits.length - 4);
            psr = allDigits.substring(allDigits.length - 4);
          } else {
            continue;
          }
          
          const afterMH = line.substring(line.indexOf(downstreamMH) + downstreamMH.length);
          const restMatch = afterMH.match(/^(\d{1,2}\/\d{1,2}\/\d{4})([A-Z]{2,4})([\d.]+)([\d.]+)/);
          
          if (restMatch) {
            const entry = {
              no: no,
              psr: psr,
              upstreamMH: upstreamMH,
              downstreamMH: downstreamMH,
              date: restMatch[1],
              material: restMatch[2],
              totalLength: parseFloat(restMatch[3]),
              lengthSurveyed: parseFloat(restMatch[4])
            };
            psrData.push(entry);
            if (psrData.length <= 5) {
              console.log(`  Entry ${psrData.length}: No.${entry.no}, PSR ${entry.psr}, ${entry.upstreamMH} → ${entry.downstreamMH}`);
            }
          }
        }
      }
    }
  }
  
  console.log(`✓ Total Extracted: ${psrData.length} Section Profile entries`);
  return psrData;
}

/**
 * Extract Inspection Report data
 */
function extractInspectionReportsFromText(text) {
  const reports = [];
  
  // Split by "Inspection report"
  const reportSections = text.split(/Inspection report/i);
  
  for (let i = 1; i < reportSections.length; i++) {
    const section = reportSections[i];
    const report = {};
    
    // IMPORTANT: Ratings tables appear at the BEGINNING of the NEXT section
    // So we need to also check the next section for ratings that belong to THIS report
    let ratingsSection = section;
    if (i + 1 < reportSections.length) {
      // Include part of the next section to capture ratings that belong to THIS report
      // Ratings typically appear after observations, before "Section Pictures" or the next report header
      const nextSection = reportSections[i + 1];
      
      // Strategy: Look for ratings (QSR/OPRI etc) and include up to just after them
      // Or include a reasonable amount (2000 chars) if we can't find a clear boundary
      let endIdx = 2000; // Default: include first 2000 chars
      
      // Try to find where ratings end (look for "Section Pictures", page markers, or next report)
      const sectionPicturesIdx = nextSection.search(/Section Pictures/i);
      const pageMarkerIdx = nextSection.search(/\/\/ Page:/i);
      
      if (sectionPicturesIdx !== -1 && sectionPicturesIdx < endIdx) {
        endIdx = sectionPicturesIdx;
      } else if (pageMarkerIdx !== -1 && pageMarkerIdx < endIdx) {
        endIdx = pageMarkerIdx + 50; // Include a bit past the page marker
      }
      
      endIdx = Math.min(endIdx, nextSection.length);
      ratingsSection = section + '\n' + nextSection.substring(0, endIdx);
    }
    
    // Extract fields (same logic as before)
    const dateMatch = section.match(/Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (dateMatch) report.date = dateMatch[1];
    
    const certMatch = section.match(/Certificate Number:\s*([\w\-]+)/);
    if (certMatch) report.certificateNumber = certMatch[1];
    
    const psrMatch = section.match(/Pipe\s+Segment\s+Ref\.?:?\s*(\d+)/i) || 
                     section.match(/PSR\s*:?\s*(\d+)/i) ||
                     section.match(/Ref\.?:?\s*(\d+)/);
    if (psrMatch) report.psr = psrMatch[1];
    
    const surveyedByMatch = section.match(/Surveyed By:\s*([^\n]+)/);
    if (surveyedByMatch) report.surveyedBy = surveyedByMatch[1].trim();
    
    const upstreamMatch = section.match(/Upstream MH:\s*([\w\-]+)/);
    if (upstreamMatch) report.upstreamMH = upstreamMatch[1];
    
    const downstreamMatch = section.match(/Downstream MH:\s*([\w\-]+)/);
    if (downstreamMatch) report.downstreamMH = downstreamMatch[1];
    
    const shapeMatch = section.match(/Pipe shape:\s*(\w+)/);
    if (shapeMatch) report.pipeShape = shapeMatch[1];
    
    const sizeMatch = section.match(/Pipe size:\s*([\d\s"]+?)(?:\s+Sewer Category:|\s+Purpose:|$)/);
    if (sizeMatch) report.pipeSize = sizeMatch[1].trim();
    
    const materialMatch = section.match(/Pipe material:\s*([^\n]+?)(?:\s+Purpose:|\s+Lining Method:|$)/);
    if (materialMatch) report.pipeMaterial = materialMatch[1].trim();
    
    const totalLengthMatch = section.match(/Total Length:\s*([\d.]+)\s*['"]/);
    if (totalLengthMatch) report.totalLength = parseFloat(totalLengthMatch[1]);
    
    // Extract ratings
    // NOTE: Ratings often appear at the START of the NEXT section, so we use ratingsSection
    // Ratings format: Label on one line, value on next line (with optional colon after label)
    // Use more restrictive patterns to avoid matching across multiple fields
    const opriMatch = ratingsSection.match(/OPRI\s*:?\s*[\r\n]+\s*([\d.]+)/i);
    if (opriMatch) report.opri = parseFloat(opriMatch[1]);
    
    const qsrMatch = ratingsSection.match(/QSR\s*:?\s*[\r\n]+\s*(\d+)/i);
    if (qsrMatch) report.qsr = parseInt(qsrMatch[1]);
    
    const qmrMatch = ratingsSection.match(/QMR\s*:?\s*[\r\n]+\s*(\d+)/i);
    if (qmrMatch) report.qmr = parseInt(qmrMatch[1]);
    
    const qorMatch = ratingsSection.match(/QOR\s*:?\s*[\r\n]+\s*(\d+)/i);
    if (qorMatch) report.qor = parseInt(qorMatch[1]);
    
    const sprMatch = ratingsSection.match(/SPR\s*:?\s*[\r\n]+\s*([\d.]+)/i);
    if (sprMatch) report.spr = parseFloat(sprMatch[1]);
    
    const mprMatch = ratingsSection.match(/MPR\s*:?\s*[\r\n]+\s*([\d.]+)/i);
    if (mprMatch) report.mpr = parseFloat(mprMatch[1]);
    
    const oprMatch = ratingsSection.match(/OPR\s*:?\s*[\r\n]+\s*([\d.]+)/i);
    if (oprMatch) report.opr = parseFloat(oprMatch[1]);
    
    const spriMatch = ratingsSection.match(/SPRI\s*:?\s*[\r\n]+\s*([\d.]+)/i);
    if (spriMatch) report.spri = parseFloat(spriMatch[1]);
    
    const mpriMatch = ratingsSection.match(/MPRI\s*:?\s*[\r\n]+\s*([\d.]+)/i);
    if (mpriMatch) report.mpri = parseFloat(mpriMatch[1]);
    
    const streetMatch = section.match(/Street:\s*([^\n]+)/);
    if (streetMatch) report.street = streetMatch[1].trim();
    
    const cityMatch = section.match(/City:\s*([^\n]+)/);
    if (cityMatch) report.city = cityMatch[1].trim();
    
    // Extract observations
    const observations = [];
    const obsPattern = /([\d.]+)\s+([A-Z]+)\s+([^\n]+?)\s+(\d{2}:\d{2}:\d{2})/g;
    let obsMatch;
    
    while ((obsMatch = obsPattern.exec(section)) !== null) {
      observations.push({
        distance: parseFloat(obsMatch[1]),
        code: obsMatch[2],
        observation: obsMatch[3].trim(),
        counter: obsMatch[4]
      });
    }
    
    if (observations.length > 0) {
      report.observations = observations;
    }
    
    if (Object.keys(report).length > 0) {
      reports.push(report);
    }
  }
  
  return reports;
}

module.exports = {
  parsePDFWithPositioning
};

