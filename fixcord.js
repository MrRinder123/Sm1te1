const API = '/api';
const TOKEN_KEY = 'fixcord_token';
const app = document.getElementById('app');

const state = {
  token: localStorage.getItem(TOKEN_KEY) || '',
  me: null,
  users: [],
  servers: [],
  dms: [],
  ui: { mode: 'server', activeServerId: null, activeChannelId: null, activeDmId: null }
};

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const response = await fetch(`${API}${path}`, { ...options, headers });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || 'API error');
  return json;
}

function persistToken(token) {
  state.token = token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function userName(id) {
  return state.users.find((u) => u.id === id)?.username || 'Unknown';
}

function activeServer() {
  return state.servers.find((s) => s.id === state.ui.activeServerId) || state.servers[0];
}

function activeChannel() {
  const server = activeServer();
  if (!server) return null;
  return server.channels.find((c) => c.id === state.ui.activeChannelId) || server.channels[0] || null;
}

function activeDm() {
  return state.dms.find((d) => d.id === state.ui.activeDmId) || null;
}

async function loadBootstrap() {
  const data = await api('/bootstrap');
  state.me = data.me;
  state.users = data.users;
  state.servers = data.servers;
  state.dms = data.dms;

  const fallbackServer = state.servers[0];
  if (!state.ui.activeServerId && fallbackServer) state.ui.activeServerId = fallbackServer.id;
  const server = activeServer();
  if (!state.ui.activeChannelId && server?.channels[0]) state.ui.activeChannelId = server.channels[0].id;
  if (state.ui.mode === 'dm' && !activeDm()) state.ui.mode = 'server';
}

function renderAuth(error = '') {
  app.innerHTML = `
    <section class="auth-shell">
      <div class="auth-card">
        <h1>Fixcord</h1>
        <p>Backend-версия с API авторизации, серверами, каналами и DM.</p>
        <div class="inline" style="margin-bottom:12px">
          <button class="primary-btn" id="show-login">Вход</button>
          <button class="ghost-btn" id="show-register">Регистрация</button>
        </div>
        <form id="auth-form"></form>
        <div class="notice" id="auth-notice">${error}</div>
      </div>
    </section>
  `;

  const form = document.getElementById('auth-form');
  const notice = document.getElementById('auth-notice');

  function drawForm(mode) {
    form.dataset.mode = mode;
    form.innerHTML = `
      <div class="form-row"><label>Логин</label><input required minlength="3" name="username" /></div>
      <div class="form-row"><label>Пароль</label><input required minlength="4" type="password" name="password" /></div>
      ${mode === 'register' ? '<div class="form-row"><label>Повтор пароля</label><input required minlength="4" type="password" name="password2" /></div>' : ''}
      <button class="primary-btn" type="submit">${mode === 'register' ? 'Создать аккаунт' : 'Войти'}</button>
    `;
  }

  drawForm('login');
  document.getElementById('show-login').onclick = () => drawForm('login');
  document.getElementById('show-register').onclick = () => drawForm('register');

  form.onsubmit = async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const username = String(data.get('username')).trim();
    const password = String(data.get('password'));

    try {
      if (form.dataset.mode === 'register') {
        const p2 = String(data.get('password2'));
        if (p2 !== password) throw new Error('Пароли не совпадают.');
        const result = await api('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) });
        persistToken(result.token);
      } else {
        const result = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
        persistToken(result.token);
      }
      await loadBootstrap();
      renderApp();
    } catch (err) {
      notice.textContent = err.message;
    }
  };
}

function renderApp() {
  const me = state.me;
  const server = activeServer();
  const channel = activeChannel();
  const dm = activeDm();

  const currentMessages = state.ui.mode === 'dm' ? (dm?.messages || []) : (channel?.messages || []);
  const peerName = dm ? userName(dm.participants.find((id) => id !== me.id)) : '';
  const chatTitle = state.ui.mode === 'dm' ? `ЛС: @${peerName}` : `# ${channel?.name || '-'}`;

  const serverButtons = state.servers
    .map((s) => `<button class="server-btn ${s.id === server?.id ? 'active' : ''}" data-server-id="${s.id}">${s.name.slice(0, 2).toUpperCase()}</button>`)
    .join('');

  const channelButtons = (server?.channels || [])
    .map((ch) => `<button class="channel-btn ${state.ui.mode === 'server' && ch.id === channel?.id ? 'active' : ''}" data-channel-id="${ch.id}"># ${ch.name}</button>`)
    .join('');

  const dmButtons = state.dms
    .filter((d) => d.participants.includes(me.id))
    .map((d) => {
      const peer = d.participants.find((id) => id !== me.id);
      return `<button class="channel-btn ${state.ui.mode === 'dm' && d.id === dm?.id ? 'active' : ''}" data-dm-id="${d.id}">@ ${userName(peer)}</button>`;
    })
    .join('') || '<div class="muted">Нет личных диалогов</div>';

  const messages = currentMessages
    .map((m) => `
      <article class="message">
        <div class="message-header">
          <div class="message-meta"><b>${userName(m.authorId)}</b> • ${m.time}${m.edited ? ' (изменено)' : ''}</div>
          ${m.authorId === me.id ? `<div class="message-actions"><button class="mini-btn" data-edit-id="${m.id}">Изм.</button><button class="mini-btn" data-delete-id="${m.id}">Удал.</button></div>` : ''}
        </div>
        <div>${m.text}</div>
      </article>
    `)
    .join('') || '<div class="muted">Сообщений пока нет.</div>';

  const memberList = state.ui.mode === 'dm'
    ? dm.participants.map((id) => state.users.find((u) => u.id === id))
    : server.members;

  app.innerHTML = `
    <div class="app-shell">
      <aside class="servers">
        <div class="brand">FX</div>
        ${serverButtons}
        <button class="server-btn" id="create-server">＋</button>
      </aside>

      <aside class="channels">
        <header class="panel-header">
          <span>${server?.name || 'Fixcord'}</span>
          <button class="mini-btn" id="create-channel">+канал</button>
        </header>
        <section class="channel-groups">
          <div>
            <h4 class="group-title">ТЕКСТОВЫЕ КАНАЛЫ</h4>
            ${channelButtons}
          </div>
          <div>
            <h4 class="group-title">ЛИЧНЫЕ СООБЩЕНИЯ</h4>
            ${dmButtons}
            <button class="mini-btn" id="new-dm">Новый DM</button>
          </div>
        </section>
        <div class="user-card">
          <div class="user-meta">
            <div><b>${me.username}</b><div class="tag">@fixcord</div></div>
            <div class="inline">
              <select id="status-select">
                ${['online', 'idle', 'dnd', 'offline'].map((s) => `<option ${me.status === s ? 'selected' : ''} value="${s}">${s}</option>`).join('')}
              </select>
              <button class="mini-btn" id="logout-btn">Выйти</button>
            </div>
          </div>
        </div>
      </aside>

      <main class="chat">
        <header class="chat-header"><div>${chatTitle}</div><div class="muted">Fixcord fullstack</div></header>
        <section class="messages">${messages}</section>
        <form class="composer" id="composer">
          <input id="message-input" maxlength="500" placeholder="Написать сообщение..." />
          <button type="submit" class="primary-btn">Отправить</button>
        </form>
      </main>

      <aside class="members">
        <header class="panel-header">Участники — ${memberList.length}</header>
        <ul>${memberList.map((u) => `<li>${u.username} <span class="tag">${u.status}</span></li>`).join('')}</ul>
      </aside>
    </div>
  `;

  bindAppEvents();
}

function bindAppEvents() {
  document.querySelectorAll('[data-server-id]').forEach((el) => {
    el.onclick = () => {
      state.ui.mode = 'server';
      state.ui.activeServerId = el.dataset.serverId;
      const server = activeServer();
      state.ui.activeChannelId = server?.channels[0]?.id || null;
      renderApp();
    };
  });

  document.querySelectorAll('[data-channel-id]').forEach((el) => {
    el.onclick = () => {
      state.ui.mode = 'server';
      state.ui.activeChannelId = el.dataset.channelId;
      renderApp();
    };
  });

  document.querySelectorAll('[data-dm-id]').forEach((el) => {
    el.onclick = () => {
      state.ui.mode = 'dm';
      state.ui.activeDmId = el.dataset.dmId;
      renderApp();
    };
  });

  document.getElementById('composer').onsubmit = async (event) => {
    event.preventDefault();
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text) return;

    if (state.ui.mode === 'dm') {
      await api(`/dms/${state.ui.activeDmId}/messages`, { method: 'POST', body: JSON.stringify({ text }) });
    } else {
      await api(`/channels/${state.ui.activeChannelId}/messages`, { method: 'POST', body: JSON.stringify({ text }) });
    }
    input.value = '';
    await loadBootstrap();
    renderApp();
  };

  document.querySelectorAll('[data-edit-id]').forEach((el) => {
    el.onclick = async () => {
      const next = prompt('Новое сообщение:');
      if (!next) return;
      await api(`/messages/${el.dataset.editId}`, { method: 'PATCH', body: JSON.stringify({ text: next }) });
      await loadBootstrap();
      renderApp();
    };
  });

  document.querySelectorAll('[data-delete-id]').forEach((el) => {
    el.onclick = async () => {
      await api(`/messages/${el.dataset.deleteId}`, { method: 'DELETE' });
      await loadBootstrap();
      renderApp();
    };
  });

  document.getElementById('create-server').onclick = async () => {
    const name = prompt('Название сервера:');
    if (!name) return;
    await api('/servers', { method: 'POST', body: JSON.stringify({ name }) });
    await loadBootstrap();
    const last = state.servers[state.servers.length - 1];
    state.ui.activeServerId = last.id;
    state.ui.activeChannelId = last.channels[0]?.id || null;
    state.ui.mode = 'server';
    renderApp();
  };

  document.getElementById('create-channel').onclick = async () => {
    const name = prompt('Имя канала:');
    if (!name) return;
    await api(`/servers/${state.ui.activeServerId}/channels`, { method: 'POST', body: JSON.stringify({ name }) });
    await loadBootstrap();
    const server = activeServer();
    state.ui.activeChannelId = server.channels[server.channels.length - 1].id;
    state.ui.mode = 'server';
    renderApp();
  };

  document.getElementById('new-dm').onclick = async () => {
    const choices = state.users.filter((u) => u.id !== state.me.id).map((u) => `${u.username} (${u.id})`).join(', ');
    const input = prompt(`ID пользователя для DM. Доступно: ${choices}`);
    if (!input) return;
    await api('/dms', { method: 'POST', body: JSON.stringify({ userId: input.trim().replace(/.*\((.*)\).*/, '$1') }) });
    await loadBootstrap();
    const last = state.dms[state.dms.length - 1];
    state.ui.activeDmId = last?.id || null;
    state.ui.mode = 'dm';
    renderApp();
  };

  document.getElementById('logout-btn').onclick = async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch {}
    persistToken('');
    state.me = null;
    renderAuth('Вы вышли из аккаунта.');
  };

  document.getElementById('status-select').onchange = async (event) => {
    await api('/me/status', { method: 'PATCH', body: JSON.stringify({ status: event.target.value }) });
    await loadBootstrap();
    renderApp();
  };
}

async function init() {
  if (!state.token) return renderAuth();
  try {
    await loadBootstrap();
    renderApp();
  } catch {
    persistToken('');
    renderAuth('Сессия истекла. Войдите снова.');
  }
}

init();
