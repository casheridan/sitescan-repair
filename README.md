# 🚰 Sewer Inspection Viewer - Full Stack Application

A modern web application for parsing and visualizing sewer inspection reports from WinCan CCTV PDFs.

## 🎯 Features

### Backend (Node.js + Express)
- **PDF Parsing**: Extract PSR entries, inspection reports, and observations
- **RESTful API**: Complete CRUD operations for parsed data
- **Export Functionality**: Download data as Excel or JSON
- **Search & Filter**: Find specific pipe segments
- **Statistics Generation**: Automatic calculation of key metrics

### Frontend (React)
- **Dashboard**: Visual overview with charts and statistics
- **Section Profile Viewer**: Sortable table of all pipe segments
- **Inspection Reports**: Detailed view with expandable sections
- **Observations Table**: Filterable list of all defects and conditions
- **Export Options**: Download data in multiple formats
- **Responsive Design**: Works on desktop and mobile

## 📦 What Gets Extracted

- ✅ **PSR Entries** (All pipe segments from Section Profile)
- ✅ **Inspection Reports** (Detailed assessments with OPRI ratings)
- ✅ **Observations** (Defects, conditions, and issues)
- ✅ **Performance Ratings** (QSR, QMR, QOR, SPR, MPR, OPR)
- ✅ **Rating Indices** (SPRI, MPRI, OPRI)
- ✅ **Pipe Information** (Material, size, length, manholes)
- ✅ **Survey Details** (Date, surveyor, cleaning method)

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Modern web browser

### Installation

1. **Clone or extract the project**
```bash
cd sewer-inspection-app
```

2. **Install backend dependencies**
```bash
cd backend
npm install
```

3. **Install frontend dependencies**
```bash
cd ../frontend
npm install
```

### Running the Application

**Option 1: Development Mode (Recommended)**

Open two terminal windows:

Terminal 1 - Start Backend:
```bash
cd backend
npm start
```
Backend will run on http://localhost:3001

Terminal 2 - Start Frontend:
```bash
cd frontend
npm start
```
Frontend will open automatically at http://localhost:3000

**Option 2: Production Build**

```bash
# Build frontend
cd frontend
npm run build

# Serve from backend (requires additional setup)
cd ../backend
# Copy frontend/build to backend/public
# Start backend with static serving
npm start
```

## 📖 Usage Guide

### 1. Upload PDF
- Click "Upload PDF" in sidebar
- Select a WinCan inspection report PDF
- Wait for parsing to complete (usually 5-10 seconds)

### 2. View Dashboard
- See overview statistics
- View material distribution chart
- Check OPRI scores for inspected segments
- Review segment details

### 3. Explore Data
- **Section Profile**: Browse all pipe segments, sort and search
- **Inspection Reports**: View detailed assessments, expand for full info
- **Observations**: Filter by code, see all defects and conditions

### 4. Export Data
- Click "Export Excel" or "Export JSON" in header
- Download formatted data for further analysis

## 🏗️ Project Structure

```
sewer-inspection-app/
├── backend/
│   ├── package.json          # Backend dependencies
│   ├── server.js             # Express server and API routes
│   ├── pdfParser.js          # PDF parsing logic
│   └── uploads/              # Temporary PDF storage (auto-created)
│
├── frontend/
│   ├── package.json          # Frontend dependencies
│   ├── public/
│   │   └── index.html        # HTML template
│   └── src/
│       ├── App.js            # Main application component
│       ├── App.css           # Application styles
│       ├── index.js          # React entry point
│       └── components/
│           ├── Dashboard.js              # Dashboard with charts
│           ├── SectionProfileTable.js    # PSR entries table
│           ├── InspectionReportsTable.js # Detailed reports
│           └── ObservationsTable.js      # Observations list
```

## 🔌 API Endpoints

### Upload & Parse
- `POST /api/upload` - Upload and parse PDF
  - Body: multipart/form-data with 'pdf' field
  - Returns: dataId, metadata, statistics

### Data Access
- `GET /api/data/:id` - Get parsed data by ID
- `GET /api/data` - List all parsed datasets
- `DELETE /api/data/:id` - Delete parsed data

### Export
- `GET /api/export/:id/excel` - Download as Excel
- `GET /api/export/:id/json` - Download as JSON

### Search
- `GET /api/data/:id/search?q=<term>` - Search PSR entries
  - Query params: q, material, minLength, maxLength

## 🎨 Customization

### Backend Customization

**Add New Extraction Fields**
Edit `backend/pdfParser.js`:
```javascript
// In extractInspectionReportData function
const newFieldMatch = section.match(/New Field:\s*([^\n]+)/);
if (newFieldMatch) report.newField = newFieldMatch[1];
```

**Adjust Parsing Patterns**
Modify regex patterns in `pdfParser.js` to match your PDF format.

### Frontend Customization

**Change Colors**
Edit `frontend/src/App.css`:
```css
/* Change primary color */
.btn-primary {
  background: #your-color;
}
```

**Add New Views**
Create new component in `frontend/src/components/` and import in App.js.

## 📊 Understanding the Data

### OPRI (Overall Performance Rating Index)
The most important metric for pipe condition:
- **0-1.5**: Excellent ✅
- **1.5-2.5**: Good ✅
- **2.5-3.5**: Fair ⚠️
- **3.5-4.5**: Poor ⚠️
- **4.5-5.0**: Very Poor ❌

### Common Observation Codes
- **TB**: Tap Break-in (service connection)
- **RML**: Roots Medium Lateral
- **FL**: Fracture Longitudinal
- **ISSR**: Intruding Sealing Ring
- **AMH**: Access Manhole
- **MWL**: Water Level

## 🐛 Troubleshooting

### Backend Issues

**Port 3001 already in use**
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Or change port in backend/server.js
const PORT = 3002;
```

**PDF parsing fails**
- Ensure PDF is text-based (not scanned image)
- Check if WinCan format matches expected structure
- Review console logs for specific errors

### Frontend Issues

**White screen after starting**
- Check browser console for errors
- Ensure backend is running on port 3001
- Clear browser cache and reload

**Upload not working**
- Check CORS is enabled in backend
- Verify backend URL in frontend (package.json proxy)
- Check file size (50MB limit)

## 🔐 Security Notes

**For Production Use:**
1. Add authentication/authorization
2. Implement rate limiting
3. Add input validation and sanitization
4. Use HTTPS
5. Add file upload virus scanning
6. Implement proper error handling
7. Add logging and monitoring

## 📈 Performance Tips

- Parsed data stored in memory (restart clears data)
- For production, implement database storage
- Large PDFs may take 10-30 seconds to parse
- Consider implementing background jobs for large files

## 🤝 Contributing

To extend the application:
1. Fork the project
2. Add features to backend/frontend
3. Test with various PDF formats
4. Document new features
5. Submit pull request

## 📝 License

MIT License - Free to use and modify

## 🆘 Support

### Common Issues

**Q: Can it parse PDFs from other inspection software?**
A: Currently optimized for WinCan format. Other formats need regex pattern adjustments.

**Q: How much data can it handle?**
A: Tested with PDFs up to 50MB and 500+ PSR entries.

**Q: Can I run this on a server?**
A: Yes! Fully configured for Railway deployment. See `README_DEPLOYMENT.md` for quick start.

**Q: Does it save uploaded PDFs?**
A: PDFs are deleted after parsing. Only extracted data is kept in memory.

## 🎓 Tech Stack

- **Backend**: Node.js, Express, pdf-parse, xlsx, multer
- **Database**: PostgreSQL (production) / SQLite (development)
- **Frontend**: React, Recharts, Axios, Lucide React, React-Leaflet
- **Python**: Camelot, pdfminer.six, OpenCV (PDF parsing)
- **Styling**: Custom CSS with responsive design

## 🌟 Future Enhancements

- [x] Database integration (SQLite, ready for PostgreSQL)
- [x] User authentication
- [ ] Batch PDF processing
- [ ] Advanced filtering and reporting
- [x] Map visualization of pipe network
- [ ] Automated anomaly detection
- [ ] Email alerts for critical issues
- [ ] Mobile app version

## 🚀 Deploy to Production

**Ready to deploy?** This app is fully configured for Railway deployment!

📖 **Quick Start**: See `README_DEPLOYMENT.md` for 5-minute deployment guide  
📋 **Checklist**: See `RAILWAY_CHECKLIST.md` for step-by-step instructions  
📚 **Full Guide**: See `RAILWAY_DEPLOYMENT.md` for complete documentation

```bash
# Quick deploy (3 steps)
1. Push to GitHub
2. Create Railway project
3. Set environment variables

# Your app will be live at: https://your-app.up.railway.app
```

---

**Built with ❤️ for sewer infrastructure management**

Start managing your pipe network data today! 🚰
