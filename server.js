const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

const PORT = process.env.PORT || 10000;
const DB_FILE = path.join(__dirname, 'korviz_db.json');

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ 
        repositories: [], 
        issues: [], 
        pulls: [], 
        deployments: [], 
        pipelines: [],
        tokens: [],
        logs: [] 
    }, null, 2));
}

const readDB = () => {
    try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch { return { repositories: [], issues: [], pulls: [], deployments: [], pipelines: [], tokens: [], logs: [] }; }
};
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// Analytics Data
app.get('/api/analytics', (req, res) => {
    const db = readDB();
    res.json({
        totalRepos: db.repositories.length,
        totalIssues: db.issues.length,
        totalDeploys: db.deployments.length,
        totalPulls: db.pulls.length,
        serverStatus: "100% OPERATIONAL"
    });
});

// Repositories API
app.get('/api/repos', (req, res) => res.json(readDB().repositories));

app.post('/api/repos/create', (req, res) => {
    const { name, description, isPrivate } = req.body;
    if (!name) return res.status(400).json({ error: "Loyiha nomi kiritilmadi" });

    const db = readDB();
    const repoId = `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${uuidv4().substring(0, 4)}`;

    const newRepo = {
        id: repoId,
        name,
        description: description || "KORVIZ platformasidagi loyiha",
        isPrivate: !!isPrivate,
        stars: 0,
        files: [
            { name: "index.js", content: "// KORVIZ Engine Startup\nconsole.log('App Started successfully!');" },
            { name: "README.md", content: `# ${name}\n\n${description}` }
        ],
        createdAt: new Date().toISOString()
    };

    db.repositories.unshift(newRepo);
    db.logs.unshift({ type: 'REPO', msg: `Yangi repozitoriya yaratildi: ${name}`, date: new Date().toISOString() });
    writeDB(db);

    res.status(201).json(newRepo);
});

// AI Assistant Endpoint (Simulated Engine)
app.post('/api/ai/analyze', (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "Kod yuborilmadi" });

    res.json({
        suggestion: "Kod tuzilishi to'g'ri. Xavfsizlik bo'yicha hech qanday ochiq zanjir (vulnerability) topilmadi.",
        optimization: "Sintaksis optimallashtirildi.",
        status: "PASSED"
    });
});

// CI/CD Pipelines
app.get('/api/pipelines', (req, res) => res.json(readDB().pipelines));
app.post('/api/pipelines/trigger', (req, res) => {
    const { repoId } = req.body;
    const db = readDB();
    const pipeline = {
        id: `pipe-${uuidv4().substring(0, 5)}`,
        repoId,
        status: "SUCCESS",
        steps: ["Lint", "Test", "Build", "Deploy"],
        duration: "1.2s",
        createdAt: new Date().toISOString()
    };
    db.pipelines.unshift(pipeline);
    writeDB(db);
    res.json(pipeline);
});

// Access Tokens API
app.get('/api/tokens', (req, res) => res.json(readDB().tokens));
app.post('/api/tokens/create', (req, res) => {
    const { name } = req.body;
    const db = readDB();
    const newToken = { id: `kvz_pat_${uuidv4().replace(/-/g, '')}`, name: name || "Default Token", createdAt: new Date().toISOString() };
    db.tokens.unshift(newToken);
    writeDB(db);
    res.json(newToken);
});

// Deployments
app.get('/api/deployments', (req, res) => res.json(readDB().deployments));
app.post('/api/deploy', (req, res) => {
    const { serviceName, command } = req.body;
    const db = readDB();
    const newDeploy = {
        id: `srv-${uuidv4().substring(0, 5)}`,
        name: serviceName,
        command: command || 'node index.js',
        status: "RUNNING",
        uptime: "99.9%"
    };
    db.deployments.unshift(newDeploy);
    db.logs.unshift({ type: 'DEPLOY', msg: `Servis ishga tushirildi: ${serviceName}`, date: new Date().toISOString() });
    writeDB(db);
    res.json(newDeploy);
});

app.get('/api/logs', (req, res) => res.json(readDB().logs.slice(0, 20)));

app.listen(PORT, () => console.log(`🚀 KORVIZ Platform 5.0 active on port ${PORT}`));
