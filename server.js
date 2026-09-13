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
        pull_requests: [], 
        commits: [], 
        deployments: [], 
        activity_logs: [] 
    }, null, 2));
}

const readDB = () => {
    try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch { return { repositories: [], issues: [], pull_requests: [], commits: [], deployments: [], activity_logs: [] }; }
};
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// 1. REPO & BRANCHES
app.get('/api/repos', (req, res) => res.json(readDB().repositories));

app.post('/api/repos/create', (req, res) => {
    const { name, description, initialCode } = req.body;
    if (!name) return res.status(400).json({ error: "Loyiha nomi shart!" });

    const db = readDB();
    const repoId = `${name.toLowerCase().replace(/\s+/g, '-')}-${uuidv4().substring(0, 4)}`;

    const newRepo = {
        id: repoId,
        name,
        description: description || "Tavsifsiz loyiha",
        branches: ['main', 'dev'],
        currentBranch: 'main',
        stars: 0,
        forks: 0,
        createdAt: new Date()
    };

    db.repositories.unshift(newRepo);
    db.commits.unshift({
        id: uuidv4().substring(0, 7),
        repoId,
        message: "Initial Commit",
        author: "Developer",
        date: new Date()
    });
    db.activity_logs.unshift({ type: 'REPO', msg: `Ombor yaratildi: ${name}`, date: new Date() });
    
    writeDB(db);
    res.status(201).json({ message: "Repozitoriya yaratildi", repo: newRepo });
});

// STAR & FORK
app.post('/api/repos/:id/star', (req, res) => {
    const db = readDB();
    const repo = db.repositories.find(r => r.id === req.params.id);
    if (repo) {
        repo.stars = (repo.stars || 0) + 1;
        writeDB(db);
        return res.json({ stars: repo.stars });
    }
    res.status(404).json({ error: "Topilmadi" });
});

// 2. ISSUES SYSTEM
app.get('/api/issues', (req, res) => res.json(readDB().issues));

app.post('/api/issues/create', (req, res) => {
    const { repoId, title, body, priority } = req.body;
    const db = readDB();
    const newIssue = {
        id: `ISSUE-${db.issues.length + 1}`,
        repoId,
        title,
        body,
        priority: priority || 'Normal',
        status: 'OPEN',
        createdAt: new Date()
    };
    db.issues.unshift(newIssue);
    db.activity_logs.unshift({ type: 'ISSUE', msg: `Yangi Issue: #${newIssue.id} - ${title}`, date: new Date() });
    writeDB(db);
    res.json(newIssue);
});

// 3. PULL REQUESTS SYSTEM
app.get('/api/pulls', (req, res) => res.json(readDB().pull_requests));

app.post('/api/pulls/create', (req, res) => {
    const { repoId, title, sourceBranch, targetBranch } = req.body;
    const db = readDB();
    const newPR = {
        id: `PR-${db.pull_requests.length + 1}`,
        repoId,
        title,
        sourceBranch,
        targetBranch: targetBranch || 'main',
        status: 'OPEN',
        createdAt: new Date()
    };
    db.pull_requests.unshift(newPR);
    db.activity_logs.unshift({ type: 'PR', msg: `Yangi Pull Request: ${title}`, date: new Date() });
    writeDB(db);
    res.json(newPR);
});

// 4. COMMITS HISTORY
app.get('/api/commits', (req, res) => res.json(readDB().commits));

// 5. DEPLOYS & LOGS
app.get('/api/deployments', (req, res) => res.json(readDB().deployments));
app.post('/api/deploy', (req, res) => {
    const { serviceName, runCmd } = req.body;
    const db = readDB();
    const newDeploy = {
        id: `srv-${uuidv4().substring(0, 5)}`,
        name: serviceName,
        command: runCmd || 'node index.js',
        status: 'ACTIVE 24/7',
        cpu: '0.1%',
        ram: '32MB'
    };
    db.deployments.unshift(newDeploy);
    db.activity_logs.unshift({ type: 'DEPLOY', msg: `Server yurgizildi: ${serviceName}`, date: new Date() });
    writeDB(db);
    res.json(newDeploy);
});

app.get('/api/logs', (req, res) => res.json(readDB().activity_logs.slice(0, 30)));

app.listen(PORT, () => console.log(`🚀 KORVIZ Platform 4.0 Pro Engine running on port ${PORT}`));
