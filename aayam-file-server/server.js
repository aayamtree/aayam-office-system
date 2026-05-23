/**
 * Aayam File Server
 * Local network file storage server for print files
 * Runs on: http://192.168.1.200:3001
 */

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;
const FILES_DIR = path.join('C:\\', 'AayamFiles');

// ── Create storage directory if it doesn't exist ──────────────
if (!fs.existsSync(FILES_DIR)) {
    fs.mkdirSync(FILES_DIR, { recursive: true });
    console.log(`✅ Created files directory: ${FILES_DIR}`);
}

// ── CORS — allow your Vercel app + local network ──────────────
app.use(cors({
    origin: '*', // Allow all origins (Vercel app + local network)
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
}));

app.use(express.json());

// ── Simple API key protection ─────────────────────────────────
const API_KEY = 'aayam-local-2025'; // Change this if you want more security

function checkApiKey(req, res, next) {
    const key = req.headers['x-api-key'];
    if (key !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// ── Multer — file upload config ───────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Organise by job number if provided
        const jobNumber = req.headers['x-job-number'] || 'misc';
        const jobDir = path.join(FILES_DIR, sanitize(jobNumber));
        if (!fs.existsSync(jobDir)) fs.mkdirSync(jobDir, { recursive: true });
        cb(null, jobDir);
    },
    filename: (req, file, cb) => {
        // Keep original name + timestamp to avoid conflicts
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${sanitize(name)}_${timestamp}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
});

// ── Sanitize filenames ────────────────────────────────────────
function sanitize(name) {
    return name.replace(/[^a-zA-Z0-9._\-]/g, '_');
}

// ── Routes ────────────────────────────────────────────────────

// Health check — no auth needed
app.get('/health', (req, res) => {
    const totalFiles = countFiles(FILES_DIR);
    const diskInfo = getDiskInfo();
    res.json({
        status: 'ok',
        server: 'Aayam File Server',
        version: '1.0.0',
        ip: '192.168.1.200',
        port: PORT,
        filesDir: FILES_DIR,
        totalFiles,
        ...diskInfo,
        uptime: Math.floor(process.uptime()) + 's',
        timestamp: new Date().toISOString(),
    });
});

// Upload a file
app.post('/upload', checkApiKey, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const jobNumber = req.headers['x-job-number'] || 'misc';
    const relativePath = `${sanitize(jobNumber)}/${req.file.filename}`;

    console.log(`📁 Upload: ${relativePath} (${formatBytes(req.file.size)})`);

    res.json({
        success: true,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        path: relativePath,
        size: req.file.size,
        sizeFormatted: formatBytes(req.file.size),
        url: `http://192.168.1.200:${PORT}/files/${relativePath}`,
        uploadedAt: new Date().toISOString(),
    });
});

// Serve / download a file
app.get('/files/*', (req, res) => {
    const filePath = path.join(FILES_DIR, req.params[0]);

    // Security: make sure path is inside FILES_DIR
    if (!filePath.startsWith(FILES_DIR)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath);
});

// List files for a job
app.get('/list/:jobNumber', checkApiKey, (req, res) => {
    const jobDir = path.join(FILES_DIR, sanitize(req.params.jobNumber));

    if (!fs.existsSync(jobDir)) {
        return res.json({ files: [] });
    }

    const files = fs.readdirSync(jobDir).map(filename => {
        const filePath = path.join(jobDir, filename);
        const stat = fs.statSync(filePath);
        return {
            fileName: filename,
            path: `${req.params.jobNumber}/${filename}`,
            size: stat.size,
            sizeFormatted: formatBytes(stat.size),
            url: `http://192.168.1.200:${PORT}/files/${req.params.jobNumber}/${filename}`,
            uploadedAt: stat.birthtime.toISOString(),
        };
    });

    res.json({ files });
});

// Delete a file
app.delete('/files/*', checkApiKey, (req, res) => {
    const filePath = path.join(FILES_DIR, req.params[0]);

    if (!filePath.startsWith(FILES_DIR)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    fs.unlinkSync(filePath);
    console.log(`🗑️  Deleted: ${req.params[0]}`);
    res.json({ success: true });
});

// ── Helpers ───────────────────────────────────────────────────
function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function countFiles(dir) {
    if (!fs.existsSync(dir)) return 0;
    let count = 0;
    fs.readdirSync(dir).forEach(item => {
        const full = path.join(dir, item);
        if (fs.statSync(full).isDirectory()) count += countFiles(full);
        else count++;
    });
    return count;
}

function getDiskInfo() {
    try {
        const { execSync } = require('child_process');
        const output = execSync('wmic logicaldisk where "DeviceID=\'C:\'" get FreeSpace,Size /format:csv')
            .toString().trim().split('\n');
        if (output.length >= 2) {
            const parts = output[output.length - 1].split(',');
            const free = parseInt(parts[1]);
            const total = parseInt(parts[2]);
            return {
                diskFree: formatBytes(free),
                diskTotal: formatBytes(total),
                diskUsedPercent: Math.round((1 - free / total) * 100) + '%'
            };
        }
    } catch { }
    return {};
}

// ── Start server ──────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔══════════════════════════════════════╗');
    console.log('║      Aayam File Server v1.0          ║');
    console.log('╠══════════════════════════════════════╣');
    console.log(`║  Running on: http://192.168.1.200:${PORT} ║`);
    console.log(`║  Files saved to: C:\\AayamFiles\\       ║`);
    console.log('║  Status: READY ✅                     ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');
    console.log('Waiting for file uploads...');
    console.log('(Keep this window open — do not close it)');
    console.log('');
});
