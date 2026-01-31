const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

// CONFIG
const SCRIPTS_DIR = path.join(__dirname, '../scripts');
const MANAGER_SCRIPT = path.join(SCRIPTS_DIR, 'manage-reference-repos.ps1');
// Default repos path (can be overridden)
let REPOS_ROOT = "D:\\Projects\\reference-repos";

console.log("Using REPOS_ROOT:", REPOS_ROOT);

// Helper to run PowerShell
function runScript(args, res) {
    const ps = spawn('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', MANAGER_SCRIPT,
        '-ReposRoot', REPOS_ROOT,
        ...args
    ]);

    let output = '';
    let error = '';

    ps.stdout.on('data', (data) => {
        const str = data.toString();
        output += str;
        console.log(`[PS] ${str.trim()}`);
    });

    ps.stderr.on('data', (data) => {
        error += data.toString();
        console.error(`[PS-ERR] ${data.toString().trim()}`);
    });

    ps.on('close', (code) => {
        if (code !== 0) {
            res.status(500).json({ success: false, output, error });
        } else {
            res.json({ success: true, output });
        }
    });
}

// API
app.get('/api/status', (req, res) => {
    res.json({ status: 'Online', reposRoot: REPOS_ROOT });
});

app.get('/api/repos', (req, res) => {
    // We scrape the list output or just read the json directly?
    // Reading JSON is safer and faster.
    const registryPath = path.join(REPOS_ROOT, '_system', 'repos.json');
    if (fs.existsSync(registryPath)) {
        try {
            const data = fs.readFileSync(registryPath, 'utf8').replace(/^\uFEFF/, '');
            res.json(JSON.parse(data));
        } catch (e) {
            console.error("Repo read error:", e);
            res.status(500).json({ error: "Failed to read registry" });
        }
    } else {
        res.json([]);
    }
});

app.post('/api/scan', (req, res) => {
    runScript(['-Scan'], res);
});

app.post('/api/add', (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL required" });
    runScript(['-Add', url], res);
});

app.get('/api/categories', (req, res) => {
    try {
        if (!fs.existsSync(REPOS_ROOT)) {
            return res.json([]);
        }
        const dirs = fs.readdirSync(REPOS_ROOT, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.') && !dirent.name.startsWith('_'))
            .map(dirent => dirent.name);
        res.json(dirs);
    } catch (e) {
        console.error("Categories read error:", e);
        res.status(500).json({ error: "Failed to list categories" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
