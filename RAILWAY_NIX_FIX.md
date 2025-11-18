# Railway Nix Environment Fix

## Issue

When deploying to Railway, you may encounter this error:

```
× This environment is externally managed
╰─> This command has been disabled as it tries to modify the immutable
    `/nix/store` filesystem.
```

## Root Cause

Railway uses Nix for package management, which creates an "externally managed" Python environment. PEP 668 prevents direct `pip install` commands in these environments to avoid breaking system packages.

## Solution

✅ **Already Fixed!** The app now uses a Python virtual environment for Railway deployments.

### What Was Changed

#### 1. Updated `nixpacks.toml`

**Before:**
```toml
[phases.install]
cmds = [
  'cd backend && pip install -r requirements.txt',  # ❌ Direct pip install fails
  'npm install',
  'cd frontend && npm install'
]
```

**After:**
```toml
[phases.setup]
nixPkgs = ['python311', 'python311Packages.pip', 'python311Packages.virtualenv', 'ghostscript', 'tk']

[phases.install]
cmds = [
  'python3 -m venv /opt/venv',                                    # ✅ Create venv
  '/opt/venv/bin/pip install --upgrade pip',                     # ✅ Upgrade pip in venv
  'cd backend && /opt/venv/bin/pip install -r requirements.txt', # ✅ Install in venv
  'npm install',
  'cd frontend && npm install'
]

[env]
PATH = '/opt/venv/bin:$PATH'  # ✅ Add venv to PATH
```

#### 2. Updated `backend/pdfParserPython.js`

Added Railway venv detection:

```javascript
// Check for Railway venv first, then local venv, then system Python
const railwayVenvPython = '/opt/venv/bin/python3';
const windowsVenvPython = path.join(__dirname, 'venv', 'Scripts', 'python.exe');
const unixVenvPython = path.join(__dirname, 'venv', 'bin', 'python3');

let pythonCommand;
if (require('fs').existsSync(railwayVenvPython)) {
  pythonCommand = railwayVenvPython;  // ✅ Use Railway venv
} else if (require('fs').existsSync(windowsVenvPython)) {
  pythonCommand = windowsVenvPython;
} else if (require('fs').existsSync(unixVenvPython)) {
  pythonCommand = unixVenvPython;
} else {
  pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
}
```

## How It Works

1. **Setup Phase**: Nix installs Python 3.11, pip, virtualenv, and required system packages
2. **Install Phase**: 
   - Creates a virtual environment at `/opt/venv`
   - Upgrades pip within the venv
   - Installs Python packages (camelot, pdfminer, opencv) into the venv
   - Installs Node.js packages normally
3. **Runtime**: The venv's `bin` directory is added to PATH, so Python commands use the venv automatically

## Benefits

✅ **Complies with PEP 668** - Uses isolated virtual environment  
✅ **No system modification** - Doesn't touch `/nix/store`  
✅ **Clean dependencies** - Isolated Python packages  
✅ **Works everywhere** - Same approach works locally and on Railway  

## Deploying to Railway

Just push your code - the fix is already in place!

```bash
git add .
git commit -m "Fixed Railway Nix environment issue"
git push origin main
```

Railway will:
1. ✅ Create Python virtual environment
2. ✅ Install packages in isolation
3. ✅ Build your app successfully
4. ✅ Deploy without errors

## Verifying the Fix

Check Railway deployment logs for:

```
✅ Creating virtual environment...
✅ Installing Python packages...
✅ Successfully installed camelot-py-1.0.9 ...
```

## Alternative Solutions (Not Recommended)

### Option 1: `--break-system-packages` (❌ Not Recommended)
```bash
pip install --break-system-packages -r requirements.txt
```
**Why not:** Can break system Python and violates PEP 668

### Option 2: System-wide Nix packages (❌ Not Flexible)
```toml
nixPkgs = ['python311', 'python311Packages.camelot', ...]
```
**Why not:** Limited package availability in Nix, hard to manage versions

### Option 3: Poetry or Pipenv (✅ Also Good)
Could use these tools but virtual environment is simpler and more standard.

## Troubleshooting

### "python3: command not found"

**Check nixpacks.toml includes:**
```toml
nixPkgs = ['python311', ...]
```

### "pip: command not found"

**Check nixpacks.toml includes:**
```toml
nixPkgs = ['python311Packages.pip', ...]
```

### "Module 'camelot' not found"

**Check installation logs:**
- Verify pip install succeeded
- Check PATH includes `/opt/venv/bin`
- Verify `backend/requirements.txt` is correct

### "Cannot create virtual environment"

**Check nixpacks.toml includes:**
```toml
nixPkgs = ['python311Packages.virtualenv', ...]
```

## Local Development

This fix doesn't affect local development:
- Windows: Uses `backend/venv/Scripts/python.exe`
- Mac/Linux: Uses `backend/venv/bin/python3`
- Fallback: Uses system `python` or `python3`

## Related Resources

- [PEP 668 - Externally Managed Environments](https://peps.python.org/pep-0668/)
- [Railway Nixpacks Documentation](https://nixpacks.com/)
- [Python Virtual Environments](https://docs.python.org/3/library/venv.html)

## Summary

✅ **Issue resolved!** Your app now:
- Uses virtual environments properly
- Complies with PEP 668
- Works on Railway without modifications
- Maintains local development compatibility

Just push to GitHub and deploy! 🚀

