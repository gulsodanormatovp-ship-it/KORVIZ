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
        env_vars: [],
        deployments: [], 
        pipelines: [],
        tokens: [],
        databases: [{ name: "users_db", records: [{ id: 1, username: "admin", role: "owner" }] }],
        crons: [],
        monitors: [{ id: "m1", name: "Main API", url: "https://korviz.onrender.com", status: "200 OK", uptime: "100%" }],
        logs: [] 
    }, null, 2));
}

const readDB = () => {
    try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch { return { repositories: [], env_vars: [], deployments: [], pipelines: [], tokens: [], databases: [], crons: [], monitors: [], logs: [] }; }
};
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// Analytics
app.get('/api/analytics', (req, res) => {
    const db = readDB();
    res.json({
        totalRepos: db.repositories.length,
        totalEnvVars: db.env_vars.length,
        totalDatabases: db.databases.length,
        totalMonitors: db.monitors.length,
        cpuLoad: (Math.random() * 3 + 1).toFixed(1) + "%",
        ramUsage: Math.floor(Math.random() * 15 + 45) + " MB",
        serverStatus: "RUNNING 24/7"
    });
});

// 1. AI BOT GENERATOR
app.post('/api/ai/generate-bot', (req, res) => {
    const { prompt, botName, language } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt kiriting!" });

    const isPython = language === 'python';
    let code = "";

    if (isPython) {
        code = `# KORVIZ AI Generated Bot (${botName})\nimport logging\nfrom aiogram import Bot, Dispatcher, executor, types\n\nAPI_TOKEN = 'YOUR_BOT_TOKEN'\nbot = Bot(token=API_TOKEN)\ndp = Dispatcher(bot)\n\n@dp.message_handler(commands=['start'])\nasync def send_welcome(message: types.Message):\n    await message.reply("Salom! ${prompt} xizmatiga xush kelibsiz!")\n\nif __name__ == '__main__':\n    executor.start_polling(dp, skip_updates=True)`;
    } else {
        code = `// KORVIZ AI Generated Bot (${botName})\nconst { Telegraf } = require('telegraf');\nconst bot = new Telegraf(process.env.BOT_TOKEN);\n\nbot.start((ctx) => ctx.reply('Salom! ${prompt} botiga xush kelibsiz!'));\nbot.launch();\nconsole.log('Bot running...');`;
    }

    const db = readDB();
    const repoId = `bot-${uuidv4().substring(0, 5)}`;
    const newRepo = {
        id: repoId,
        name: botName || "AI-Generated-Bot",
        description: `AI Prompt: ${prompt}`,
        files: [{ name: isPython ? "main.py" : "index.js", content: code }],
        createdAt: new Date().toISOString()
    };

    db.repositories.unshift(newRepo);
    db.logs.unshift({ type: 'AI_BOT', msg: `AI Bot yaratildi: ${newRepo.name}`, date: new Date().toISOString() });
    writeDB(db);

    res.json({ success: true, repo: newRepo, code });
});

// 2. CLOUD DATABASE MANAGER
app.get('/api/db', (req, res) => res.json(readDB().databases));
app.post('/api/db/create-table', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Jadval nomi shart!" });
    const db = readDB();
    db.databases.push({ name, records: [] });
    db.logs.unshift({ type: 'DATABASE', msg: `Yangi DB jadvali: ${name}`, date: new Date().toISOString() });
    writeDB(db);
    res.json({ message: "Jadval yaratildi" });
});

app.post('/api/db/add-record', (req, res) => {
    const { tableName, record } = req.body;
    const db = readDB();
    const targetDb = db.databases.find(d => d.name === tableName);
    if (targetDb) {
        targetDb.records.push({ id: Date.now(), ...record });
        writeDB(db);
        return res.json({ message: "Yozuv qo'shildi" });
    }
    res.status(404).json({ error: "Jadval topilmadi" });
});

// 3. UPTIME MONITORING
app.get('/api/monitors', (req, res) => res.json(readDB().monitors));
app.post('/api/monitors/add', (req, res) => {
    const { name, url } = req.body;
    const db = readDB();
    const newMon = { id: `m-${uuidv4().substring(0, 4)}`, name, url, status: "200 OK", uptime: "100%" };
    db.monitors.unshift(newMon);
    writeDB(db);
    res.json(newMon);
});

// REPOS & FILE SAVING
app.get('/api/repos', (req, res) => res.json(readDB().repositories));
app.post('/api/repos/create', (req, res) => {
    const { name, description } = req.body;
    const db = readDB();
    const newRepo = {
        id: `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${uuidv4().substring(0, 4)}`,
        name,
        description: description || "KORVIZ loyihasi",
        files: [{ name: "index.js", content: "console.log('Started');" }],
        createdAt: new Date().toISOString()
    };
    db.repositories.unshift(newRepo);
    writeDB(db);
    res.json(newRepo);
});

app.post('/api/repos/:id/file/save', (req, res) => {
    const { fileName, content } = req.body;
    const db = readDB();
    const repo = db.repositories.find(r => r.id === req.params.id);
    if (repo) {
        const file = repo.files.find(f => f.name === fileName);
        if (file) file.content = content;
        else repo.files.push({ name: fileName, content });
        writeDB(db);
        return res.json({ message: "Saqlandi" });
    }
    res.status(404).json({ error: "Topilmadi" });
});

// ENV, DEPLOYS, TOKENS, LOGS
app.get('/api/env', (req, res) => res.json(readDB().env_vars));
app.post('/api/env/create', (req, res) => {
    const { key, value, service } = req.body;
    const db = readDB();
    db.env_vars.unshift({ id: uuidv4().substring(0, 6), key, value, service: service || 'Global' });
    writeDB(db);
    res.json({ message: "ENV saqlandi" });
});

app.get('/api/deployments', (req, res) => res.json(readDB().deployments));
app.post('/api/deploy', (req, res) => {
    const { serviceName, command } = req.body;
    const db = readDB();
    const newDeploy = { id: `srv-${uuidv4().substring(0, 5)}`, name: serviceName, command: command || 'node index.js', status: "RUNNING 24/7", port: 10000 };
    db.deployments.unshift(newDeploy);
    writeDB(db);
    res.json(newDeploy);
});

app.get('/api/tokens', (req, res) => res.json(readDB().tokens));
app.post('/api/tokens/create', (req, res) => {
    const { name } = req.body;
    const db = readDB();
    const newToken = { id: `kvz_pat_${uuidv4().replace(/-/g, '')}`, name: name || "API Token", createdAt: new Date().toISOString() };
    db.tokens.unshift(newToken);
    writeDB(db);
    res.json(newToken);
});

app.get('/api/logs', (req, res) => res.json(readDB().logs.slice(0, 25)));

app.listen(PORT, () => console.log(`🚀 KORVIZ Platform 7.0 Ultimate active on port ${PORT}`));
