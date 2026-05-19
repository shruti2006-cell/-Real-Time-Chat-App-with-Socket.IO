const express = require('express');
const Room = require('../models/Room');
const Message = require('../models/Message');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/rooms', async (req, res) => {
  const rooms = await Room.find().sort({ createdAt: -1 });
  res.json(rooms);
});

router.post('/rooms', async (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Room name is required.' });
  }

  const existing = await Room.findOne({ name });
  if (existing) {
    return res.status(400).json({ message: 'Room name already exists.' });
  }

  const room = await Room.create({ name, description: description || '', createdBy: req.user._id });
  res.status(201).json(room);
});

router.get('/users', async (req, res) => {
  const users = await User.find().select('-password').sort({ username: 1 });
  res.json(users);
});

router.get('/messages/rooms/:roomId', async (req, res) => {
  const { roomId } = req.params;
  const messages = await Message.find({ room: roomId })
    .populate('sender', 'username')
    .sort({ createdAt: 1 });
  res.json(messages);
});

router.get('/messages/private/:otherUserId', async (req, res) => {
  const { otherUserId } = req.params;
  const userId = req.user._id;
  const messages = await Message.find({
    $or: [
      { sender: userId, receiver: otherUserId },
      { sender: otherUserId, receiver: userId },
    ],
  })
    .populate('sender', 'username')
    .populate('receiver', 'username')
    .sort({ createdAt: 1 });
  res.json(messages);
});

module.exports = router;
