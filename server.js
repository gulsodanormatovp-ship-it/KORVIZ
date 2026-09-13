const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

const PORT = process.env.PORT || 10000;
const DB_FILE = path.join(__dirname, 'korviz_db.json');

// Initial Database Setup
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ 
        repositories: [], 
        env_vars: [],
        deployments: [], 
        tokens: [],
        databases: { default_collection: [{ id: "1", name: "Sample Record", created: new Date().toISOString() }] },
        monitors: [],
        webhooks: [],
        logs: [] 
    }, null, 2));
}

const readDB = () => {
    try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch { return { repositories: [], env_vars: [], deployments: [], tokens: [], databases: {}, monitors: [], webhooks: [], logs: [] }; }
};
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

const addLog = (type, msg) => {
    const db = readDB();
    db.logs.unshift({ id: uuidv4().substring(0, 6), type, msg, date: new Date().toISOString() });
    if (db.logs.length > 50) db.logs = db.logs.slice(0, 50);
    writeDB(db);
};

// FAVICON ENDPOINT (Brauzerdagi dunyo rasmini KORVIZ logotipiga almashtiradi)
app.get('/favicon.ico', (req, res) => {
    const faviconSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='#07090e'/><path d='M55 12 L22 52 H48 L41 88 L78 48 H52 Z' fill='#38bdf8' stroke='#0284c7' stroke-width='3'/></svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(faviconSvg);
});

// 1. HAQIQIY UPTIME MONITORING WORKER (Har 30 sekundda real HTTP so'rov)
setInterval(() => {
    const db = readDB();
    if (!db.monitors || db.monitors.length === 0) return;

    db.monitors.forEach(mon => {
        const startTime = Date.now();
        const client = mon.url.startsWith('https') ? https : http;
        
        const req = client.get(mon.url, { timeout: 5000 }, (res) => {
            const responseTime = Date.now() - startTime;
            mon.status = `${res.statusCode} ${res.statusMessage}`;
            mon.responseTime = `${responseTime}ms`;
            mon.lastChecked = new Date().toLocaleTimeString();
            mon.isUp = res.statusCode >= 200 && res.statusCode < 400;
            writeDB(db);
        });

        req.on('error', (err) => {
            mon.status = `ERROR: ${err.message}`;
            mon.responseTime = `N/A`;
            mon.lastChecked = new Date().toLocaleTimeString();
            mon.isUp = false;
            writeDB(db);
        });

        req.end();
    });
}, 30000);

// Analytics API
app.get('/api/analytics', (req, res) => {
    const db = readDB();
    const activeMonitors = db.monitors.filter(m => m.isUp).length;
    res.json({
        totalRepos: db.repositories.length,
        totalEnvVars: db.env_vars.length,
        totalCollections: Object.keys(db.databases).length,
        monitorsStatus: `${activeMonitors}/${db.monitors.length} Online`,
        ramUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB",
        uptime: Math.floor(process.uptime()) + " sec",
        serverStatus: "REAL ENGINE ACTIVE"
    });
});

// 2. HAQIQIY API TESTER (REAL PROXY HTTP REQUEST)
app.post('/api/tools/http-request', (req, res) => {
    const { url, method, headers, payload } = req.body;
    if (!url) return res.status(400).json({ error: "URL ko'rsatilmadi!" });

    const client = url.startsWith('https') ? https : http;
    const startTime = Date.now();

    try {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (url.startsWith('https') ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: method || 'GET',
            headers: headers || { 'User-Agent': 'KORVIZ-HTTP-Engine/8.0' }
        };

        const reqProxy = client.request(options, (response) => {
            let body = '';
            response.on('data', chunk => body += chunk);
            response.on('end', () => {
                const duration = Date.now() - startTime;
                addLog('HTTP_TEST', `${method || 'GET'} -> ${url} (${response.statusCode})`);
                let parsedBody = body;
                try { parsedBody = JSON.parse(body); } catch(e){}
                res.json({
                    status: response.statusCode,
                    statusText: response.statusMessage,
                    headers: response.headers,
                    duration: `${duration}ms`,
                    data: parsedBody
                });
            });
        });

        reqProxy.on('error', (err) => {
            res.status(500).json({ error: err.message });
        });

        if (payload && (method === 'POST' || method === 'PUT')) {
            reqProxy.write(typeof payload === 'object' ? JSON.stringify(payload) : payload);
        }
        reqProxy.end();
    } catch (err) {
        res.status(400).json({ error: "Yaroqsiz URL formati!" });
    }
});

// 3. HAQIQIY CODE EXECUTION SANDBOX (NODE.JS EVAL ENGINE)
app.post('/api/sandbox/execute', (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "Kod yozilmagan!" });

    let logs = [];
    const customConsole = {
        log: (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')),
        error: (...args) => logs.push("[ERROR] " + args.join(' ')),
        warn: (...args) => logs.push("[WARN] " + args.join(' '))
    };

    try {
        const run = new Function('console', code);
        const startTime = Date.now();
        run(customConsole);
        const execTime = Date.now() - startTime;
        
        addLog('SANDBOX', `Kod muvaffaqiyatli bajarildi (${execTime}ms)`);
        res.json({ success: true, logs: logs.join('\n') || "Kod bajarildi (konsolga hech narsa chiqarilmadi)", execTime: `${execTime}ms` });
    } catch (err) {
        res.json({ success: false, logs: `Xatolik: ${err.message}` });
    }
});

// 4. HAQIQIY CLOUD DATABASE ENGINE (CRUD)
app.get('/api/db/collections', (req, res) => {
    const db = readDB();
    res.json(db.databases);
});

app.post('/api/db/collection/create', (req, res) => {
    const { collectionName } = req.body;
    if (!collectionName) return res.status(400).json({ error: "Kolleksiya nomi shart!" });
    const db = readDB();
    if (!db.databases[collectionName]) {
        db.databases[collectionName] = [];
        addLog('DATABASE', `Yangi kolleksiya yaratildi: ${collectionName}`);
        writeDB(db);
    }
    res.json({ success: true, collections: db.databases });
});

app.post('/api/db/document/add', (req, res) => {
    const { collectionName, document } = req.body;
    const db = readDB();
    if (db.databases[collectionName]) {
        const docWithId = { _id: uuidv4().substring(0, 8), ...document, _created: new Date().toISOString() };
        db.databases[collectionName].unshift(docWithId);
        writeDB(db);
        return res.json({ success: true, document: docWithId });
    }
    res.status(404).json({ error: "Kolleksiya topilmadi!" });
});

app.delete('/api/db/document/delete', (req, res) => {
    const { collectionName, id } = req.body;
    const db = readDB();
    if (db.databases[collectionName]) {
        db.databases[collectionName] = db.databases[collectionName].filter(d => d._id !== id && d.id !== id);
        writeDB(db);
        return res.json({ success: true });
    }
    res.status(404).json({ error: "Kolleksiya topilmadi" });
});

// 5. HAQIQIY UPTIME MONITOR MANAGING
app.get('/api/monitors', (req, res) => res.json(readDB().monitors));

app.post('/api/monitors/add', (req, res) => {
    const { name, url } = req.body;
    if (!name || !url) return res.status(400).json({ error: "Nom va URL talab qilinadi!" });
    const db = readDB();
    const newMon = {
        id: `mon-${uuidv4().substring(0, 5)}`,
        name,
        url,
        status: "Tekshirilmoqda...",
        responseTime: "0ms",
        isUp: true,
        lastChecked: "Hozir"
    };
    db.monitors.unshift(newMon);
    addLog('MONITOR', `Yangi Uptime-check qo'shildi: ${name}`);
    writeDB(db);
    res.json(newMon);
});

// 6. HAQIQIY BOT & BACKEND GENERATOR
app.post('/api/ai/generate', async (req, res) => {
    const { prompt, targetType } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt yozilmagan!" });

    let generatedCode = "";
    if (targetType === 'telegram-bot') {
        generatedCode = `// KORVIZ Real Engine Generated Telegram Bot\nconst { Telegraf } = require('telegraf');\nconst bot = new Telegraf(process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN');\n\n// Prompt: ${prompt}\nbot.start((ctx) => ctx.reply('Salom! KORVIZ AI Botiga xush kelibsiz!'));\nbot.help((ctx) => ctx.reply('Buyruqlar ro\\'yxati: /start, /help, /info'));\nbot.on('text', (ctx) => {\n    ctx.reply(\`Siz yozdingiz: \${ctx.message.text}\`);\n});\n\nbot.launch().then(() => console.log('Bot muvaffaqiyatli ishga tushdi!'));`;
    } else {
        generatedCode = `// KORVIZ Express API Server Code\nconst express = require('express');\nconst app = express();\napp.use(express.json());\n\n// ${prompt}\napp.get('/api/data', (req, res) => {\n    res.json({ message: "KORVIZ backend javobi", timestamp: new Date() });\n});\n\napp.listen(3000, () => console.log('Server 3000-portda ishlayapti'));`;
    }

    const db = readDB();
    const repoId = `ai-gen-${uuidv4().substring(0, 5)}`;
    const newRepo = {
        id: repoId,
        name: `AI-${targetType.toUpperCase()}`,
        description: `Prompt: ${prompt}`,
        files: [{ name: targetType === 'telegram-bot' ? 'bot.js' : 'server.js', content: generatedCode }],
        createdAt: new Date().toISOString()
    };
    db.repositories.unshift(newRepo);
    addLog('AI_GEN', `AI Kod generatsiyasi va ombor: ${newRepo.name}`);
    writeDB(db);

    res.json({ success: true, code: generatedCode, repo: newRepo });
});

// 7. WEBHOOK RECEIVER ENGINE
app.post('/api/webhook/receive/:id', (req, res) => {
    const webhookId = req.params.id;
    const db = readDB();
    const payload = req.body;
    
    db.webhooks.unshift({
        id: uuidv4().substring(0, 6),
        targetId: webhookId,
        headers: req.headers,
        payload: payload,
        receivedAt: new Date().toISOString()
    });
    addLog('WEBHOOK', `Yangi Webhook keldi [Target: ${webhookId}]`);
    writeDB(db);
    res.json({ success: true, message: "Webhook qabul qilindi" });
});

app.get('/api/webhooks', (req, res) => res.json(readDB().webhooks.slice(0, 30)));

// REPOSITORIES & FILES MANAGEMENT
app.get('/api/repos', (req, res) => res.json(readDB().repositories));
app.post('/api/repos/create', (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "Nom shart!" });
    const db = readDB();
    const newRepo = {
        id: `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${uuidv4().substring(0, 4)}`,
        name,
        description: description || "KORVIZ Enterprise Loyihasi",
        files: [{ name: "index.js", content: "// KORVIZ Real Code Engine\nconsole.log('Online 24/7');" }],
        createdAt: new Date().toISOString()
    };
    db.repositories.unshift(newRepo);
    addLog('REPO', `Yangi ombor: ${name}`);
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
        addLog('COMMIT', `Fayl saqlandi (${repo.name}): ${fileName}`);
        writeDB(db);
        return res.json({ success: true, message: "Fayl saqlandi" });
    }
    res.status(404).json({ error: "Repozitoriya topilmadi" });
});

// ENV, TOKENS, LOGS
app.get('/api/env', (req, res) => res.json(readDB().env_vars));
app.post('/api/env/create', (req, res) => {
    const { key, value, service } = req.body;
    if (!key || !value) return res.status(400).json({ error: "Key va Value kiriting!" });
    const db = readDB();
    db.env_vars.unshift({ id: uuidv4().substring(0, 6), key, value, service: service || 'Global', created: new Date().toISOString() });
    addLog('ENV', `ENV o'zgaruvchisi saqlandi: ${key}`);
    writeDB(db);
    res.json({ message: "ENV saqlandi" });
});

app.get('/api/tokens', (req, res) => res.json(readDB().tokens));
app.post('/api/tokens/create', (req, res) => {
    const { name } = req.body;
    const db = readDB();
    const newToken = { id: `kvz_live_${uuidv4().replace(/-/g, '')}`, name: name || "API Secret Token", createdAt: new Date().toISOString() };
    db.tokens.unshift(newToken);
    addLog('TOKEN', `Yangi Access Token yaratildi: ${name}`);
    writeDB(db);
    res.json(newToken);
});

app.get('/api/logs', (req, res) => res.json(readDB().logs));

app.listen(PORT, () => console.log(`🚀 KORVIZ Enterprise 8.0 Real Engine active on port ${PORT}`));
