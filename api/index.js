const express = require('express');
const multer = require('multer');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const uploadedFiles = new Map();
const DEFAULT_RECEIVERS = ['Ellen Mancera', 'Shiely Dilangalen'];
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
    file.mimetype === 'application/pdf' ? cb(null, true) : cb(new Error('Only PDF files are allowed'), false);
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', receivers: DEFAULT_RECEIVERS });
});

// Upload
app.post('/api/upload', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const pdfDoc = await PDFDocument.load(req.file.buffer);
        const pageCount = pdfDoc.getPageCount();
        const fileId = uuidv4();
        uploadedFiles.set(fileId, { buffer: req.file.buffer, originalname: req.file.originalname });
        res.json({ success: true, fileId, filename: req.file.originalname, pageCount });
    } catch (error) {
        res.status(500).json({ error: 'Failed to upload file: ' + error.message });
    }
});

// Process (stamp)
app.post('/api/process', async (req, res) => {
    try {
        const { fileId, docNumber, date, time, receivedBy, position, pages } = req.body;
        if (!fileId || !uploadedFiles.has(fileId)) {
            return res.status(400).json({ error: 'File not found. Please re-upload.' });
        }
        const fileInfo = uploadedFiles.get(fileId);
        const pdfDoc = await PDFDocument.load(fileInfo.buffer);
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const pageIndices = pages === 'first' ? [0] : pdfDoc.getPages().map((_, i) => i);
        for (const idx of pageIndices) {
            const page = pdfDoc.getPages()[idx];
            const { width: pw, height: ph } = page.getSize();
            const stampW = 245, stampH = 115, margin = 20;
            let sx, sy;
            switch (position) {
                case 'bottom-left': sx = margin; sy = margin; break;
                case 'top-right': sx = pw - stampW - margin; sy = ph - stampH - margin; break;
                case 'top-left': sx = margin; sy = ph - stampH - margin; break;
                case 'center': sx = (pw - stampW) / 2; sy = (ph - stampH) / 2; break;
                default: sx = pw - stampW - margin; sy = margin; break;
            }
            drawMGBStamp(page, sx, sy, stampW, stampH,
                { docNumber, date, time, receivedBy },
                { helveticaBold, helvetica });
        }
        const out = await pdfDoc.save();
        res.json({ success: true, pdf: Buffer.from(out).toString('base64') });
    } catch (error) {
        res.status(500).json({ error: 'Failed to process PDF: ' + error.message });
    }
});

// Cleanup
app.delete('/api/cleanup/:fileId', (req, res) => {
    uploadedFiles.delete(req.params.fileId);
    res.json({ success: true });
});

// Receivers
app.get('/api/receivers', (req, res) => {
    res.json({ receivers: DEFAULT_RECEIVERS });
});

app.post('/api/receivers', (req, res) => {
    res.status(400).json({ error: 'Not available on serverless' });
});

app.delete('/api/receivers', (req, res) => {
    res.status(400).json({ error: 'Not available on serverless' });
});

// Error handler
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE')
        return res.status(400).json({ error: 'File too large. Maximum size is 50MB' });
    res.status(500).json({ error: 'Something went wrong!' });
});



module.exports = app;

// ═══════════════════════════════════════════════════════════════════════════
//  STAMP DRAWING
// ═══════════════════════════════════════════════════════════════════════════

function drawMGBStamp(page, x, y, w, h, fields, fonts) {
    const { helveticaBold, helvetica } = fonts;
    const black = rgb(0, 0, 0);
    const blue = rgb(0, 0.2, 0.8);
    const scale = w / 600;
    const pad = 20 * scale;
    page.drawRectangle({
        x, y, width: w, height: h, color: rgb(1, 1, 1),
        borderColor: black, borderWidth: 3 * scale, opacity: 0.85, borderOpacity: 1
    });
    const cx = x + w / 2;
    const il = x + pad;
    const iw = w - 2 * pad;
    let cy = y + h - pad;
    const r1sz = 40 * scale * 0.75;
    cy -= r1sz + 5 * scale;
    centeredText(page, 'MGB XI - Davao City', cx, cy, r1sz, helveticaBold, black);
    const r2sz = 56 * scale * 0.75;
    cy -= r2sz + 15 * scale;
    centeredText(page, 'RECEIVED', cx, cy, r2sz, helveticaBold, rgb(0, 0, 0));
    const r3sz = 24 * scale * 0.75;
    cy -= r3sz + 20 * scale;
    centeredText(page, 'Records and Releasing Unit', cx, cy, r3sz, helvetica, black);
    const fsz = 22 * scale * 0.75;
    const lineOff = -2 * scale;
    const lineThick = 2 * scale;
    cy -= fsz + 20 * scale;
    const docLineWidth = iw * 0.70;
    const textYOffset = 1.5 * scale;
    page.drawText('Doc. Nos:', { x: il, y: cy + textYOffset, size: fsz, font: helvetica, color: black });
    page.drawLine({ start: { x: il + 70 * scale, y: cy + lineOff }, end: { x: il + 70 * scale + docLineWidth, y: cy + lineOff }, thickness: lineThick, color: black });
    if (fields.docNumber) page.drawText(fields.docNumber, { x: il + 75 * scale, y: cy + textYOffset, size: fsz, font: helveticaBold, color: blue, maxWidth: docLineWidth - 10 * scale });
    cy -= fsz + 15 * scale;
    page.drawText('Date:', { x: il, y: cy + textYOffset, size: fsz, font: helvetica, color: black });
    page.drawLine({ start: { x: il + 50 * scale, y: cy + lineOff }, end: { x: il + 50 * scale + 140 * scale, y: cy + lineOff }, thickness: lineThick, color: black });
    if (fields.date) page.drawText(fields.date, { x: il + 55 * scale, y: cy + textYOffset, size: fsz, font: helveticaBold, color: blue });
    cy -= fsz + 15 * scale;
    const halfW = iw * 0.48;
    page.drawText('Time:', { x: il, y: cy + textYOffset, size: fsz, font: helvetica, color: black });
    page.drawLine({ start: { x: il + 50 * scale, y: cy + lineOff }, end: { x: il + 50 * scale + 90 * scale, y: cy + lineOff }, thickness: lineThick, color: black });
    if (fields.time) {
        let timeWithAmPm = fields.time;
        if (fields.time.includes(':')) {
            const [h, m] = fields.time.split(':').map(Number);
            const ampm = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 || 12;
            timeWithAmPm = `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
        }
        page.drawText(timeWithAmPm, { x: il + 55 * scale, y: cy + textYOffset, size: fsz, font: helveticaBold, color: blue });
    }
    const byX = il + halfW + 20 * scale;
    page.drawText('By:', { x: byX, y: cy + textYOffset, size: fsz, font: helvetica, color: black });
    page.drawLine({ start: { x: byX + 35 * scale, y: cy + lineOff }, end: { x: byX + 35 * scale + 90 * scale, y: cy + lineOff }, thickness: lineThick, color: black });
    if (fields.receivedBy) page.drawText(fields.receivedBy, { x: byX + 40 * scale, y: cy + textYOffset, size: fsz, font: helveticaBold, color: blue });
}

function centeredText(page, text, cx, y, size, font, color) {
    const tw = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: cx - tw / 2, y, size, font, color });
}
