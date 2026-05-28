const express = require('express');
const multer = require('multer');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Detect if running as packaged exe
const isPkg = typeof process.pkg !== 'undefined';
const appDir = (() => {
  if (isPkg) return path.dirname(process.execPath);
  if (path.basename(__dirname) === 'api') return path.dirname(__dirname);
  return __dirname;
})();
const uploadDir = path.join(appDir, 'uploads');
const publicDir = path.join(appDir, 'public');

app.use(cors());
app.use(express.json());
app.use(express.static(publicDir));

// In-memory file map
const uploadedFiles = new Map();

if (!process.env.VERCEL && !fs.existsSync(uploadDir)) {
    try { fs.mkdirSync(uploadDir, { recursive: true }); } catch (_) {}
}

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    file.mimetype === 'application/pdf' ? cb(null, true) : cb(new Error('Only PDF files are allowed'), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });

// ── Upload ──────────────────────────────────────────────────────────────────
app.post('/api/upload', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const pdfDoc = await PDFDocument.load(req.file.buffer);
        const pageCount = pdfDoc.getPageCount();

        const fileId = uuidv4();
        uploadedFiles.set(fileId, { buffer: req.file.buffer, originalname: req.file.originalname });

        res.json({ success: true, fileId, filename: req.file.originalname, pageCount });
    } catch (error) {
        console.error('Upload error details:', error.message);
        console.error(error.stack);
        res.status(500).json({ error: 'Failed to upload file: ' + error.message });
    }
});

// ── Process (stamp) ─────────────────────────────────────────────────────────
app.post('/api/process', async (req, res) => {
    try {
        const { fileId, docNumber, date, time, receivedBy, position, pages } = req.body;

        if (!fileId || !uploadedFiles.has(fileId)) {
            return res.status(400).json({ error: 'File not found. Please re-upload.' });
        }

        const fileInfo = uploadedFiles.get(fileId);
        const pdfDoc = await PDFDocument.load(fileInfo.buffer);

        const helveticaBold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const helvetica        = await pdfDoc.embedFont(StandardFonts.Helvetica);

        const pageIndices = pages === 'first' ? [0] : pdfDoc.getPages().map((_, i) => i);

        for (const idx of pageIndices) {
            const page = pdfDoc.getPages()[idx];
            const { width: pw, height: ph } = page.getSize();

            const stampW = 245, stampH = 115, margin = 20;
            let sx, sy;
            switch (position) {
                case 'bottom-left': sx = margin; sy = margin; break;
                case 'top-right':   sx = pw - stampW - margin; sy = ph - stampH - margin; break;
                case 'top-left':    sx = margin; sy = ph - stampH - margin; break;
                case 'center':      sx = (pw - stampW) / 2; sy = (ph - stampH) / 2; break;
                default:            sx = pw - stampW - margin; sy = margin; break; // bottom-right
            }

            drawMGBStamp(page, sx, sy, stampW, stampH,
                { docNumber, date, time, receivedBy },
                { helveticaBold, helvetica });
        }

        const out = await pdfDoc.save();
        res.json({ success: true, pdf: Buffer.from(out).toString('base64') });

    } catch (error) {
        console.error('Processing error:', error);
        res.status(500).json({ error: 'Failed to process PDF: ' + error.message });
    }
});

// ── Cleanup ─────────────────────────────────────────────────────────────────
app.delete('/api/cleanup/:fileId', (req, res) => {
    uploadedFiles.delete(req.params.fileId);
    res.json({ success: true });
});

// ── Receivers API ───────────────────────────────────────────────────────────────
const DEFAULT_RECEIVERS = ['Ellen Mancera', 'Shiely Dilangalen'];

function loadReceivers() {
    if (process.env.VERCEL) return DEFAULT_RECEIVERS;
    const receiversFile = path.join(appDir, 'receivers.json');
    try {
        if (fs.existsSync(receiversFile)) {
            const data = fs.readFileSync(receiversFile, 'utf-8');
            return JSON.parse(data).receivers || DEFAULT_RECEIVERS;
        }
    } catch (e) { console.error('Error loading receivers:', e.message); }
    return DEFAULT_RECEIVERS;
}

function saveReceivers(list) {
    if (process.env.VERCEL) return;
    const receiversFile = path.join(appDir, 'receivers.json');
    try { fs.writeFileSync(receiversFile, JSON.stringify({ receivers: list }, null, 2)); } catch (_) {}
}

app.get('/api/receivers', (req, res) => {
    res.json({ receivers: loadReceivers() });
});

app.post('/api/receivers', (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
    }
    const list = loadReceivers();
    const newName = name.trim();
    if (list.includes(newName)) {
        return res.status(400).json({ error: 'Name already exists' });
    }
    list.push(newName);
    saveReceivers(list);
    res.json({ success: true, receivers: list });
});

app.delete('/api/receivers', (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
    }
    let list = loadReceivers();
    list = list.filter(n => n !== name.trim());
    saveReceivers(list);
    res.json({ success: true, receivers: list });
});

// ── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE')
        return res.status(400).json({ error: 'File too large. Maximum size is 50MB' });
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`Upload dir: ${uploadDir}`);
        console.log(`Public dir: ${publicDir}`);
        console.log(`Don't close this window`);
    });

    if (isPkg) {
        process.stdin.resume();
    }
}

module.exports = app;

// ═══════════════════════════════════════════════════════════════════════════
//  STAMP DRAWING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Draws the MGB XI - Davao City "RECEIVED" stamp.
 * CSS-style design: 600px wide, black border, centered text with shadow effect
 */
function drawMGBStamp(page, x, y, w, h, fields, fonts) {
    const { helveticaBold, helvetica } = fonts;
    const black = rgb(0, 0, 0);
    const blue = rgb(0, 0.2, 0.8);  // Blue for field values
    const darkGray = rgb(0.15, 0.15, 0.15);
    
    // Scale factor based on width (CSS design is 600px)
    const scale = w / 600;
    const pad = 20 * scale;  // CSS padding: 20px
    
    // White background + thick border (CSS: 4px solid black)
    page.drawRectangle({ 
        x, y, 
        width: w, 
        height: h, 
        color: rgb(1, 1, 1), 
        borderColor: black, 
        borderWidth: 3 * scale,  // ~4px scaled
        opacity: 0.85,  // CSS opacity: 0.85
        borderOpacity: 1 
    });

    const cx = x + w / 2;
    const il = x + pad;
    const iw = w - 2 * pad;
    let cy = y + h - pad;

    // ── Row 1: MGB XI - Davao City (CSS: 28px, bold, centered) ───────────────
    const r1sz = 40 * scale * 0.75;  // convert px to PDF points
    cy -= r1sz + 5 * scale;
    centeredText(page, 'MGB XI - Davao City', cx, cy, r1sz, helveticaBold, black);

    // ── Row 2: RECEIVED (CSS: 56px, weight 900, letter-spacing: 8px) ──────────
    const r2sz = 56 * scale * 0.75;
    cy -= r2sz + 15 * scale;
    
    // EXPLICIT BLACK COLOR for RECEIVED text
    const pureBlack = rgb(0, 0, 0);
    console.log('Drawing RECEIVED in BLACK color');
    
    centeredText(page, 'RECEIVED', cx, cy, r2sz, helveticaBold, pureBlack);

    // ── Row 3: Records and Releasing Unit (CSS: 24px) ───────────────────────
    const r3sz = 24 * scale * 0.75;
    cy -= r3sz + 20 * scale;
    centeredText(page, 'Records and Releasing Unit', cx, cy, r3sz, helvetica, black);

    // ── Field rows (CSS: 22px, with underlines) ──────────────────────────────
    const fsz = 22 * scale * 0.75;
    const lineOff = -2 * scale;
    const lineThick = 2 * scale;  // CSS border-bottom: 2px
    
    // Doc. Nos: (full width line: 70%)
    cy -= fsz + 20 * scale;
    const docLineWidth = iw * 0.70;
    const textYOffset = 1.5 * scale; // Lower text to sit on the line
    page.drawText('Doc. Nos:', { x: il, y: cy + textYOffset, size: fsz, font: helvetica, color: black });
    page.drawLine({
        start: { x: il + 70 * scale, y: cy + lineOff },
        end:   { x: il + 70 * scale + docLineWidth, y: cy + lineOff },
        thickness: lineThick, color: black
    });
    // Draw value if provided (BLUE color for values)
    if (fields.docNumber) {
        page.drawText(fields.docNumber, { 
            x: il + 75 * scale, y: cy + textYOffset, size: fsz, font: helveticaBold, color: blue,
            maxWidth: docLineWidth - 10 * scale
        });
    }

    // Date: (full width line: 70%)
    cy -= fsz + 15 * scale;
    const dateLineWidth = iw * 0.70;
    let dateDisplay = fields.date || '';
    page.drawText('Date:', { x: il, y: cy + textYOffset, size: fsz, font: helvetica, color: black });
    page.drawLine({
        start: { x: il + 50 * scale, y: cy + lineOff },
        end:   { x: il + 50 * scale + dateLineWidth, y: cy + lineOff },
        thickness: lineThick, color: black
    });
    if (dateDisplay) {
        page.drawText(dateDisplay, { 
            x: il + 55 * scale, y: cy + textYOffset, size: fsz, font: helveticaBold, color: blue,
            maxWidth: dateLineWidth - 10 * scale
        });
    }

    // Time: and By: row (CSS: 48% each, line: 60%)
    cy -= fsz + 15 * scale;
    const halfW = iw * 0.48;
    const timeLineWidth = halfW * 0.60;
    const byLineWidth = halfW * 0.60;
    
    // Time field (with AM/PM conversion)
    page.drawText('Time:', { x: il, y: cy + textYOffset, size: fsz, font: helvetica, color: black });
    page.drawLine({
        start: { x: il + 50 * scale, y: cy + lineOff },
        end:   { x: il + 50 * scale + timeLineWidth, y: cy + lineOff },
        thickness: lineThick, color: black
    });
    if (fields.time) {
        // Convert to 12-hour format with AM/PM
        let timeWithAmPm = fields.time;
        if (fields.time.includes(':')) {
            const [h, m] = fields.time.split(':').map(Number);
            const ampm = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 || 12;
            timeWithAmPm = `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
        }
        page.drawText(timeWithAmPm, { 
            x: il + 55 * scale, y: cy + textYOffset, size: fsz, font: helveticaBold, color: blue,
            maxWidth: timeLineWidth - 10 * scale
        });
    }
    
    // By field
    const byX = il + halfW + 20 * scale;
    page.drawText('By:', { x: byX, y: cy + textYOffset, size: fsz, font: helvetica, color: black });
    page.drawLine({
        start: { x: byX + 35 * scale, y: cy + lineOff },
        end:   { x: byX + 35 * scale + byLineWidth, y: cy + lineOff },
        thickness: lineThick, color: black
    });
    if (fields.receivedBy) {
        page.drawText(fields.receivedBy, { 
            x: byX + 40 * scale, y: cy + textYOffset, size: fsz, font: helveticaBold, color: blue,
            maxWidth: byLineWidth - 10 * scale
        });
    }
}

function fieldRow(page, x, y, totalW, lblW, label, value, sz, boldFont, normalFont, color, lineOff) {
    page.drawText(label, { x, y, size: sz, font: boldFont, color });

    const vx = x + lblW;
    const vw = totalW - lblW;

    if (value) {
        page.drawText(value, { x: vx + 2, y, size: sz, font: normalFont, color, maxWidth: vw - 4 });
    }

    page.drawLine({
        start: { x: vx, y: y + lineOff },
        end:   { x: x + totalW, y: y + lineOff },
        thickness: 0.7, color
    });
}

function centeredText(page, text, cx, y, size, font, color) {
    const tw = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: cx - tw / 2, y, size, font, color });
}