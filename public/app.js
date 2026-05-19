const apiBase = '/api';
let token = localStorage.getItem('token');
let currentChat = null;
let chatMode = null;
let socket = null;
let currentUser = null;

const authView = document.getElementById('authView');
const navPanel = document.getElementById('navPanel');
const currentUserSpan = document.getElementById('currentUser');
const authMessage = document.getElementById('authMessage');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const usernameInput = document.getElementById('usernameInput');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const roomNameInput = document.getElementById('roomNameInput');
const roomDescInput = document.getElementById('roomDescInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const roomList = document.getElementById('roomList');
const userList = document.getElementById('userList');
const onlineUsersList = document.getElementById('onlineUsersList');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const messageFeed = document.getElementById('messageFeed');
const chatTitle = document.getElementById('chatTitle');
const chatSubtitle = document.getElementById('chatSubtitle');
const typingIndicator = document.getElementById('typingIndicator');
const roomCount = document.getElementById('roomCount');

loginBtn.addEventListener('click', () => handleAuth('login'));
registerBtn.addEventListener('click', () => handleAuth('register'));
logoutBtn.addEventListener('click', logout);
createRoomBtn.addEventListener('click', createRoom);
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('input', () => sendTyping(true));
messageInput.addEventListener('blur', () => sendTyping(false));
messageInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') sendMessage();
});

async function handleAuth(mode) {
  authMessage.textContent = '';
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  const username = usernameInput.value.trim();

  if (!email || !password || (mode === 'register' && !username)) {
    authMessage.textContent = 'Fill all required fields.';
    return;
  }

  const path = mode === 'register' ? '/auth/register' : '/auth/login';
  const body = mode === 'register' ? { email, password, username } : { email, password };

  try {
    const response = await fetch(`${apiBase}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) {
      authMessage.textContent = result.message || 'Authentication failed.';
      return;
    }

    token = result.token;
    localStorage.setItem('token', token);
    setUser(result.user);
    initializeApp();
  } catch (err) {
    authMessage.textContent = 'Unable to contact server.';
  }
}

function logout() {
  token = null;
  currentChat = null;
  chatMode = null;
  localStorage.removeItem('token');
  if (socket) socket.disconnect();
  authView.classList.remove('hidden');
  navPanel.classList.add('hidden');
  roomList.innerHTML = '';
  userList.innerHTML = '';
  onlineUsersList.innerHTML = '';
  messageFeed.innerHTML = '';
  chatTitle.textContent = 'Select a room or user';
  chatSubtitle.textContent = 'Chat history loads here.';
  messageInput.disabled = true;
  sendBtn.disabled = true;
}

function setUser(user) {
  if (user._id && !user.id) user.id = user._id;
  currentUser = user;
  currentUserSpan.textContent = user.username;
  authView.classList.add('hidden');
  navPanel.classList.remove('hidden');
}

async function initializeApp() {
  try {
    const resp = await fetch(`${apiBase}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error('Not authenticated');
    const { user } = await resp.json();
    setUser(user);
    connectSocket();
    await loadRooms();
    await loadUsers();
  } catch (err) {
    logout();
  }
}

function getRequestHeaders() {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function createRoom() {
  const name = roomNameInput.value.trim();
  const description = roomDescInput.value.trim();
  if (!name) return;

  const response = await fetch(`${apiBase}/chat/rooms`, {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({ name, description }),
  });

  const result = await response.json();
  if (response.ok) {
    roomNameInput.value = '';
    roomDescInput.value = '';
    await loadRooms();
    selectRoom(result);
  }
}

async function loadRooms() {
  const response = await fetch(`${apiBase}/chat/rooms`, { headers: getRequestHeaders() });
  const rooms = await response.json();
  roomList.innerHTML = '';
  roomCount.textContent = `${rooms.length} rooms`;
  rooms.forEach((room) => {
    const button = document.createElement('button');
    button.className = 'w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-left text-slate-100 hover:border-cyan-500';
    button.innerHTML = `<div class="font-semibold">${room.name}</div><div class="text-slate-500 text-sm mt-1">${room.description || 'Public room'}</div>`;
    button.addEventListener('click', () => selectRoom(room));
    roomList.appendChild(button);
  });
}

async function loadUsers() {
  const response = await fetch(`${apiBase}/chat/users`, { headers: getRequestHeaders() });
  const users = await response.json();
  userList.innerHTML = '';
  onlineUsersList.innerHTML = '';

  users.forEach((user) => {
    if (user._id === currentUser?.id) return;

    const item = document.createElement('button');
    item.className = 'w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-left text-slate-100 hover:border-cyan-500';
    item.textContent = user.username;
    item.addEventListener('click', () => selectUser(user));
    userList.appendChild(item);

    const onlineDot = document.createElement('div');
    onlineDot.className = 'flex items-center justify-between gap-2 rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3';
    onlineDot.innerHTML = `<span>${user.username}</span><span id="status-${user._id}" class="text-slate-500">${user.online ? 'Online' : 'Offline'}</span>`;
    onlineUsersList.appendChild(onlineDot);
  });
}

async function selectRoom(room) {
  currentChat = room;
  chatMode = 'room';
  chatTitle.textContent = `# ${room.name}`;
  chatSubtitle.textContent = room.description || 'Public room conversation';
  messageFeed.innerHTML = '';
  messageInput.disabled = false;
  sendBtn.disabled = false;
  messageInput.focus();
  sendTyping(false);

  const response = await fetch(`${apiBase}/chat/messages/rooms/${room._id}`, { headers: getRequestHeaders() });
  const messages = await response.json();
  appendMessages(messages, true);
  socket.emit('joinRoom', room._id);
}

async function selectUser(user) {
  currentChat = user;
  chatMode = 'private';
  chatTitle.textContent = `@ ${user.username}`;
  chatSubtitle.textContent = 'Direct message conversation';
  messageFeed.innerHTML = '';
  messageInput.disabled = false;
  sendBtn.disabled = false;
  messageInput.focus();
  sendTyping(false);

  const response = await fetch(`${apiBase}/chat/messages/private/${user._id}`, { headers: getRequestHeaders() });
  const messages = await response.json();
  appendMessages(messages, true);
}

function getDisplayName(sender) {
  if (!sender) return 'Unknown';
  if (typeof sender === 'string') {
    return sender === currentUser?.id ? 'You' : 'Partner';
  }
  return sender.username || 'Unknown';
}

function appendMessages(messages, clear = false) {
  if (clear) messageFeed.innerHTML = '';
  messages.forEach((message) => {
    const senderId = message.sender && typeof message.sender === 'object' ? message.sender._id : message.sender;
    const isOwn = senderId === currentUser?.id;
    const name = isOwn ? 'You' : getDisplayName(message.sender);

    const card = document.createElement('div');
    card.className = `rounded-3xl p-4 ${isOwn ? 'bg-cyan-500/20 text-cyan-100 self-end' : 'bg-slate-800 text-slate-100'}`;
    card.innerHTML = `<div class="text-sm text-slate-400 mb-1">${name}</div><div>${message.content}</div><div class="text-slate-500 text-xs text-right mt-2">${new Date(message.createdAt).toLocaleTimeString()}</div>`;
    messageFeed.appendChild(card);
  });
  messageFeed.scrollTop = messageFeed.scrollHeight;
}

function createSocket() {
  return io({ auth: { token } });
}

function connectSocket() {
  if (socket) socket.disconnect();
  socket = createSocket();

  socket.on('connect_error', (err) => {
    console.error('Socket error', err.message);
  });

  socket.on('onlineUsers', (ids) => {
    document.querySelectorAll('[id^="status-"]').forEach((el) => {
      const id = el.id.replace('status-', '');
      el.textContent = ids.includes(id) ? 'Online' : 'Offline';
    });
  });

  socket.on('userStatus', ({ userId, online }) => {
    const el = document.querySelector(`#status-${userId}`);
    if (el) el.textContent = online ? 'Online' : 'Offline';
  });

  socket.on('roomMessage', (message) => {
    if (chatMode === 'room' && currentChat && currentChat._id === message.room) {
      appendMessages([message]);
    }
  });

  socket.on('privateMessage', (message) => {
    if (chatMode === 'private' && currentChat && currentChat._id === message.sender) {
      appendMessages([message]);
    }
    if (chatMode === 'private' && currentChat && currentChat._id === message.receiver) {
      appendMessages([message]);
    }
  });

  socket.on('typing', ({ userId, roomId, receiverId, isTyping }) => {
    if (chatMode === 'room' && currentChat && currentChat._id === roomId) {
      typingIndicator.textContent = isTyping ? 'Someone is typing...' : '';
    }
    if (chatMode === 'private' && currentChat && currentChat._id === userId) {
      typingIndicator.textContent = isTyping ? 'Typing...' : '';
    }
  });
}

function sendTyping(isTyping) {
  if (!socket || !currentChat) return;
  const payload = { isTyping };
  if (chatMode === 'room') payload.roomId = currentChat._id;
  if (chatMode === 'private') payload.receiverId = currentChat._id;
  socket.emit('typing', payload);
}

function sendMessage() {
  const content = messageInput.value.trim();
  if (!content || !socket || !currentChat) return;

  if (chatMode === 'room') {
    socket.emit('roomMessage', { roomId: currentChat._id, content });
  }
  if (chatMode === 'private') {
    socket.emit('privateMessage', { receiverId: currentChat._id, content });
  }

  messageInput.value = '';
  sendTyping(false);
}

window.addEventListener('load', () => {
  if (token) {
    initializeApp();
  } else {
    authView.classList.remove('hidden');
    navPanel.classList.add('hidden');
  }
});
