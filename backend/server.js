const express = require('express');
const cors = require('cors');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const XLSX = require('xlsx');
const { calculateStatistics } = require('./pdfParser');
const { parsePDFWithPython } = require('./pdfParserPython');
const { projectOperations, dataOperations } = require('./database');
const { router: authRouter, requireAuth } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors({
  origin: NODE_ENV === 'production' 
    ? [FRONTEND_URL, process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : ''].filter(Boolean)
    : 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Serve static files from frontend build in production
if (NODE_ENV === 'production') {
  const frontendBuildPath = path.join(__dirname, '../frontend/build');
  app.use(express.static(frontendBuildPath));
}

app.use(express.static('public'));

// Session middleware
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: NODE_ENV === 'production', // Enable secure cookies in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// Auth routes
app.use('/api/auth', authRouter);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
    } catch (err) {
      console.error('Error creating upload directory:', err);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
  limits: {
    fileSize: 1024 * 1024 * 1024 // 1GB limit
  }
});

// In-memory storage for parsed data
let parsedDataStore = {};

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Get all projects for current user
 */
app.get('/api/projects', requireAuth, async (req, res) => {
  try {
    const projects = await projectOperations.getAllByUser(req.session.userId);
    res.json({ success: true, projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get parsed data for a specific project
 */
app.get('/api/projects/:projectId/data', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Verify user owns this project
    const project = await projectOperations.getById(projectId, req.session.userId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const data = await dataOperations.getByProjectId(projectId);
    if (!data) {
      return res.status(404).json({ error: 'No parsed data found for this project' });
    }
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching project data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a project
 */
app.delete('/api/projects/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    await projectOperations.delete(projectId, req.session.userId);
    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Upload and parse PDF endpoint
 */
app.post('/api/upload', requireAuth, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    // Read the uploaded file
    const fileBuffer = await fs.readFile(req.file.path);
    
    // Get optional page range from query/body parameters
    // Default: first 10 pages for Section Profile (covers most cases)
    const sectionProfilePages = req.body.sectionProfilePages || req.query.sectionProfilePages || '1-10';
    
    console.log('Parsing PDF with Python (Camelot table extraction)...');
    console.log(`Section Profile page range: ${sectionProfilePages}`);
    
    const result = await parsePDFWithPython(fileBuffer, req.file.path, {
      useCamelot: true,
      sectionProfilePages: sectionProfilePages
    });
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    // Calculate statistics
    const statistics = calculateStatistics(result.data);
    
    // Create project in database
    const project = await projectOperations.create(
      req.session.userId,
      req.file.originalname,
      req.file.size
    );
    
    // Save parsed data to database
    await dataOperations.save(project.id, {
      sectionProfile: result.data.sectionProfile,
      inspectionReports: result.data.inspectionReports,
      metadata: {
        ...result.data.metadata,
        statistics,
        uploadDate: new Date().toISOString(),
        filename: req.file.originalname
      }
    });
    
    // Also store in memory for backward compatibility (optional)
    const dataId = project.id.toString();
    parsedDataStore[dataId] = {
      ...result.data,
      statistics,
      filename: req.file.originalname,
      uploadDate: new Date().toISOString(),
      rawText: result.rawText // Store raw text for debugging
    };
    
    // Clean up uploaded file
    await fs.unlink(req.file.path).catch(err => console.error('Error deleting file:', err));
    
    console.log(`✓ Project saved to database (ID: ${project.id})`);
    
    // Log extraction results for debugging
    console.log('\n=== PDF Parsing Results ===');
    console.log(`Filename: ${req.file.originalname}`);
    console.log(`Section Profile entries: ${result.data.sectionProfile.length}`);
    console.log(`Inspection Reports: ${result.data.inspectionReports.length}`);
    
    // PSR Comparison
    const sectionProfilePSRs = new Set(
      result.data.sectionProfile.map(entry => entry.psr).filter(psr => psr !== undefined && psr !== null)
    );
    const inspectionReportPSRs = new Set(
      result.data.inspectionReports.map(report => report.psr).filter(psr => psr !== undefined && psr !== null)
    );
    const matchingPSRs = Array.from(sectionProfilePSRs).filter(psr => inspectionReportPSRs.has(psr));
    const onlyInProfile = Array.from(sectionProfilePSRs).filter(psr => !inspectionReportPSRs.has(psr));
    const onlyInReports = Array.from(inspectionReportPSRs).filter(psr => !sectionProfilePSRs.has(psr));
    
    console.log('\n--- PSR Comparison ---');
    console.log(`Section Profile unique PSRs: ${sectionProfilePSRs.size}`);
    console.log(`Inspection Reports unique PSRs: ${inspectionReportPSRs.size}`);
    console.log(`Matching PSRs: ${matchingPSRs.length}`);
    if (onlyInProfile.length > 0) {
      console.log(`⚠ Only in Section Profile (${onlyInProfile.length}): ${onlyInProfile.slice(0, 10).join(', ')}${onlyInProfile.length > 10 ? '...' : ''}`);
    }
    if (onlyInReports.length > 0) {
      console.log(`⚠ Only in Inspection Reports (${onlyInReports.length}): ${onlyInReports.slice(0, 10).join(', ')}${onlyInReports.length > 10 ? '...' : ''}`);
    }
    if (onlyInProfile.length === 0 && onlyInReports.length === 0) {
      console.log('✓ Perfect match! All PSRs present in both datasets.');
    }
    
    if (result.data.inspectionReports.length > 0) {
      console.log('\n--- First Inspection Report Sample ---');
      const firstReport = result.data.inspectionReports[0];
      console.log(`  PSR: ${firstReport.psr || 'NOT FOUND'}`);
      console.log(`  Date: ${firstReport.date || 'NOT FOUND'}`);
      console.log(`  Surveyed By: ${firstReport.surveyedBy || 'NOT FOUND'}`);
      console.log(`  Certificate: ${firstReport.certificateNumber || 'NOT FOUND'}`);
      console.log(`  Upstream MH: ${firstReport.upstreamMH || 'NOT FOUND'}`);
      console.log(`  Downstream MH: ${firstReport.downstreamMH || 'NOT FOUND'}`);
      console.log(`  Direction: ${firstReport.direction || 'NOT FOUND'}`);
      console.log(`  Total Length: ${firstReport.totalLength || 'NOT FOUND'}`);
      console.log(`  OPRI: ${firstReport.opri || 'NOT FOUND'}`);
    }
    console.log('=========================\n');
    
    res.json({
      success: true,
      dataId,
      filename: req.file.originalname,
      metadata: result.data.metadata,
      statistics
    });
  } catch (error) {
    console.error('Error processing PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get parsed data by ID
 */
app.get('/api/data/:id', (req, res) => {
  const { id } = req.params;
  const data = parsedDataStore[id];
  
  if (!data) {
    return res.status(404).json({ error: 'Data not found' });
  }
  
  res.json({ success: true, data });
});

/**
 * Compare PSRs between Section Profile and Inspection Reports
 */
app.get('/api/data/:id/psr-comparison', (req, res) => {
  const { id } = req.params;
  const data = parsedDataStore[id];
  
  if (!data) {
    return res.status(404).json({ error: 'Data not found' });
  }
  
  // Extract PSRs from Section Profile
  const sectionProfilePSRs = new Set(
    data.sectionProfile.map(entry => entry.psr).filter(psr => psr !== undefined && psr !== null)
  );
  
  // Extract PSRs from Inspection Reports
  const inspectionReportPSRs = new Set(
    data.inspectionReports.map(report => report.psr).filter(psr => psr !== undefined && psr !== null)
  );
  
  // Find differences
  const inSectionProfileOnly = Array.from(sectionProfilePSRs).filter(psr => !inspectionReportPSRs.has(psr)).sort((a, b) => a - b);
  const inInspectionReportsOnly = Array.from(inspectionReportPSRs).filter(psr => !sectionProfilePSRs.has(psr)).sort((a, b) => a - b);
  const inBoth = Array.from(sectionProfilePSRs).filter(psr => inspectionReportPSRs.has(psr)).sort((a, b) => a - b);
  
  res.json({
    success: true,
    comparison: {
      sectionProfile: {
        total: sectionProfilePSRs.size,
        unique: Array.from(sectionProfilePSRs).sort((a, b) => a - b)
      },
      inspectionReports: {
        total: inspectionReportPSRs.size,
        unique: Array.from(inspectionReportPSRs).sort((a, b) => a - b)
      },
      differences: {
        inSectionProfileOnly: {
          count: inSectionProfileOnly.length,
          psrs: inSectionProfileOnly
        },
        inInspectionReportsOnly: {
          count: inInspectionReportsOnly.length,
          psrs: inInspectionReportsOnly
        },
        inBoth: {
          count: inBoth.length,
          psrs: inBoth
        }
      },
      summary: {
        matchPercentage: sectionProfilePSRs.size > 0 
          ? ((inBoth.length / sectionProfilePSRs.size) * 100).toFixed(1) + '%'
          : '0%',
        message: inSectionProfileOnly.length === 0 && inInspectionReportsOnly.length === 0
          ? 'Perfect match! All PSRs are in both datasets.'
          : `Found ${inSectionProfileOnly.length} PSRs only in Section Profile and ${inInspectionReportsOnly.length} PSRs only in Inspection Reports.`
      }
    }
  });
});

/**
 * Get all parsed datasets
 */
app.get('/api/data', (req, res) => {
  const datasets = Object.keys(parsedDataStore).map(id => ({
    id,
    filename: parsedDataStore[id].filename,
    uploadDate: parsedDataStore[id].uploadDate,
    metadata: parsedDataStore[id].metadata
  }));
  
  res.json({ success: true, datasets });
});

/**
 * Export data to Excel
 */
app.get('/api/export/:id/excel', async (req, res) => {
  try {
    const { id } = req.params;
    const data = parsedDataStore[id];
    
    if (!data) {
      return res.status(404).json({ error: 'Data not found' });
    }
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Section Profile sheet
    const sectionProfileSheet = XLSX.utils.json_to_sheet(
      data.sectionProfile.map(p => ({
        'No': p.no,
        'PSR': p.psr,
        'Upstream MH': p.upstreamMH,
        'Downstream MH': p.downstreamMH,
        'Date': p.date,
        'Material': p.material,
        'Total Length': p.totalLength,
        'Length Surveyed': p.lengthSurveyed
      }))
    );
    XLSX.utils.book_append_sheet(wb, sectionProfileSheet, 'Section_Profile');
    
    // Inspection Reports sheet
    const reportsFlat = data.inspectionReports.map(r => {
      const report = { ...r };
      if (report.observations) {
        report.numObservations = report.observations.length;
        delete report.observations;
      }
      return report;
    });
    
    const inspectionReportsSheet = XLSX.utils.json_to_sheet(reportsFlat);
    XLSX.utils.book_append_sheet(wb, inspectionReportsSheet, 'Inspection_Reports');
    
    // Observations sheet
    const allObservations = [];
    data.inspectionReports.forEach(report => {
      if (report.observations) {
        report.observations.forEach(obs => {
          allObservations.push({
            'PSR': report.psr,
            'Upstream MH': report.upstreamMH,
            'Downstream MH': report.downstreamMH,
            'Distance': obs.distance,
            'Code': obs.code,
            'Observation': obs.observation,
            'Counter': obs.counter
          });
        });
      }
    });
    
    if (allObservations.length > 0) {
      const observationsSheet = XLSX.utils.json_to_sheet(allObservations);
      XLSX.utils.book_append_sheet(wb, observationsSheet, 'Observations');
    }
    
    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // Send file
    const filename = `${data.filename.replace('.pdf', '')}_data.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Export data to JSON
 */
app.get('/api/export/:id/json', (req, res) => {
  const { id } = req.params;
  const data = parsedDataStore[id];
  
  if (!data) {
    return res.status(404).json({ error: 'Data not found' });
  }
  
  const filename = `${data.filename.replace('.pdf', '')}_data.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  res.json(data);
});

/**
 * Delete parsed data
 */
app.delete('/api/data/:id', (req, res) => {
  const { id } = req.params;
  
  if (!parsedDataStore[id]) {
    return res.status(404).json({ error: 'Data not found' });
  }
  
  delete parsedDataStore[id];
  res.json({ success: true, message: 'Data deleted' });
});

/**
 * Debug endpoint to view raw PDF text and first parsed report
 */
app.get('/api/data/:id/debug', (req, res) => {
  const { id } = req.params;
  const data = parsedDataStore[id];
  
  if (!data) {
    return res.status(404).json({ error: 'Data not found' });
  }
  
  const firstReport = data.inspectionReports?.[0] || {};
  const textPreview = data.rawText ? data.rawText.substring(0, 2000) : 'No raw text available';
  
  res.json({
    success: true,
    debug: {
      textPreview,
      firstReportFields: {
        psr: firstReport.psr || null,
        date: firstReport.date || null,
        upstreamMH: firstReport.upstreamMH || null,
        downstreamMH: firstReport.downstreamMH || null,
        opri: firstReport.opri || null,
        qsr: firstReport.qsr || null,
        qmr: firstReport.qmr || null,
        qor: firstReport.qor || null,
        spr: firstReport.spr || null,
        mpr: firstReport.mpr || null,
        opr: firstReport.opr || null,
        allFields: Object.keys(firstReport)
      },
      totalReports: data.inspectionReports?.length || 0,
      totalSectionProfile: data.sectionProfile?.length || 0
    }
  });
});

/**
 * Search PSR entries
 */
app.get('/api/data/:id/search', (req, res) => {
  const { id } = req.params;
  const { q, material, minLength, maxLength } = req.query;
  
  const data = parsedDataStore[id];
  
  if (!data) {
    return res.status(404).json({ error: 'Data not found' });
  }
  
  let results = [...data.sectionProfile];
  
  // Filter by search query (PSR, upstream, downstream)
  if (q) {
    const query = q.toLowerCase();
    results = results.filter(p => 
      p.psr.toLowerCase().includes(query) ||
      p.upstreamMH.toLowerCase().includes(query) ||
      p.downstreamMH.toLowerCase().includes(query)
    );
  }
  
  // Filter by material
  if (material) {
    results = results.filter(p => p.material === material);
  }
  
  // Filter by length range
  if (minLength) {
    results = results.filter(p => p.totalLength >= parseFloat(minLength));
  }
  if (maxLength) {
    results = results.filter(p => p.totalLength <= parseFloat(maxLength));
  }
  
  res.json({ success: true, results, count: results.length });
});

// Serve frontend in production (catch-all route)
if (NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚰 Sewer Inspection API running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${NODE_ENV}`);
  console.log(`📊 Upload PDFs to: http://localhost:${PORT}/api/upload`);
  if (NODE_ENV === 'production') {
    console.log(`🌐 Frontend served from: ${path.join(__dirname, '../frontend/build')}`);
  }
});

module.exports = app;
