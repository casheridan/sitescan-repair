const { parsePDF } = require('./pdfParser.js');
const fs = require('fs');

const buffer = fs.readFileSync('uploads/WinCanVX Hays CTV project.pdf');

parsePDF(buffer).then(result => {
  const reports = result.data.inspectionReports;
  console.log('Total reports:', reports.length);
  
  console.log('\nLast 10 report PSRs:');
  reports.slice(-10).forEach((r, i) => {
    const idx = reports.length - 10 + i;
    console.log(`  ${idx}: PSR ${r.psr || 'Unknown'} - Has OPRI: ${r.opri !== undefined}`);
  });
  
  console.log('\nChecking position of reports missing OPRI:');
  const missingIndices = [];
  reports.forEach((r, i) => {
    if (r.opri === undefined || r.opri === null) {
      missingIndices.push(i);
    }
  });
  
  console.log('First 20 indices of missing reports:', missingIndices.slice(0, 20).join(', '));
  console.log('Last report missing OPRI is at index:', Math.max(...missingIndices), 'out of', reports.length - 1);
  console.log('\nAre they clustered at the end?', Math.max(...missingIndices) === reports.length - 1 ? 'YES - last report is missing' : 'NO');
}).catch(err => console.error('Error:', err));

