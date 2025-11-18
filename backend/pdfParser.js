const pdf = require('pdf-parse');

/**
 * Extract PSR data from Section Profile sections
 */
function extractSectionProfileData(text) {
  const psrData = [];
  
  console.log('\n=== Section Profile Extraction Debug ===');
  
  // Find ALL Section Profile sections (may be multiple across pages)
  // Look for everything from "Section Profile" until we hit "Inspection report" or end
  const fullSectionMatch = text.match(/Section Profile[\s\S]*?(?=Inspection report|$)/i);
  
  if (!fullSectionMatch) {
    console.log('❌ No Section Profile section found in PDF');
    console.log('First 500 chars of PDF text:', text.substring(0, 500));
    return psrData;
  }
  
  console.log(`✓ Found Section Profile section`);
  
  // Process as one large section (handles multi-page tables)
  const fullSection = fullSectionMatch[0];
  
  // Split into potential sections by looking for "Section Profile" headers
  // but process all of them together
  const sections = [fullSection];
  
  sections.forEach((section, idx) => {
    console.log(`\nProcessing Section Profile ${idx + 1}:`);
    console.log('First 300 chars:', section.substring(0, 300));
    
    // Pattern for when PDF text has no spaces (data is smashed together)
    // Format: 82797138-33-20-028138-33-20-02711/20/2024VCP61.2061.20
    // Captures: No, PSR, Upstream MH, Downstream MH, Date, Material, Total Length, Length Surveyed
    const noSpacePattern = /(\d+)(\d+)([\d\-]+[\dA-Z])([\d\-]+[\dA-Z]?)(\d{1,2}\/\d{1,2}\/\d{4})([A-Z]+)([\d.]+)([\d.]+)/g;
    
    // Pattern for when PDF text has proper spacing
    const spacedPattern = /^\s*(\d+)\s+(\d+)\s+([\d\-]+)\s+([\d\-A-Z]+)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+([A-Z]+)\s+([\d.]+)\s+([\d.]+)/gm;
    
    let match;
    let matchCount = 0;
    
    // Try the no-space pattern first (more common in PDFs)
    // Need to carefully parse since everything is concatenated
    // Pattern: [No][PSR][MH-format][MH-format][Date][Material][Length][Length]
    const lines = section.split('\n');
    
    for (const line of lines) {
      // Skip ONLY actual header lines (not data lines that contain these words)
      // Header lines have these words WITHOUT manhole IDs or dates
      if (!line.trim()) continue;
      
      // Skip if it's a pure header line (has header text but no MH ID or date)
      const hasHeaderText = line.includes('No.') || line.includes('PSR') || 
                           line.includes('Upstream MH') || line.includes('Downstream MH') ||
                           line.includes('Material') || line.includes('Surveyed');
      const hasMHPattern = /\d{2,3}-\d{2}-\d{2}-\d{3}/.test(line);
      const hasDate = /\d{1,2}\/\d{1,2}\/\d{4}/.test(line);
      
      // Skip if it has header text but no actual data (MH or date)
      if (hasHeaderText && !hasMHPattern && !hasDate) {
        continue;
      }
      
      // Skip summary lines
      if (line.includes('Circular =') || line.includes('Total Length (')) {
        continue;
      }
      
      // Smart parsing: Find the MH IDs first (they're distinctive with dashes)
      // Pattern: XXX-XX-XX-XXX where X are digits
      const mhPattern = /(\d{2,3}-\d{2}-\d{2}-\d{3}[A-Z]?)/g;
      const mhMatches = [...line.matchAll(mhPattern)];
      
      if (mhMatches.length >= 2) {
        // Found two MH IDs - these are our anchors
        const upstreamMH = mhMatches[0][0];
        const downstreamMH = mhMatches[1][0];
        
        // Find position of first MH
        const mhStartIdx = line.indexOf(upstreamMH);
        const beforeMH = line.substring(0, mhStartIdx);
        
        // Before the MH, we should have: [No][PSR]
        // Strategy: The last 2-4 digits before MH is likely PSR
        // Everything before that is No.
        const digitsBeforeMH = beforeMH.match(/^(\d+)$/);
        
        if (digitsBeforeMH) {
          const allDigits = digitsBeforeMH[1];
          
          // PSR is typically 3-4 digits, No is typically 1-3 digits
          // From the sample data: No.82 PSR=797, No.91 PSR=787, No.191 PSR=642
          // PSRs appear to be 3 digits consistently
          let no, psr;
          
          if (allDigits.length <= 3) {
            // Probably just No, no PSR found in Section Profile
            no = allDigits;
            psr = null;
          } else if (allDigits.length === 4) {
            // 1+3: e.g., "1407" = No.1, PSR=407
            no = allDigits.substring(0, 1);
            psr = allDigits.substring(1, 4);
          } else if (allDigits.length === 5) {
            // 2+3: e.g., "82797" = No.82, PSR=797
            no = allDigits.substring(0, 2);
            psr = allDigits.substring(2, 5);
          } else if (allDigits.length === 6) {
            // 3+3: e.g., "191642" = No.191, PSR=642
            no = allDigits.substring(0, 3);
            psr = allDigits.substring(3, 6);
          } else if (allDigits.length === 7) {
            // Could be 3+4 or 4+3, assume PSR is last 3-4 digits
            // Try 4+3 first (e.g., "11887" = No.1, PSR=1887)
            no = allDigits.substring(0, allDigits.length - 4);
            psr = allDigits.substring(allDigits.length - 4);
          } else {
            // Longer - take last 3-4 digits as PSR
            no = allDigits.substring(0, allDigits.length - 3);
            psr = allDigits.substring(allDigits.length - 3);
          }
          
          // Now extract the rest after the downstream MH
          const afterDownstreamMH = line.substring(line.indexOf(downstreamMH) + downstreamMH.length);
          
          // Pattern: Date Material Length Length
          const restMatch = afterDownstreamMH.match(/^(\d{1,2}\/\d{1,2}\/\d{4})([A-Z]{2,4})([\d.]+)([\d.]+)/);
          
          if (restMatch && psr) {
            matchCount++;
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
            if (matchCount <= 5) {
              console.log(`  Entry ${matchCount}: No.${entry.no}, PSR ${entry.psr}, ${entry.upstreamMH} → ${entry.downstreamMH}`);
            }
          }
        }
      } else {
        // Debug: show lines that don't match
        if (line.trim().length > 10 && matchCount < 3) {
          console.log(`  No match for line (found ${mhMatches.length} MH IDs): ${line.substring(0, 80)}`);
        }
      }
    }
    
    // If no matches with no-space pattern, try spaced pattern
    if (matchCount === 0) {
      console.log('  Trying spaced pattern...');
      while ((match = spacedPattern.exec(section)) !== null) {
        matchCount++;
        const entry = {
          no: match[1],
          psr: match[2],
          upstreamMH: match[3],
          downstreamMH: match[4],
          date: match[5],
          material: match[6],
          totalLength: parseFloat(match[7]),
          lengthSurveyed: parseFloat(match[8])
        };
        
        if (entry.psr && entry.upstreamMH && entry.downstreamMH) {
          psrData.push(entry);
          if (matchCount <= 3) {
            console.log(`  Entry ${matchCount}: PSR ${entry.psr}, ${entry.upstreamMH} → ${entry.downstreamMH}`);
          }
        }
      }
    }
    
    console.log(`  Matched ${matchCount} rows from this section`);
  });
  
  // Deduplicate entries (same PSR + Upstream MH + Downstream MH)
  const uniqueEntries = [];
  const seen = new Set();
  
  for (const entry of psrData) {
    const key = `${entry.psr}-${entry.upstreamMH}-${entry.downstreamMH}`;
    if (!seen.has(key)) {
      uniqueEntries.push(entry);
      seen.add(key);
    }
  }
  
  console.log(`\n✓ Total Extracted: ${psrData.length} entries (${uniqueEntries.length} unique)`);
  if (uniqueEntries.length > 0) {
    console.log('Sample entry:', JSON.stringify(uniqueEntries[0], null, 2));
    console.log(`PSR range: ${uniqueEntries[0].psr} to ${uniqueEntries[uniqueEntries.length - 1].psr}`);
  } else {
    console.log('❌ No entries extracted - pattern may not match PDF format');
  }
  console.log('=== End Section Profile Debug ===\n');
  
  return uniqueEntries;
}

/**
 * Extract inspection report data
 */
function extractInspectionReportData(text) {
  const reports = [];
  
  // Split text into inspection report sections
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
    
    // Extract basic info
    const dateMatch = section.match(/Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/) || 
                      section.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s+Cole Swenson/);
    if (dateMatch) report.date = dateMatch[1];
    
    const certMatch = section.match(/Certificate Number:\s*([\w\-]+)/);
    if (certMatch) report.certificateNumber = certMatch[1];
    
    // Try multiple patterns for PSR - more flexible matching
    const psrMatch = section.match(/Pipe\s+Segment\s+Ref\.?:?\s*(\d+)/i) || 
                     section.match(/PSR\s*:?\s*(\d+)/i) ||
                     section.match(/Ref\.?:?\s*(\d+)/) ||
                     section.match(/Segment\s+(?:Reference|Ref)\.?:?\s*(\d+)/i);
    if (psrMatch) report.psr = psrMatch[1];
    
    const surveyedByMatch = section.match(/Surveyed By:\s*([^\n]+)/);
    if (surveyedByMatch) report.surveyedBy = surveyedByMatch[1].trim();
    
    // Pre-cleaning and direction
    const precleaningMatch = section.match(/Pre-cleaning:\s*([^\n]+?)(?:\s+Direction:|$)/);
    if (precleaningMatch) report.preCleaning = precleaningMatch[1].trim();
    
    const directionMatch = section.match(/Direction:\s*([^\n]+?)(?:\s+Pipe Joint Length:|$)/);
    if (directionMatch) report.direction = directionMatch[1].trim();
    
    // Extract pipe information
    const upstreamMatch = section.match(/Upstream MH:\s*([\w\-]+)/);
    if (upstreamMatch) report.upstreamMH = upstreamMatch[1];
    
    const downstreamMatch = section.match(/Downstream MH:\s*([\w\-]+)/);
    if (downstreamMatch) report.downstreamMH = downstreamMatch[1];
    
    // Pipe details
    const shapeMatch = section.match(/Pipe shape:\s*(\w+)/);
    if (shapeMatch) report.pipeShape = shapeMatch[1];
    
    const sizeMatch = section.match(/Pipe size:\s*([\d\s"]+?)(?:\s+Sewer Category:|\s+Purpose:|$)/);
    if (sizeMatch) report.pipeSize = sizeMatch[1].trim();
    
    const materialMatch = section.match(/Pipe material:\s*([^\n]+?)(?:\s+Purpose:|\s+Lining Method:|$)/);
    if (materialMatch) report.pipeMaterial = materialMatch[1].trim();
    
    const useMatch = section.match(/Sewer Use:\s*([^\n]+?)(?:\s+Total gallons|$)/);
    if (useMatch) report.sewerUse = useMatch[1].trim();
    
    const categoryMatch = section.match(/Sewer Category:\s*(\w+)/);
    if (categoryMatch) report.sewerCategory = categoryMatch[1];
    
    // Joints information
    const jointsPassedMatch = section.match(/Joints passed:\s*(\d+)/);
    if (jointsPassedMatch) report.jointsPassed = parseInt(jointsPassedMatch[1]);
    
    const jointsFailedMatch = section.match(/Joints failed:\s*(\d+)/);
    if (jointsFailedMatch) report.jointsFailed = parseInt(jointsFailedMatch[1]);
    
    // Gallons used
    const gallonsMatch = section.match(/Total gallons used:\s*([\d.]+)/);
    if (gallonsMatch) report.totalGallonsUsed = parseFloat(gallonsMatch[1]);
    
    // Length information
    const totalLengthMatch = section.match(/Total Length:\s*([\d.]+)\s*['"]/);
    if (totalLengthMatch) report.totalLength = parseFloat(totalLengthMatch[1]);
    
    const surveyedLengthMatch = section.match(/Length Surveyed:\s*([\d.]+)\s*['"]/);
    if (surveyedLengthMatch) report.lengthSurveyed = parseFloat(surveyedLengthMatch[1]);
    
    // Extract ratings from the table at bottom
    // NOTE: Ratings often appear at the START of the NEXT section, so we use ratingsSection
    // Handle two formats:
    // 1. Proper format: Label on one line, value on next line
    // 2. Concatenated format (from pdf-parse): All labels on one line, all values on next
    
    // Try proper format first (with newlines between label and value)
    let qsrMatch = ratingsSection.match(/QSR\s*:?\s*[\r\n]+\s*(\d+)/i);
    let qmrMatch = ratingsSection.match(/QMR\s*:?\s*[\r\n]+\s*(\d+)/i);
    let qorMatch = ratingsSection.match(/QOR\s*:?\s*[\r\n]+\s*(\d+)/i);
    let sprMatch = ratingsSection.match(/SPR\s*:?\s*[\r\n]+\s*([\d.]+)/i);
    let mprMatch = ratingsSection.match(/MPR\s*:?\s*[\r\n]+\s*([\d.]+)/i);
    let oprMatch = ratingsSection.match(/OPR\s*:?\s*[\r\n]+\s*([\d.]+)/i);
    let spriMatch = ratingsSection.match(/SPRI\s*:?\s*[\r\n]+\s*([\d.]+)/i);
    let mpriMatch = ratingsSection.match(/MPRI\s*:?\s*[\r\n]+\s*([\d.]+)/i);
    let opriMatch = ratingsSection.match(/OPRI\s*:?\s*[\r\n]+\s*([\d.]+)/i);
    
    let usedConcatenatedFormat = false;
    
    // If proper format didn't work, try concatenated format
    // Format: "QSRQMRSPRMPROPRSPRIMPRIOPRI\n110031001.03.01.03.02.04.0"
    if (!qsrMatch) {
      const concatMatch = ratingsSection.match(/QSRQMR[^\n]*[\r\n]+\s*([\d.]+)/i);
      if (concatMatch) {
        // Parse the concatenated numbers: QSR QMR SPR MPR OPR SPRI MPRI OPRI
        // First 8 digits are QSR (4) and QMR (4), then 6 decimal numbers
        const numbersLine = concatMatch[1];
        
        // Extract QSR and QMR (first 8 digits)
        const qsr = numbersLine.substring(0, 4);
        const qmr = numbersLine.substring(4, 8);
        
        // Rest is decimal numbers concatenated: "1.03.01.03.02.04.0"
        // Extract all decimal numbers using regex (single digit . single digit pattern)
        const decimalPart = numbersLine.substring(8);
        const decimals = decimalPart.match(/\d\.\d/g); // Match only X.Y patterns (single digits)
        
        if (qsr && qmr && decimals && decimals.length >= 6) {
          report.qsr = parseInt(qsr);
          report.qmr = parseInt(qmr);
          // Note: pdf-parse extracts in visual order, NOT label order!
          // Actual order appears to be: SPR, MPR, SPRI, MPRI, OPRI, OPR
          report.spr = parseFloat(decimals[0]);   // SPR
          report.mpr = parseFloat(decimals[1]);   // MPR
          report.spri = parseFloat(decimals[2]);  // SPRI
          report.mpri = parseFloat(decimals[3]);  // MPRI
          report.opri = parseFloat(decimals[4]);  // OPRI
          report.opr = parseFloat(decimals[5]);   // OPR
          usedConcatenatedFormat = true;
        }
      }
      // QOR appears separately
      if (!usedConcatenatedFormat) {
        qorMatch = ratingsSection.match(/QOR[\r\n]+\s*(\d+)/i);
      } else {
        qorMatch = ratingsSection.match(/QOR[\r\n]+\s*(\d+)/i);
      }
    }
    
    // Apply matches from proper format only if we didn't use concatenated format
    if (!usedConcatenatedFormat) {
      if (qsrMatch) report.qsr = parseInt(qsrMatch[1]);
      if (qmrMatch) report.qmr = parseInt(qmrMatch[1]);
      if (qorMatch) report.qor = parseInt(qorMatch[1]);
      if (sprMatch) report.spr = parseFloat(sprMatch[1]);
      if (mprMatch) report.mpr = parseFloat(mprMatch[1]);
      if (oprMatch) report.opr = parseFloat(oprMatch[1]);
      if (spriMatch) report.spri = parseFloat(spriMatch[1]);
      if (mpriMatch) report.mpri = parseFloat(mpriMatch[1]);
      if (opriMatch) report.opri = parseFloat(opriMatch[1]);
    } else {
      // Even in concatenated format, apply QOR since it appears separately
      if (qorMatch) report.qor = parseInt(qorMatch[1]);
    }
    
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
    
    // Street and location
    const streetMatch = section.match(/Street:\s*([^\n]+)/);
    if (streetMatch) report.street = streetMatch[1].trim();
    
    const cityMatch = section.match(/City:\s*([^\n]+)/);
    if (cityMatch) report.city = cityMatch[1].trim();
    
    if (Object.keys(report).length > 0) {
      reports.push(report);
    }
  }
  
  return reports;
}

/**
 * Main PDF parsing function
 */
async function parsePDF(dataBuffer) {
  try {
    // Try to preserve layout/spacing in PDF extraction
    const data = await pdf(dataBuffer, {
      // Normalize whitespace but preserve general layout
      normalizeWhitespace: false,
      disableCombineTextItems: false
    });
    const text = data.text;
    
    // Extract section profile data
    const psrData = extractSectionProfileData(text);
    
    // Extract inspection reports
    const inspectionReports = extractInspectionReportData(text);
    
    // Cross-reference inspection reports with section profile data
    // If a report is missing PSR, try to find it from section profile
    inspectionReports.forEach(report => {
      if (!report.psr && report.upstreamMH && report.downstreamMH) {
        // Try to find matching PSR from section profile
        const matchingProfile = psrData.find(p => 
          p.upstreamMH === report.upstreamMH && 
          p.downstreamMH === report.downstreamMH &&
          (!report.date || p.date === report.date)
        );
        
        if (matchingProfile) {
          report.psr = matchingProfile.psr;
          console.log(`Matched PSR ${matchingProfile.psr} for ${report.upstreamMH} → ${report.downstreamMH}`);
        }
      }
      
      // Also copy pipe material from section profile if available
      if (!report.pipeMaterial && report.psr) {
        const matchingProfile = psrData.find(p => p.psr === report.psr);
        if (matchingProfile && matchingProfile.material) {
          report.pipeMaterial = matchingProfile.material;
        }
      }
    });
    
    return {
      success: true,
      rawText: text, // Include raw text for debugging
      data: {
        sectionProfile: psrData,
        inspectionReports: inspectionReports,
        metadata: {
          totalPages: data.numpages,
          totalPSREntries: psrData.length,
          totalInspectionReports: inspectionReports.length,
          totalObservations: inspectionReports.reduce((sum, r) => 
            sum + (r.observations ? r.observations.length : 0), 0)
        }
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Calculate statistics from parsed data
 */
function calculateStatistics(parsedData) {
  const { sectionProfile, inspectionReports } = parsedData;
  
  const stats = {
    totalPSREntries: sectionProfile.length,
    totalInspectionReports: inspectionReports.length,
    totalLength: 0,
    totalLengthSurveyed: 0,
    materials: {},
    dateRange: { earliest: null, latest: null },
    averageLength: 0,
    longestSegment: null,
    shortestSegment: null,
    opriScores: [],
    observationCodes: {}
  };
  
  // Process section profile
  if (sectionProfile.length > 0) {
    stats.totalLength = sectionProfile.reduce((sum, p) => sum + p.totalLength, 0);
    stats.totalLengthSurveyed = sectionProfile.reduce((sum, p) => sum + p.lengthSurveyed, 0);
    stats.averageLength = stats.totalLength / sectionProfile.length;
    
    // Materials count
    sectionProfile.forEach(p => {
      stats.materials[p.material] = (stats.materials[p.material] || 0) + 1;
    });
    
    // Find longest and shortest
    stats.longestSegment = sectionProfile.reduce((max, p) => 
      p.totalLength > (max?.totalLength || 0) ? p : max, sectionProfile[0]);
    stats.shortestSegment = sectionProfile.reduce((min, p) => 
      p.totalLength < (min?.totalLength || Infinity) ? p : min, sectionProfile[0]);
    
    // Date range
    const dates = sectionProfile.map(p => new Date(p.date)).filter(d => !isNaN(d));
    if (dates.length > 0) {
      stats.dateRange.earliest = new Date(Math.min(...dates)).toLocaleDateString();
      stats.dateRange.latest = new Date(Math.max(...dates)).toLocaleDateString();
    }
  }
  
  // Process inspection reports
  inspectionReports.forEach(report => {
    if (report.opri !== undefined) {
      stats.opriScores.push({
        psr: report.psr,
        opri: report.opri,
        condition: getConditionLabel(report.opri)
      });
    }
    
    // Count observation codes
    if (report.observations) {
      report.observations.forEach(obs => {
        stats.observationCodes[obs.code] = (stats.observationCodes[obs.code] || 0) + 1;
      });
    }
  });
  
  return stats;
}

/**
 * Get condition label from OPRI score
 */
function getConditionLabel(opri) {
  if (opri <= 1.5) return 'Excellent';
  if (opri <= 2.5) return 'Good';
  if (opri <= 3.5) return 'Fair';
  if (opri <= 4.5) return 'Poor';
  return 'Very Poor';
}

module.exports = {
  parsePDF,
  calculateStatistics,
  getConditionLabel
};
