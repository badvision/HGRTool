# Start Here - HGRTool with NTSC Enhancements

## Run It Now (3 Commands)

```bash
npm install          # Install dependencies (done!)
npm run dev          # Start HTTPS server
```

Open: **https://localhost:8443/imgedit.html**

*(Accept the certificate warning - it's safe for local development)*

## What's New

### ✨ NTSC Rendering
Authentic CRT color simulation with adjustable parameters:
- Hue, Saturation, Brightness, Contrast
- YIQ color space rendering
- Phase-accurate color fringing

**How to enable:**
1. Click **Settings** (gear icon)
2. Check **"Use NTSC color simulation"**
3. Adjust sliders to taste

### ✨ Image Import (UI Ready)
Convert photos/images to HGR format:
- Click **Import** button in toolbar
- Dialog UI is complete
- JavaScript handlers need wiring (see UI_INTEGRATION_COMPLETE.md)

## File Changes Summary

**New Files:**
- `docs/src/lib/ntsc-renderer.js` - NTSC color engine
- `docs/src/lib/image-dither.js` - Image conversion engine
- `package.json` - Added npm scripts
- `.ssl/` - SSL certificates (git-ignored)

**Updated Files:**
- `docs/imgedit.html` - Added Import button + NTSC settings UI
- `docs/src/settings.js` - Added NTSC setting handlers
- `docs/src/lib/std-hi-res.js` - Integrated NTSC rendering
- `.gitignore` - Ignore SSL certificates

## Alternative: Simple HTTP

If you don't need HTTPS:

```bash
npm start
```

Open: **http://localhost:8080/imgedit.html**

## Documentation

- **QUICKSTART.md** - Detailed getting started guide
- **NTSC_ENHANCEMENTS.md** - Feature documentation
- **UI_INTEGRATION_COMPLETE.md** - Complete integration guide
- **RUNNING_LOCALLY.md** - Development setup details

## Next Step

The UI is ready to go. To complete the image import feature, add the JavaScript handlers from **UI_INTEGRATION_COMPLETE.md** to `docs/src/image-editor.js`.

Enjoy your enhanced HGRTool with authentic NTSC rendering! 🎨
