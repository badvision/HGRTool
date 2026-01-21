# Running HGRTool Locally with NTSC Enhancements

## Quick Start

The simplest way to run HGRTool locally is using a local web server. Since it's a static site with ES6 modules, you need an HTTP server (not just opening `file://` URLs).

### Option 1: Python HTTP Server (Easiest)

```bash
cd /Users/brobert/Documents/code/hgrtool/docs
python3 -m http.server 8000
```

Then open your browser to: **http://localhost:8000/imgedit.html**

### Option 2: Node.js HTTP Server

```bash
cd /Users/brobert/Documents/code/hgrtool/docs
npx http-server -p 8000
```

Then open: **http://localhost:8000/imgedit.html**

### Option 3: VS Code Live Server

1. Install the "Live Server" extension in VS Code
2. Open the `/Users/brobert/Documents/code/hgrtool/docs` folder in VS Code
3. Right-click on `imgedit.html`
4. Select "Open with Live Server"

## Testing the New Features

### 1. Test NTSC Rendering

1. Open the editor: `http://localhost:8000/imgedit.html`
2. Create a new image or open an existing HGR file
3. Click the **Settings** button (gear icon) in the left toolbar
4. Scroll down to the **NTSC Rendering** section
5. Check **"Use NTSC color simulation"**
6. **Important**: Currently, you need to refresh the page or reopen the settings to see the effect (the JavaScript wiring isn't complete yet)

**What to expect:**
- Colors should look more authentic/CRT-like
- Color fringing effects between pixels
- Slightly softer appearance than crisp RGB

### 2. Test Image Import

The image import button has been added to the UI, but needs the JavaScript handlers wired up (see `UI_INTEGRATION_COMPLETE.md` for the code).

**When fully wired:**
1. Click the **Import** button (image icon) in the toolbar
2. Select a JPEG/PNG/GIF image
3. Choose a dithering algorithm
4. Preview the conversion
5. Click "Convert and Import"

## Project Structure

```
hgrtool/
├── docs/                      # Main application directory
│   ├── imgedit.html          # Main editor page (✅ UPDATED)
│   ├── editor.css            # Styles
│   ├── index.html            # Landing page
│   │
│   ├── src/                  # JavaScript source files
│   │   ├── image-editor.js   # Main editor logic (needs update)
│   │   ├── settings.js       # Settings dialog (✅ UPDATED)
│   │   │
│   │   └── lib/              # Core libraries
│   │       ├── ntsc-renderer.js     # ✨ NEW - NTSC color rendering
│   │       ├── image-dither.js      # ✨ NEW - Image conversion
│   │       ├── std-hi-res.js        # HGR format (✅ UPDATED)
│   │       ├── picture.js           # Picture management
│   │       ├── palette.js           # Color palette
│   │       └── ...                  # Other existing files
│   │
│   ├── NTSC_ENHANCEMENTS.md         # ✨ NEW - Feature documentation
│   └── ...
│
├── IMPLEMENTATION_STATUS.md          # ✨ NEW - Implementation overview
├── UI_INTEGRATION_COMPLETE.md        # ✨ NEW - UI integration guide
├── RUNNING_LOCALLY.md                # ✨ NEW - This file
└── README.md                          # Original readme
```

## Current State

### ✅ Completed
- NTSC renderer module (fully functional)
- Image dithering engine (fully functional)
- HTML UI updates (buttons, dialogs, sliders)
- Settings persistence (localStorage)
- StdHiRes integration (rendering logic)

### 🚧 Needs Wiring
- Image import button event handler
- Image import dialog logic
- Settings change propagation to renderer
- Real-time NTSC parameter updates

## Completing the Integration

To make everything fully functional, you need to add the JavaScript handlers to `docs/src/image-editor.js`. The complete code is in `UI_INTEGRATION_COMPLETE.md`.

### Quick Integration Steps

1. **Add imports** at the top of `image-editor.js`:
   ```javascript
   import ImageDither from "./lib/image-dither.js";
   ```

2. **Add to constructor** (around line 84):
   ```javascript
   document.getElementById("btn-import-image").addEventListener("click",
       this.handleImportImage.bind(this));
   ```

3. **Add the handler methods** (see `UI_INTEGRATION_COMPLETE.md` for full code):
   - `handleImportImage()`
   - `handleImportFileSelected()`
   - `handleImportConvert()`
   - `loadImageFile()`

4. **Update `onSettingsChanged()`** to apply NTSC parameters

## Testing Without Full Integration

You can test the core modules directly in the browser console:

### Test NTSC Renderer

```javascript
// Open browser console while on the editor page
const { default: NTSCRenderer } = await import('./src/lib/ntsc-renderer.js');

const ntsc = new NTSCRenderer();
console.log("NTSC Renderer initialized:", ntsc);

// Test palette generation
console.log("Solid palette entries:", NTSCRenderer.solidPalette[0].length);
console.log("First color (black):", NTSCRenderer.solidPalette[0][0].toString(16));

// Test parameter adjustment
ntsc.hue = 30;
ntsc.saturation = 1.5;
console.log("Parameters adjusted:", {
    hue: ntsc.hue,
    saturation: ntsc.saturation,
    brightness: ntsc.brightness,
    contrast: ntsc.contrast
});
```

### Test Image Dithering

```javascript
const { default: ImageDither } = await import('./src/lib/image-dither.js');

const dither = new ImageDither();
console.log("Dither engine initialized:", dither);

// Test algorithm selection
dither.setDitherAlgorithm("floyd-steinberg");
console.log("Coefficients:", dither.coefficients);
console.log("Divisor:", dither.divisor);
```

## Troubleshooting

### Module Loading Errors

**Error:** `Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "text/plain"`

**Solution:** Make sure you're using an HTTP server, not opening files directly (`file://`). Use one of the server options above.

### CORS Errors

**Error:** `Access to script at 'file://...' from origin 'null' has been blocked by CORS policy`

**Solution:** Use an HTTP server (python, node, or VS Code Live Server).

### Changes Not Showing

If you make changes to JavaScript files and they don't appear:
1. **Hard refresh**: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
2. **Clear cache**: Open DevTools (F12) → Network tab → Check "Disable cache"
3. **Restart server**: Stop and restart your HTTP server

### Testing Checklist

- [ ] Server starts without errors
- [ ] Page loads at http://localhost:8000/imgedit.html
- [ ] No JavaScript errors in console (F12)
- [ ] New "Import" button appears in toolbar
- [ ] Settings dialog shows NTSC section
- [ ] NTSC sliders are visible and functional
- [ ] localStorage saves settings (check in DevTools → Application → Local Storage)

## Development Workflow

1. **Make changes** to JavaScript/HTML/CSS files
2. **Save** the files
3. **Refresh browser** (Ctrl+Shift+R for hard refresh)
4. **Check console** (F12) for errors
5. **Test features**

## Next Steps

1. **Wire up handlers**: Add the JavaScript code from `UI_INTEGRATION_COMPLETE.md`
2. **Test NTSC rendering**: Toggle it on/off and adjust parameters
3. **Test image import**: Import a photo and try different dithering algorithms
4. **Profile performance**: Use browser DevTools to check rendering speed
5. **Fix any bugs**: Debug issues as they arise

## Getting Help

- **Console errors**: Press F12 and check the Console tab for error messages
- **Network issues**: Check the Network tab to see if modules are loading
- **Local Storage**: Check Application → Local Storage to see saved settings

## Deployment

Once everything works locally:

1. **Run the publish script**:
   ```bash
   cd /Users/brobert/Documents/code/hgrtool
   ./publish.sh
   ```

2. **Test the published version** in the `docs/` directory

3. **Commit and push** to GitHub:
   ```bash
   git add .
   git commit -m "Add NTSC rendering and image import features"
   git push origin main
   ```

4. **GitHub Pages** will automatically deploy the changes

## Summary

You now have a locally running HGRTool with NTSC rendering and image import capabilities. The UI is fully updated, the core modules are functional, and the integration points are clearly documented. Just add the JavaScript handlers from `UI_INTEGRATION_COMPLETE.md` to make everything work end-to-end!
