# HGRTool Quick Start Guide

## Installation

First, install dependencies:

```bash
npm install
```

This will install:
- `http-server` - Local web server
- `eslint` - Code linting (already configured)

## Running the Application

### Option 1: HTTP (Simplest)

```bash
npm start
```

This will:
- Start HTTP server on port 8080
- Open `http://localhost:8080/imgedit.html` in your browser
- Disable caching (so changes appear immediately)

### Option 2: HTTPS (Recommended for Testing)

```bash
npm run dev
```

This will:
1. Generate self-signed SSL certificates (first time only)
2. Start HTTPS server on port 8443
3. Open `https://localhost:8443/imgedit.html` in your browser

**Note**: Your browser will warn about the self-signed certificate. Click "Advanced" and proceed anyway (it's safe for local development).

### Option 3: HTTPS Only (If Certificates Already Exist)

```bash
npm run start:https
```

This runs HTTPS without regenerating certificates.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Run HTTP server on port 8080 |
| `npm run dev` | Create SSL cert + run HTTPS server on port 8443 |
| `npm run start:https` | Run HTTPS server (requires existing cert) |
| `npm run create-cert` | Generate self-signed SSL certificate |
| `npm run dev:http` | Alias for `npm start` |

## Testing the New Features

### 1. Test NTSC Rendering

1. Open the app at `http://localhost:8080/imgedit.html`
2. Create a new image or open an existing HGR file
3. Click **Settings** (gear icon) in left toolbar
4. Scroll to **NTSC Rendering** section
5. Check **"Use NTSC color simulation"**
6. Adjust sliders to see effects:
   - **Hue**: -180° to +180°
   - **Saturation**: 0 to 2x
   - **Brightness**: 0 to 2x
   - **Contrast**: 0 to 2x

Settings are automatically saved to localStorage.

### 2. Test Image Import (UI Ready, Needs JavaScript Wiring)

1. Click the **Import** button (image icon) in top toolbar
2. The dialog will open (UI is complete)
3. JavaScript handlers need to be wired (see `UI_INTEGRATION_COMPLETE.md`)

## Development Workflow

1. **Edit code** - Make changes to JavaScript/HTML/CSS
2. **Save files** - Changes are automatically detected
3. **Refresh browser** - Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
4. **Check console** - Press F12 to see any errors

### Disable Browser Caching

For development, disable caching in Chrome DevTools:
1. Press F12 to open DevTools
2. Go to **Network** tab
3. Check **"Disable cache"**
4. Keep DevTools open while developing

## Browser Console Testing

Test the new modules directly in the console:

### Test NTSC Renderer

```javascript
const { default: NTSCRenderer } = await import('./src/lib/ntsc-renderer.js');
const ntsc = new NTSCRenderer();
console.log("Palettes initialized:", NTSCRenderer.solidPalette[0].length);

// Adjust parameters
ntsc.hue = 30;
ntsc.saturation = 1.5;
console.log("Parameters:", { hue: ntsc.hue, saturation: ntsc.saturation });
```

### Test Image Dithering

```javascript
const { default: ImageDither } = await import('./src/lib/image-dither.js');
const dither = new ImageDither();
dither.setDitherAlgorithm("floyd-steinberg");
console.log("Dither ready:", dither.coefficients);
```

## Project Structure

```
hgrtool/
├── package.json          # ✨ UPDATED - Added scripts
├── .gitignore           # ✨ UPDATED - Ignore .ssl/
├── .ssl/                # ✨ GENERATED - SSL certificates (git-ignored)
│   ├── cert.pem
│   └── key.pem
│
├── docs/                # Main application
│   ├── imgedit.html     # ✨ UPDATED - Added Import button, NTSC settings
│   └── src/
│       ├── lib/
│       │   ├── ntsc-renderer.js    # ✨ NEW
│       │   ├── image-dither.js     # ✨ NEW
│       │   └── std-hi-res.js       # ✨ UPDATED
│       └── settings.js               # ✨ UPDATED
│
├── NTSC_ENHANCEMENTS.md              # ✨ NEW - Feature docs
├── UI_INTEGRATION_COMPLETE.md        # ✨ NEW - Integration guide
├── RUNNING_LOCALLY.md                # ✨ NEW - Detailed setup
└── QUICKSTART.md                     # ✨ NEW - This file
```

## Troubleshooting

### Certificate Warnings

When using HTTPS locally, your browser will warn about self-signed certificates:

**Chrome/Edge:**
1. Click "Advanced"
2. Click "Proceed to localhost (unsafe)"

**Firefox:**
1. Click "Advanced"
2. Click "Accept the Risk and Continue"

**Safari:**
1. Click "Show Details"
2. Click "visit this website"

This is **safe for local development** - the certificate is only valid for localhost.

### Port Already in Use

If you see "EADDRINUSE" error:

```bash
# Kill process on port 8080
lsof -ti:8080 | xargs kill -9

# Or use a different port
http-server docs -p 8081
```

### Module Not Found

If you see module import errors:
1. Make sure you're using HTTP/HTTPS (not `file://`)
2. Check that files exist in `docs/src/lib/`
3. Clear browser cache (Ctrl+Shift+R)

### Changes Not Showing

1. Hard refresh: **Ctrl+Shift+R** (Cmd+Shift+R on Mac)
2. Check DevTools console for errors (F12)
3. Ensure "Disable cache" is checked in Network tab
4. Restart the server if needed

## Next Steps

### Complete the Integration

The UI is ready, but JavaScript handlers need to be added to `docs/src/image-editor.js`:

1. Read `UI_INTEGRATION_COMPLETE.md` for complete code
2. Add image import handlers
3. Wire up settings changes to renderer
4. Test end-to-end functionality

### Key Files to Edit

1. **docs/src/image-editor.js** - Add import handlers
2. **docs/src/lib/ntsc-renderer.js** - NTSC logic (complete)
3. **docs/src/lib/image-dither.js** - Dithering logic (complete)
4. **docs/src/settings.js** - Settings UI (complete)

## Useful Commands

```bash
# Install dependencies
npm install

# Start development server (HTTPS)
npm run dev

# Start simple HTTP server
npm start

# Regenerate SSL certificate
npm run create-cert

# Lint JavaScript files
npm run lint  # (if configured)

# Check for syntax errors
node -c docs/src/lib/ntsc-renderer.js
```

## Resources

- **NTSC_ENHANCEMENTS.md** - Detailed feature documentation
- **UI_INTEGRATION_COMPLETE.md** - Complete integration guide with code
- **RUNNING_LOCALLY.md** - Detailed local development setup
- **Original README.md** - faddenSoft's original documentation

## Getting Help

If you encounter issues:

1. Check browser console (F12) for errors
2. Check terminal for server errors
3. Verify files exist: `ls docs/src/lib/*.js`
4. Test module loading in console (see examples above)
5. Clear browser cache and localStorage

## Summary

You're now ready to run HGRTool locally with NTSC rendering! Just run:

```bash
npm install    # First time only
npm run dev    # Start development server
```

Then open `https://localhost:8443/imgedit.html` and test the new NTSC rendering features!
