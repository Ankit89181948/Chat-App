import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  autoConnect: false, // Important for control
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

// Debugging events
socket.on('connect', () => {
  console.log('✅ Socket connected:', socket.id);
});

socket.on('disconnect', () => {
  console.log('⚠️ Socket disconnected');
});

socket.on('connect_error', (err) => {
  console.error('❌ Connection error:', err.message);
});

export default socket;