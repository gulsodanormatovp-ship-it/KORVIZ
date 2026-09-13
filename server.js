const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());
app.use(express.static('public')); // Dynamic Frontend UI ni uzatish

const PORT = process.env.PORT || 3000;
const PLATFORM_NAME = "KORVIZ";

// Ma'lumotlar va Loyihalarni saqlash bazasi
const DB_FILE = path.join(__dirname, 'korviz_db.json');
const PROJECTS_DIR = path.join(__dirname, 'deployments');

if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ repositories: [], active_deploys: {} }, null, 2));

// Yordamchi bazaga yozish va o'qish funksiyalari
const readDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// ==========================================
// 1. GITHUB HUB MUQOBILI (REPOSITORIES API)
// ==========================================

// Barcha repozitoriyalarni olish
app.get('/api/repos', (req, res) => {
    const db = readDB();
    res.json(db.repositories);
});

// Yangi repozitoriya yaratish (GitHub kabi)
app.post('/api/repos/create', (req, res) => {
    const { name, description, isPublic, code } = req.body;
    if (!name) return res.status(400).json({ error: "Repozitoriya nomi kiritilmadi!" });

    const db = readDB();
    const newRepo = {
        id: uuidv4(),
        name,
        description: description || "Tavsifsiz loyiha",
        isPublic: isPublic !== undefined ? isPublic : true,
        code: code || "// KORVIZ Platform proyekt kodi",
        createdAt: new Date(),
        stars: 0
    };

    db.repositories.push(newRepo);
    writeDB(db);

    res.status(201).json({ message: "Repozitoriya muvaffaqiyatli yaratildi", repo: newRepo });
});

// ==========================================
// 2. RENDER MUQOBILI (DEPLOY ENGINE API)
// ==========================================

// Git URL yoki Ichki koddni 24/7 Deploy qilish
app.post('/api/deploy', (req, res) => {
    const { name, gitUrl, envVars } = req.body;

    if (!gitUrl) {
        return res.status(400).json({ error: "Deploy uchun gitUrl talab qilinadi!" });
    }

    const projectId = name ? `${name}-${uuidv4().substring(0, 4)}` : uuidv4();
    const projectPath = path.join(PROJECTS_DIR, projectId);

    console.log(`[${PLATFORM_NAME} Deploy] Jarayon boshlandi: ${projectId}`);

    const cloneCmd = `git clone ${gitUrl} ${projectPath}`;
    
    exec(cloneCmd, (cloneErr) => {
        if (cloneErr) {
            return res.status(500).json({ error: "Git klonlashda xatolik bo'ldi", details: cloneErr.message });
        }

        if (envVars && typeof envVars === 'object') {
            const envContent = Object.entries(envVars).map(([k, v]) => `${k}=${v}`).join('\n');
            fs.writeFileSync(path.join(projectPath, '.env'), envContent);
        }

        let startCmd = '';
        if (fs.existsSync(path.join(projectPath, 'package.json'))) {
            startCmd = `cd ${projectPath} && npm install && npm start`;
        } else if (fs.existsSync(path.join(projectPath, 'requirements.txt'))) {
            startCmd = `cd ${projectPath} && pip install -r requirements.txt && python3 main.py`;
        } else {
            return res.status(400).json({ error: "Loyiha turini aniqlab bo'lmadi (package.json topilmadi)." });
        }

        const child = exec(startCmd, { cwd: projectPath });

        const db = readDB();
        db.active_deploys[projectId] = {
            pid: child.pid,
            status: "running",
            startedAt: new Date(),
            gitUrl
        };
        writeDB(db);

        res.json({
            message: "⚡ Loyiha KORVIZ serverida muvaffaqiyatli ishga tushirildi!",
            projectId,
            status: "running"
        });
    });
});

// Faol ishlayotgan barcha serverlarni ko'rish
app.get('/api/deployments', (req, res) => {
    const db = readDB();
    res.json(db.active_deploys);
});

app.listen(PORT, () => {
    console.log(`🚀 ${PLATFORM_NAME} Serveri va Deploy Engine ${PORT}-portda ishlamoqda.`);
});
