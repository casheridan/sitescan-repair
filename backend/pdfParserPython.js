const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

/**
 * Parse PDF using Python pdfminer for better table extraction
 */
async function parsePDFWithPython(dataBuffer, tempFilePath, options = {}) {
  const { useCamelot = true, sectionProfilePages = '1-10' } = options;
  
  return new Promise(async (resolve, reject) => {
    try {
      // Write buffer to temp file (Python needs file path)
      await fs.writeFile(tempFilePath, dataBuffer);
      
      const parserType = useCamelot ? 'Camelot (table extraction)' : 'PDFMiner (text extraction)';
      console.log(`\n=== Python ${parserType} Parsing ===`);
      console.log(`Temp file: ${tempFilePath}`);
      if (useCamelot) {
        console.log(`Section Profile pages: ${sectionProfilePages}`);
      }
      
      const pythonScript = path.join(__dirname, useCamelot ? 'pdfParserCamelot.py' : 'pdfParser.py');
      
      // Use venv Python if available, otherwise fall back to system Python
      const venvPython = path.join(__dirname, 'venv', 'Scripts', 'python.exe');
      const pythonCommand = require('fs').existsSync(venvPython) 
        ? venvPython 
        : (process.platform === 'win32' ? 'python' : 'python3');
      
      // Add page range parameter for Camelot
      const args = useCamelot 
        ? [pythonScript, tempFilePath, sectionProfilePages]
        : [pythonScript, tempFilePath];
      
      const python = spawn(pythonCommand, args);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        const msg = data.toString();
        stderr += msg;
        // Print Python debug output
        console.log('Python:', msg);
      });
      
      python.on('close', async (code) => {
        // Clean up temp file
        await fs.unlink(tempFilePath).catch(err => console.error('Error deleting temp file:', err));
        
        if (code !== 0) {
          console.error('Python script failed with code:', code);
          console.error('stderr:', stderr);
          reject(new Error(`Python script failed: ${stderr}`));
          return;
        }
        
        try {
          const result = JSON.parse(stdout);
          
          if (!result.success) {
            reject(new Error(result.error));
            return;
          }
          
          console.log(`✓ Successfully parsed with Python ${parserType}`);
          console.log(`  Section Profile entries: ${result.data.sectionProfile.length}`);
          console.log(`  Inspection Reports: ${result.data.inspectionReports.length}`);
          
          // Show first few entries
          if (result.data.sectionProfile.length > 0) {
            console.log('\nFirst 3 Section Profile entries:');
            result.data.sectionProfile.slice(0, 3).forEach((entry, idx) => {
              console.log(`  ${idx + 1}. No.${entry.no}, PSR ${entry.psr}, ${entry.upstreamMH} → ${entry.downstreamMH}`);
            });
          }
          
          resolve(result);
        } catch (err) {
          console.error('Error parsing Python output:', err);
          console.error('stdout:', stdout);
          reject(new Error(`Failed to parse Python output: ${err.message}`));
        }
      });
      
      python.on('error', (err) => {
        console.error('Failed to start Python process:', err);
        reject(new Error(`Failed to start Python: ${err.message}. Make sure Python is installed and in PATH.`));
      });
      
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  parsePDFWithPython
};

