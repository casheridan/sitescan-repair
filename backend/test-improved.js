const { parsePDF } = require('./pdfParser.js');
const fs = require('fs');

const buffer = fs.readFileSync('uploads/WinCanVX Hays CTV project.pdf');

parsePDF(buffer).then(result => {
  if (result.success) {
    console.log('=== Improved Parsing Results ===');
    
    const withOPRI = result.data.inspectionReports.filter(r => r.opri !== undefined && r.opri !== null).length;
    const validRange = result.data.inspectionReports.filter(r => r.opri >= 0 && r.opri <= 5).length;
    
    console.log('Total reports:', result.data.inspectionReports.length);
    console.log('WITH OPRI:', withOPRI);
    console.log('OPRI in valid range (0-5):', validRange, '=', Math.round(validRange/withOPRI*100) + '%');
    
    const psr400 = result.data.inspectionReports.find(r => r.psr === '400');
    if (psr400) {
      console.log('\n=== PSR 400 ===');
      console.log('QSR:', psr400.qsr, psr400.qsr === 1100 ? '✓' : '✗ Expected: 1100');
      console.log('QMR:', psr400.qmr, psr400.qmr === 3100 ? '✓' : '✗ Expected: 3100');
      console.log('QOR:', psr400.qor, psr400.qor === 3111 ? '✓' : '✗ Expected: 3111');
      console.log('SPR:', psr400.spr, psr400.spr === 1.0 ? '✓' : '✗ Expected: 1.0');
      console.log('MPR:', psr400.mpr, psr400.mpr === 3.0 ? '✓' : '✗ Expected: 3.0');
      console.log('OPR:', psr400.opr, psr400.opr === 4.0 ? '✓' : '✗ Expected: 4.0');
      console.log('SPRI:', psr400.spri, psr400.spri === 1.0 ? '✓' : '✗ Expected: 1.0');
      console.log('MPRI:', psr400.mpri, psr400.mpri === 3.0 ? '✓' : '✗ Expected: 3.0');
      console.log('OPRI:', psr400.opri, psr400.opri === 2.0 ? '✓' : '✗ Expected: 2.0');
    }
    
    const samples = result.data.inspectionReports.filter(r => r.opri !== undefined).slice(0, 5);
    console.log('\n=== First 5 OPRIs ===');
    samples.forEach(r => console.log(`PSR ${r.psr}: OPRI = ${r.opri} ${r.opri >= 0 && r.opri <= 5 ? '✓' : '✗'}`));
  }
}).catch(err => console.error('Error:', err));

