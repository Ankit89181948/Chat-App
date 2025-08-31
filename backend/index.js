
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid'); 


const authRoutes = require('./routes/authRoutes');

const app = express();
const server = http.createServer(app);

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://chat-app-client-w6uv.onrender.com';
const PORT = Number(process.env.PORT) || 3000;

app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true,
}));
app.use(express.json());

app.get('/', (_req, res) => {
  res.send('API is running');
});
app.use('/api/auth', authRoutes);

const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});


io.use((socket, next) => {
  try {
    let token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization ||
      '';

    if (typeof token === 'string' && token.startsWith('Bearer ')) {
      token = token.slice(7);
    }

    if (!token) return next(new Error('Unauthorized'));

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error('Unauthorized'));
      socket.userId = decoded.id; 
      return next();
    });
  } catch (e) {
    return next(new Error('Unauthorized'));
  }
});


const activeRooms = new Map();
const socketRooms = new Map();

function addMember(roomId, socketId) {
  if (!activeRooms.has(roomId)) return;
  const room = activeRooms.get(roomId);
  room.members.add(socketId);
  if (!socketRooms.has(socketId)) socketRooms.set(socketId, new Set());
  socketRooms.get(socketId).add(roomId);
}

function removeMember(roomId, socketId) {
  if (!activeRooms.has(roomId)) return;
  const room = activeRooms.get(roomId);
  room.members.delete(socketId);
  if (room.members.size === 0) {
    activeRooms.delete(roomId);
    io.to(roomId).emit('roomClosed', { roomId });
  }
  if (socketRooms.has(socketId)) {
    socketRooms.get(socketId).delete(roomId);
    if (socketRooms.get(socketId).size === 0) socketRooms.delete(socketId);
  }
}

function roomExists(roomId) {
  return activeRooms.has(roomId);
}

function emitRoomUsers(roomId) {
  if (!roomExists(roomId)) return;
  const count = activeRooms.get(roomId).members.size;
  io.to(roomId).emit('roomUsers', { roomId, count });
}

io.on('connection', (socket) => {
  socket.emit('connected', { socketId: socket.id, userId: socket.userId });

  socket.on('createRoom', (payload = {}, ack) => {
    try {
      const roomName = (payload.roomName || 'Room').toString().trim();
      const roomId = uuidv4();

      activeRooms.set(roomId, { roomName, members: new Set() });
      socket.join(roomId);
      addMember(roomId, socket.id);

      const result = { roomId, roomName };
      socket.emit('roomCreated', result);
      if (typeof ack === 'function') ack({ ok: true, ...result });

      emitRoomUsers(roomId);
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: 'CREATE_ROOM_FAILED' });
      socket.emit('serverError', 'Could not create room');
    }
  });

  socket.on('joinRoom', (roomId, ack) => {
    try {
      if (typeof roomId === 'object') roomId = roomId?.roomId; 
      if (!roomId || typeof roomId !== 'string') {
        if (typeof ack === 'function') ack({ ok: false, error: 'INVALID_ROOM_ID' });
        return socket.emit('roomError', 'Invalid room id');
      }
      if (!roomExists(roomId)) {
        if (typeof ack === 'function') ack({ ok: false, error: 'ROOM_NOT_FOUND' });
        return socket.emit('roomError', 'Room not found');
      }

      socket.join(roomId);
      addMember(roomId, socket.id);

      socket.emit('roomJoined', roomId);
      io.to(roomId).emit('userJoined', { roomId, socketId: socket.id });
      emitRoomUsers(roomId);
      if (typeof ack === 'function') ack({ ok: true, roomId });
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: 'JOIN_ROOM_FAILED' });
      socket.emit('serverError', 'Could not join room');
    }
  });

  socket.on('leaveRoom', (roomId, ack) => {
    try {
      if (!roomId || !socket.rooms.has(roomId)) {
        if (typeof ack === 'function') ack({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      socket.leave(roomId);
      removeMember(roomId, socket.id);
      io.to(roomId).emit('userLeft', { roomId, socketId: socket.id });
      emitRoomUsers(roomId);
      if (typeof ack === 'function') ack({ ok: true, roomId });
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: 'LEAVE_ROOM_FAILED' });
      socket.emit('serverError', 'Could not leave room');
    }
  });

  socket.on('newMessage', (payload = {}, ack) => {
    try {
      const roomId = payload.room || payload.roomId;
      const text = (payload.newMessage ?? payload.text ?? '').toString();

      if (!roomId || typeof roomId !== 'string') {
        if (typeof ack === 'function') ack({ ok: false, error: 'INVALID_ROOM_ID' });
        return socket.emit('roomError', 'Invalid room id');
      }
      if (!socket.rooms.has(roomId)) {
        if (typeof ack === 'function') ack({ ok: false, error: 'NOT_IN_ROOM' });
        return socket.emit('roomError', 'You are not in this room');
      }
      if (!text.trim()) {
        if (typeof ack === 'function') ack({ ok: false, error: 'EMPTY_MESSAGE' });
        return;
      }

      const message = {
        id: uuidv4(),
        roomId,
        text,
        senderId: socket.userId || null, 
        socketId: socket.id,
        timestamp: Date.now(),
      };

      io.to(roomId).emit('getLatestMessage', message);
      if (typeof ack === 'function') ack({ ok: true, message });
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: 'SEND_MESSAGE_FAILED' });
      socket.emit('serverError', 'Could not send message');
    }
  });

  socket.on('disconnect', () => {
    const joined = socketRooms.get(socket.id);
    if (joined && joined.size) {
      for (const roomId of Array.from(joined)) {
        removeMember(roomId, socket.id);
        io.to(roomId).emit('userLeft', { roomId, socketId: socket.id });
        emitRoomUsers(roomId);
      }
    }
    socketRooms.delete(socket.id);
  });
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`CORS origin: ${FRONTEND_ORIGIN}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  });

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
});
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});
