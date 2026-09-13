const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 10000;
const PLATFORM_NAME = "KORVIZ";

const DB_FILE = path.join(__dirname, 'korviz_db.json');
const PROJECTS_DIR = path.join(__dirname, 'deployments');

if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ repositories: [], active_deploys: {} }, null, 2));

const readDB = () => {
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch {
        return { repositories: [], active_deploys: {} };
    }
};

const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// 1. Repozitoriyalar API
app.get('/api/repos', (req, res) => {
    const db = readDB();
    res.json(db.repositories);
});

app.post('/api/repos/create', (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "Loyiha nomi kiritilmadi!" });

    const db = readDB();
    const newRepo = {
        id: uuidv4(),
        name,
        description: description || "Tavsifsiz loyiha",
        createdAt: new Date()
    };

    db.repositories.unshift(newRepo);
    writeDB(db);

    res.status(201).json({ message: "Loyiha yaratildi", repo: newRepo });
});

// 2. Deploy Engine API
app.post('/api/deploy', (req, res) => {
    const { name, gitUrl } = req.body;

    if (!gitUrl) {
        return res.status(400).json({ error: "gitUrl talab qilinadi!" });
    }

    const projectId = name ? name : `service-${uuidv4().substring(0, 4)}`;
    const db = readDB();

    // Bulutli hosting registratsiyasi
    db.active_deploys[projectId] = {
        id: projectId,
        status: "ACTIVE",
        gitUrl: gitUrl,
        deployedAt: new Date()
    };
    writeDB(db);

    // Klonlashni sinab ko'rish
    const projectPath = path.join(PROJECTS_DIR, projectId);
    exec(`git clone ${gitUrl} ${projectPath}`, (err) => {
        if (err) {
            console.log(`[${PLATFORM_NAME}] Git clone log:`, err.message);
        }
    });

    res.json({
        message: "Loyiha KORVIZ platformasiga muvaffaqiyatli ulindi va ishga tushirildi!",
        projectId,
        status: "ACTIVE"
    });
});

app.get('/api/deployments', (req, res) => {
    const db = readDB();
    res.json(db.active_deploys);
});

app.listen(PORT, () => {
    console.log(`🚀 ${PLATFORM_NAME} platformasi ${PORT}-portda ishlamoqda.`);
});
