const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

const PORT = process.env.PORT || 10000;
const PLATFORM_NAME = "KORVIZ Engine v2.0";

const DB_FILE = path.join(__dirname, 'korviz_db.json');
const REPOS_DIR = path.join(__dirname, 'storage_repos');
const DEPLOYS_DIR = path.join(__dirname, 'storage_deploys');

if (!fs.existsSync(REPOS_DIR)) fs.mkdirSync(REPOS_DIR, { recursive: true });
if (!fs.existsSync(DEPLOYS_DIR)) fs.mkdirSync(DEPLOYS_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ repositories: [], deployments: [], activity_logs: [] }, null, 2));
}

const readDB = () => {
    try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch { return { repositories: [], deployments: [], activity_logs: [] }; }
};
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// ==========================================
// 1. KOD OMBORI (REPOSITORY ENGINE)
// ==========================================

// Repozitoriyalar ro'yxati
app.get('/api/repos', (req, res) => {
    const db = readDB();
    res.json(db.repositories);
});

// Yangi Repozitoriya yaratish
app.post('/api/repos/create', (req, res) => {
    const { name, description, defaultBranch, isPrivate, initialCode } = req.body;
    if (!name) return res.status(400).json({ error: "Loyiha nomi kiritilmadi" });

    const db = readDB();
    const repoId = `${name.toLowerCase().replace(/\s+/g, '-')}-${uuidv4().substring(0, 4)}`;
    const repoPath = path.join(REPOS_DIR, repoId);

    fs.mkdirSync(repoPath, { recursive: true });
    
    // Boshlang'ich fayllar yaratish
    const mainFileName = 'index.js';
    fs.writeFileSync(path.join(repoPath, mainFileName), initialCode || '// KORVIZ Platform Code\nconsole.log("KORVIZ System Active");');
    fs.writeFileSync(path.join(repoPath, 'README.md'), `# ${name}\n\n${description || 'KORVIZ platformasida yaratilgan loyiha'}`);

    const newRepo = {
        id: repoId,
        name,
        description: description || "Tavsifsiz loyiha",
        branch: defaultBranch || 'main',
        isPrivate: !!isPrivate,
        stars: 0,
        commitsCount: 1,
        files: [mainFileName, 'README.md'],
        createdAt: new Date()
    };

    db.repositories.unshift(newRepo);
    db.activity_logs.unshift({ type: 'REPO_CREATE', msg: `Yangi repozitoriya yaratildi: ${name}`, date: new Date() });
    writeDB(db);

    res.status(201).json({ message: "Repozitoriya yaratildi", repo: newRepo });
});

// Repozitoriya ichidagi fayllarni ko'rish
app.get('/api/repos/:id/files', (req, res) => {
    const repoPath = path.join(REPOS_DIR, req.params.id);
    if (!fs.existsSync(repoPath)) return res.status(404).json({ error: "Repozitoriya topilmadi" });

    const files = fs.readdirSync(repoPath);
    res.json({ files });
});

// Fayl mazmunini o'qish
app.get('/api/repos/:id/file-content', (req, res) => {
    const { fileName } = req.query;
    const filePath = path.join(REPOS_DIR, req.params.id, fileName);

    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Fayl topilmadi" });

    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ fileName, content });
});

// Faylni tahrirlash / Commit qilish
app.post('/api/repos/:id/commit', (req, res) => {
    const { fileName, content, commitMessage } = req.body;
    const repoPath = path.join(REPOS_DIR, req.params.id);

    if (!fs.existsSync(repoPath)) return res.status(404).json({ error: "Repozitoriya topilmadi" });

    fs.writeFileSync(path.join(repoPath, fileName), content);

    const db = readDB();
    const repo = db.repositories.find(r => r.id === req.params.id);
    if (repo) {
        repo.commitsCount = (repo.commitsCount || 1) + 1;
        if (!repo.files.includes(fileName)) repo.files.push(fileName);
    }
    db.activity_logs.unshift({ type: 'COMMIT', msg: `Commit (${req.params.id}): ${commitMessage || 'Fayl tahrirlandi'}`, date: new Date() });
    writeDB(db);

    res.json({ message: "Commit muvaffaqiyatli saqlandi!" });
});

// ==========================================
// 2. BULUTLI HOSTING ENGINE (DEPLOYMENT)
// ==========================================

app.get('/api/deployments', (req, res) => {
    const db = readDB();
    res.json(db.deployments);
});

app.post('/api/deploy', (req, res) => {
    const { serviceName, repoId, envVars, runCommand } = req.body;

    if (!serviceName) return res.status(400).json({ error: "Servis nomi talab qilinadi" });

    const db = readDB();
    const deployId = `srv-${uuidv4().substring(0, 6)}`;

    const newDeploy = {
        id: deployId,
        name: serviceName,
        repoId: repoId || 'external-git',
        envVars: envVars || {},
        command: runCommand || 'node index.js',
        status: "RUNNING 24/7",
        cpuUsage: "0.2%",
        ramUsage: "28MB",
        deployedAt: new Date()
    };

    db.deployments.unshift(newDeploy);
    db.activity_logs.unshift({ type: 'DEPLOY', msg: `Servis ishga tushdi: ${serviceName}`, date: new Date() });
    writeDB(db);

    res.json({ message: "⚡ Servis KORVIZ serverida ishga tushdi!", deploy: newDeploy });
});

// System Activity Logs
app.get('/api/logs', (req, res) => {
    const db = readDB();
    res.json(db.activity_logs.slice(0, 20));
});

app.listen(PORT, () => {
    console.log(`🚀 ${PLATFORM_NAME} serveri ${PORT}-portda ishlamoqda.`);
});
