const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 4173;
const ROOT = __dirname;
const DB_FILE = path.join(ROOT, 'data', 'fixcord-db.json');
const sessions = new Map();

function uid(prefix) {
  return `${prefix}_${crypto.randomBytes(5).toString('hex')}`;
}

function nowTime() {
  return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
}

function seedState() {
  const botId = 'fixbot';
  const novaId = 'nova';
  const serverId = uid('srv');
  const generalId = uid('chn');
  const announcementsId = uid('chn');

  return {
    users: [
      { id: botId, username: 'FixBot', passwordHash: '', status: 'online', system: true },
      { id: novaId, username: 'Nova', passwordHash: '', status: 'online', system: true }
    ],
    servers: [
      {
        id: serverId,
        name: 'Fixcord Hub',
        ownerId: botId,
        members: [botId, novaId],
        channels: [
          { id: generalId, name: 'general', messages: [{ id: uid('msg'), authorId: botId, text: 'Добро пожаловать в Fixcord backend.', time: nowTime(), edited: false }] },
          { id: announcementsId, name: 'announcements', messages: [{ id: uid('msg'), authorId: botId, text: 'Работают API авторизации, серверов, каналов и DM.', time: nowTime(), edited: false }] }
        ]
      }
    ],
    dms: []
  };
}

function readDb() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = seedState();
    writeDb(initial);
    return initial;
  }

  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    const reset = seedState();
    writeDb(reset);
    return reset;
  }
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

let db = readDb();

function sendJson(res, status, data) {
  if (res.headersSent || res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function sendText(res, status, text) {
  if (res.headersSent || res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) req.destroy();
    });
    req.on('end', () => {
      if (!raw) resolve({});
      else {
        try { resolve(JSON.parse(raw)); } catch { reject(new Error('invalid_json')); }
      }
    });
    req.on('error', reject);
  });
}

function sanitizeUser(user) {
  return { id: user.id, username: user.username, status: user.status, system: user.system };
}

function authUser(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const userId = sessions.get(token);
  if (!userId) return null;
  return db.users.find((u) => u.id === userId) || null;
}

function bootstrapFor(user) {
  const servers = db.servers
    .filter((s) => s.members.includes(user.id) || user.system)
    .map((s) => ({
      ...s,
      members: s.members.map((id) => sanitizeUser(db.users.find((u) => u.id === id))).filter(Boolean)
    }));

  const dms = db.dms.filter((d) => d.participants.includes(user.id));

  return {
    me: sanitizeUser(user),
    users: db.users.map(sanitizeUser),
    servers,
    dms
  };
}

function routeApi(req, res, pathname) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
    });
    res.end();
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/auth/register') {
    parseBody(req).then((body) => {
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      if (username.length < 3 || password.length < 4) return sendJson(res, 400, { error: 'Некорректные данные.' });
      if (db.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) return sendJson(res, 409, { error: 'Пользователь уже существует.' });

      const user = { id: uid('usr'), username, passwordHash: hashPassword(password), status: 'online', system: false };
      db.users.push(user);
      db.servers[0].members.push(user.id);
      writeDb(db);

      const token = uid('tkn');
      sessions.set(token, user.id);
      sendJson(res, 201, { token, me: sanitizeUser(user) });
    }).catch(() => sendJson(res, 400, { error: 'Неверный JSON.' }));
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    parseBody(req).then((body) => {
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      const user = db.users.find((u) => !u.system && u.username.toLowerCase() === username.toLowerCase());
      if (!user || !verifyPassword(password, user.passwordHash)) return sendJson(res, 401, { error: 'Неверные учетные данные.' });

      user.status = 'online';
      writeDb(db);
      const token = uid('tkn');
      sessions.set(token, user.id);
      sendJson(res, 200, { token, me: sanitizeUser(user) });
    }).catch(() => sendJson(res, 400, { error: 'Неверный JSON.' }));
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) sessions.delete(auth.slice(7));
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (pathname.startsWith('/api/')) {
    const me = authUser(req);
    if (!me) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/bootstrap') {
      sendJson(res, 200, bootstrapFor(me));
      return true;
    }

    if (req.method === 'PATCH' && pathname === '/api/me/status') {
      parseBody(req).then((body) => {
        const allowed = ['online', 'idle', 'dnd', 'offline'];
        const next = String(body.status || '');
        if (!allowed.includes(next)) return sendJson(res, 400, { error: 'Bad status' });
        me.status = next;
        writeDb(db);
        sendJson(res, 200, { me: sanitizeUser(me) });
      }).catch(() => sendJson(res, 400, { error: 'Неверный JSON.' }));
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/servers') {
      parseBody(req).then((body) => {
        const name = String(body.name || '').trim();
        if (!name) return sendJson(res, 400, { error: 'Имя сервера обязательно.' });
        const server = { id: uid('srv'), name, ownerId: me.id, members: [me.id], channels: [{ id: uid('chn'), name: 'general', messages: [] }] };
        db.servers.push(server);
        writeDb(db);
        sendJson(res, 201, server);
      }).catch(() => sendJson(res, 400, { error: 'Неверный JSON.' }));
      return true;
    }

    if (req.method === 'POST' && pathname.match(/^\/api\/servers\/[^/]+\/channels$/)) {
      parseBody(req).then((body) => {
        const serverId = pathname.split('/')[3];
        const server = db.servers.find((s) => s.id === serverId);
        if (!server) return sendJson(res, 404, { error: 'Server not found' });
        if (!server.members.includes(me.id)) return sendJson(res, 403, { error: 'No access' });
        const name = String(body.name || '').replace(/^#/, '').trim();
        if (!name) return sendJson(res, 400, { error: 'Имя канала обязательно.' });
        const channel = { id: uid('chn'), name, messages: [] };
        server.channels.push(channel);
        writeDb(db);
        sendJson(res, 201, channel);
      }).catch(() => sendJson(res, 400, { error: 'Неверный JSON.' }));
      return true;
    }

    if (req.method === 'POST' && pathname.match(/^\/api\/channels\/[^/]+\/messages$/)) {
      parseBody(req).then((body) => {
        const channelId = pathname.split('/')[3];
        const channel = db.servers.flatMap((s) => s.channels).find((c) => c.id === channelId);
        if (!channel) return sendJson(res, 404, { error: 'Channel not found' });
        const text = String(body.text || '').trim();
        if (!text) return sendJson(res, 400, { error: 'Text required' });
        const msg = { id: uid('msg'), authorId: me.id, text, time: nowTime(), edited: false };
        channel.messages.push(msg);
        writeDb(db);
        sendJson(res, 201, msg);
      }).catch(() => sendJson(res, 400, { error: 'Неверный JSON.' }));
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/dms') {
      parseBody(req).then((body) => {
        const targetId = String(body.userId || '');
        if (!targetId || targetId === me.id) return sendJson(res, 400, { error: 'Некорректный получатель' });
        const target = db.users.find((u) => u.id === targetId);
        if (!target) return sendJson(res, 404, { error: 'User not found' });
        let dm = db.dms.find((d) => d.participants.includes(me.id) && d.participants.includes(targetId));
        if (!dm) {
          dm = { id: uid('dm'), participants: [me.id, targetId], messages: [] };
          db.dms.push(dm);
          writeDb(db);
        }
        sendJson(res, 200, dm);
      }).catch(() => sendJson(res, 400, { error: 'Неверный JSON.' }));
      return true;
    }

    if (req.method === 'POST' && pathname.match(/^\/api\/dms\/[^/]+\/messages$/)) {
      parseBody(req).then((body) => {
        const dmId = pathname.split('/')[3];
        const dm = db.dms.find((d) => d.id === dmId && d.participants.includes(me.id));
        if (!dm) return sendJson(res, 404, { error: 'DM not found' });
        const text = String(body.text || '').trim();
        if (!text) return sendJson(res, 400, { error: 'Text required' });
        const msg = { id: uid('msg'), authorId: me.id, text, time: nowTime(), edited: false };
        dm.messages.push(msg);
        writeDb(db);
        sendJson(res, 201, msg);
      }).catch(() => sendJson(res, 400, { error: 'Неверный JSON.' }));
      return true;
    }

    if (req.method === 'PATCH' && pathname.match(/^\/api\/messages\/[^/]+$/)) {
      parseBody(req).then((body) => {
        const messageId = pathname.split('/')[3];
        const next = String(body.text || '').trim();
        if (!next) return sendJson(res, 400, { error: 'Text required' });
        const pools = [...db.servers.flatMap((s) => s.channels.map((c) => c.messages)), ...db.dms.map((d) => d.messages)];
        for (const list of pools) {
          const msg = list.find((m) => m.id === messageId && m.authorId === me.id);
          if (msg) {
            msg.text = next;
            msg.edited = true;
            writeDb(db);
            return sendJson(res, 200, msg);
          }
        }
        sendJson(res, 404, { error: 'Message not found' });
      }).catch(() => sendJson(res, 400, { error: 'Неверный JSON.' }));
      return true;
    }

    if (req.method === 'DELETE' && pathname.match(/^\/api\/messages\/[^/]+$/)) {
      const messageId = pathname.split('/')[3];
      const pools = [...db.servers.flatMap((s) => s.channels.map((c) => c.messages)), ...db.dms.map((d) => d.messages)];
      for (const list of pools) {
        const idx = list.findIndex((m) => m.id === messageId && m.authorId === me.id);
        if (idx !== -1) {
          list.splice(idx, 1);
          writeDb(db);
          return sendJson(res, 200, { ok: true });
        }
      }
      sendJson(res, 404, { error: 'Message not found' });
      return true;
    }

    sendJson(res, 404, { error: 'API route not found' });
    return true;
  }

  return false;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8'
};

function serveStatic(req, res, pathname) {
  let target = pathname === '/' ? '/index.html' : pathname;
  const normalized = path.normalize(target).replace(/^\.\.(\/|\\|$)/, '');
  const file = path.join(ROOT, normalized);

  if (!file.startsWith(ROOT)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    sendText(res, 404, 'Not found');
    return;
  }

  const ext = path.extname(file);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (!routeApi(req, res, url.pathname)) {
    serveStatic(req, res, url.pathname);
  }
});

server.listen(PORT, () => {
  console.log(`Fixcord server running at http://localhost:${PORT}`);
});
