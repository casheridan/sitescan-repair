# 🚀 QUICK START GUIDE

Get the Sewer Inspection Viewer running in 3 minutes!

## ⚡ Fastest Way to Start

### Step 1: Install Dependencies
```bash
cd sewer-inspection-app

# Install backend
cd backend
npm install

# Install frontend  
cd ../frontend
npm install
cd ..
```

### Step 2: Start Both Servers

**Open TWO terminal windows:**

**Terminal 1 (Backend):**
```bash
cd sewer-inspection-app/backend
npm start
```
✅ Backend running at http://localhost:3001

**Terminal 2 (Frontend):**
```bash
cd sewer-inspection-app/frontend
npm start
```
✅ Frontend opens at http://localhost:3000

### Step 3: Upload & View
1. Browser opens automatically to http://localhost:3000
2. Click "Choose PDF File"
3. Select your WinCan inspection PDF
4. Wait 5-10 seconds for parsing
5. View your data in the Dashboard! 📊

## 🎯 What You'll See

After uploading a PDF:
- **Dashboard**: Statistics, charts, OPRI scores
- **Section Profile**: All pipe segments in a table
- **Inspection Reports**: Detailed assessments
- **Observations**: All defects and conditions

## 💡 Tips

- **Export Data**: Click "Export Excel" or "Export JSON" in header
- **Search**: Use search box in Section Profile
- **Filter**: Filter observations by code
- **Sort**: Click column headers to sort tables

## 🐛 Troubleshooting

**"Port 3001 in use"**
```bash
# Kill the process
lsof -ti:3001 | xargs kill -9
```

**"Cannot connect to server"**
- Make sure backend is running on port 3001
- Check terminal 1 for errors

**"Upload fails"**
- Ensure PDF is under 50MB
- Check PDF is WinCan format
- Look at browser console (F12) for errors

## 📁 Test with Sample Data

Your PDF from Kansas has:
- 419 PSR entries
- 2 detailed inspection reports
- 20 observations
- ~110,000 feet of pipe

Perfect for testing the app!

## ⚙️ Alternative: Install Everything at Once

If you have `concurrently` installed globally:
```bash
# From root directory
npm install
npm run install-all
npm run dev
```

Both servers start together! 🎉

## 🎨 Customization

Want to change colors or add features?
- Backend: `backend/server.js` and `backend/pdfParser.js`
- Frontend: `frontend/src/App.js` and `frontend/src/App.css`

## 📞 Need Help?

Check the full README.md for:
- Complete API documentation
- Customization guide
- Advanced features
- Production deployment

---

**You're all set!** Start uploading PDFs and analyzing your sewer network! 🚰📊
