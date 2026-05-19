const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const { verifySocketToken } = require('./middleware/auth');
const User = require('./models/User');
const Message = require('./models/Message');
const Room = require('./models/Room');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp';

const onlineUsers = new Map();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const payload = await verifySocketToken(token);
    socket.user = payload;
    return next();
  } catch (err) {
    return next(new Error('Invalid token'));
  }
});

io.on('connection', async (socket) => {
  const userId = socket.user.id;
  onlineUsers.set(userId, socket.id);

  const user = await User.findById(userId);
  if (user) {
    user.online = true;
    await user.save();
  }

  io.emit('onlineUsers', Array.from(onlineUsers.keys()));
  socket.broadcast.emit('userStatus', { userId, online: true });

  socket.on('joinRoom', async (roomId) => {
    socket.join(roomId);
  });

  socket.on('leaveRoom', (roomId) => {
    socket.leave(roomId);
  });

  socket.on('roomMessage', async ({ roomId, content }) => {
    if (!roomId || !content) return;
    const message = await Message.create({
      sender: userId,
      room: roomId,
      content,
    });
    io.to(roomId).emit('roomMessage', {
      _id: message._id,
      sender: userId,
      room: roomId,
      content,
      createdAt: message.createdAt,
    });
  });

  socket.on('privateMessage', async ({ receiverId, content }) => {
    if (!receiverId || !content) return;
    const message = await Message.create({
      sender: userId,
      receiver: receiverId,
      content,
    });
    const payload = {
      _id: message._id,
      sender: userId,
      receiver: receiverId,
      content,
      createdAt: message.createdAt,
    };

    socket.emit('privateMessage', payload);
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('privateMessage', payload);
    }
  });

  socket.on('typing', ({ roomId, receiverId, isTyping }) => {
    const payload = { userId, roomId, receiverId, isTyping };
    if (roomId) {
      socket.to(roomId).emit('typing', payload);
    } else if (receiverId) {
      const otherSocketId = onlineUsers.get(receiverId);
      if (otherSocketId) {
        io.to(otherSocketId).emit('typing', payload);
      }
    }
  });

  socket.on('disconnect', async () => {
    onlineUsers.delete(userId);
    if (user) {
      user.online = false;
      user.lastSeen = new Date();
      await user.save();
    }
    io.emit('onlineUsers', Array.from(onlineUsers.keys()));
    socket.broadcast.emit('userStatus', { userId, online: false });
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('✓ Connected to MongoDB');
  })
  .catch((error) => {
    console.error('✗ MongoDB connection error:', error.message);
    console.error('  Some features will be unavailable. Start MongoDB and refresh the page.');
  });
