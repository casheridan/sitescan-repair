const { parsePDF } = require('./pdfParser.js');
const fs = require('fs');

const buffer = fs.readFileSync('uploads/WinCanVX Hays CTV project.pdf');

parsePDF(buffer).then(result => {
  const reports = result.data.inspectionReports;
  
  const missingOPRI = reports.filter(r => r.opri === undefined || r.opri === null);
  const hasOPRI = reports.filter(r => r.opri !== undefined && r.opri !== null);
  
  console.log('=== Analysis of Missing OPRI Reports ===\n');
  console.log(`Total: ${missingOPRI.length} missing, ${hasOPRI.length} have OPRI\n`);
  
  // Check total length patterns
  const missingLengths = missingOPRI.map(r => r.totalLength).filter(l => l !== undefined);
  const hasLengths = hasOPRI.map(r => r.totalLength).filter(l => l !== undefined);
  
  console.log('Total Length Statistics:');
  console.log(`  Missing OPRI - Avg length: ${(missingLengths.reduce((a,b) => a+b, 0) / missingLengths.length).toFixed(1)} ft`);
  console.log(`  Has OPRI - Avg length: ${(hasLengths.reduce((a,b) => a+b, 0) / hasLengths.length).toFixed(1)} ft`);
  
  // Check if they have observations
  const missingWithObs = missingOPRI.filter(r => r.observations && r.observations.length > 0);
  const hasWithObs = hasOPRI.filter(r => r.observations && r.observations.length > 0);
  
  console.log('\nObservations:');
  console.log(`  Missing OPRI with observations: ${missingWithObs.length}/${missingOPRI.length}`);
  console.log(`  Has OPRI with observations: ${hasWithObs.length}/${hasOPRI.length}`);
  
  // Check pipe material
  const missingMaterials = {};
  const hasMaterials = {};
  
  missingOPRI.forEach(r => {
    const mat = r.pipeMaterial || 'Unknown';
    missingMaterials[mat] = (missingMaterials[mat] || 0) + 1;
  });
  
  hasOPRI.forEach(r => {
    const mat = r.pipeMaterial || 'Unknown';
    hasMaterials[mat] = (hasMaterials[mat] || 0) + 1;
  });
  
  console.log('\nMaterials (Missing OPRI):', missingMaterials);
  console.log('Materials (Has OPRI):', Object.keys(hasMaterials).slice(0, 5), '...');
  
  // Sample a few to see their actual content
  console.log('\n=== Sample Report Details ===');
  console.log('\nPSR 822 (Missing OPRI):');
  const r822 = reports.find(r => r.psr === '822');
  if (r822) {
    console.log('  Date:', r822.date);
    console.log('  Pipe Material:', r822.pipeMaterial);
    console.log('  Total Length:', r822.totalLength);
    console.log('  Has observations:', r822.observations ? r822.observations.length : 0);
  }
  
}).catch(err => console.error('Error:', err));

