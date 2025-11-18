const { parsePDF } = require('./pdfParser.js');
const fs = require('fs');

const buffer = fs.readFileSync('uploads/WinCanVX Hays CTV project.pdf');

parsePDF(buffer).then(result => {
  if (result.success) {
    console.log('=== Reports Missing OPRI ===\n');
    
    const missingOPRI = result.data.inspectionReports.filter(r => 
      r.opri === undefined || r.opri === null
    );
    
    console.log(`Total missing: ${missingOPRI.length} out of ${result.data.inspectionReports.length}`);
    console.log('\nPSR numbers of reports missing OPRI:');
    
    const psrNumbers = missingOPRI.map(r => r.psr || 'Unknown').sort((a, b) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      if (isNaN(numA) || isNaN(numB)) return 0;
      return numA - numB;
    });
    
    console.log(psrNumbers.join(', '));
    
    // Check a few to see if they have ANY ratings at all
    console.log('\n=== Sample of Missing Reports (first 5) ===');
    missingOPRI.slice(0, 5).forEach(r => {
      console.log(`\nPSR ${r.psr}:`);
      console.log(`  Has QSR: ${r.qsr !== undefined}`);
      console.log(`  Has QMR: ${r.qmr !== undefined}`);
      console.log(`  Has QOR: ${r.qor !== undefined}`);
      console.log(`  Has SPR: ${r.spr !== undefined}`);
      console.log(`  Has OPRI: ${r.opri !== undefined}`);
      console.log(`  Upstream: ${r.upstreamMH || 'N/A'}`);
      console.log(`  Downstream: ${r.downstreamMH || 'N/A'}`);
    });
  }
}).catch(err => console.error('Error:', err));
