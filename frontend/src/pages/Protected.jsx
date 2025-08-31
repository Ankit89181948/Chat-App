// ProtectedPage.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  FiCopy,
  FiUsers,
  FiLogOut,
  FiMessageSquare,
  FiSend,
  FiPlus,
  FiHash
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProtectedPage() {
  const navigate = useNavigate();

  // UI state
  const [activeTab, setActiveTab] = useState('join');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [currentRoom, setCurrentRoom] = useState({ id: '', name: '' });
  const [isInRoom, setIsInRoom] = useState(false);
  const [message, setMessage] = useState('');
  const [allMessages, setAllMessages] = useState([]);
  const [error, setError] = useState('');
  const [socket, setSocket] = useState(null);

  const messagesEndRef = useRef(null);

  // user info from localStorage (unchanged)
  const user = JSON.parse(localStorage.getItem('user'));
  const userName = user?.name || 'User';

  // SERVER URL (use your server url)
  const SOCKET_URL = 'https://chat-app-server-j6h2.onrender.com';

  // connect socket once
  useEffect(() => {
    const token = localStorage.getItem('token');
    const newSocket = io(SOCKET_URL, {
      auth: { token },
      withCredentials: true,
      transports: ['websocket']
    });

    setSocket(newSocket);

    // connected ack
    newSocket.on('connected', (payload) => {
      // optional: console.log('socket connected', payload);
    });

    // room created by this socket
    // server emits: socket.emit('roomCreated', { roomId, roomName })
    newSocket.on('roomCreated', ({ roomId, roomName } = {}) => {
      setCurrentRoom({ id: roomId || '', name: roomName || 'Chat Room' });
      setIsInRoom(true);
      setAllMessages([]);
    });

    // server may emit roomJoined either as plain id or object { id, name, messages }
    newSocket.on('roomJoined', (payload) => {
      // handle both shapes
      if (!payload) return;
      if (typeof payload === 'string') {
        setCurrentRoom(prev => ({ ...prev, id: payload }));
      } else if (typeof payload === 'object') {
        const id = payload.id || payload.roomId || '';
        const name = payload.name || payload.roomName || '';
        const messages = payload.messages || [];
        setCurrentRoom({ id, name });
        // normalize messages if server sent them
        const normalized = Array.isArray(messages) ? messages.map(normalizeIncomingMessage) : [];
        setAllMessages(normalized);
      }
      setIsInRoom(true);
    });

    // messages from server
    newSocket.on('getLatestMessage', (incoming) => {
      const normalized = normalizeIncomingMessage(incoming);
      setAllMessages(prev => [...prev, normalized]);
    });

    // room closed by server
    newSocket.on('roomClosed', ({ roomId } = {}) => {
      if (currentRoom.id === roomId) {
        setError('Room closed');
        setTimeout(() => setError(''), 3000);
        leaveRoomLocal(); // local cleanup
      }
    });

    // user / room events (optional UI hooks)
    newSocket.on('userJoined', (_) => {});
    newSocket.on('userLeft', (_) => {});

    // room user count
    newSocket.on('roomUsers', (_) => {});

    // error channels
    newSocket.on('roomError', (msg) => {
      setError(typeof msg === 'string' ? msg : msg?.message || 'Room error');
      setTimeout(() => setError(''), 3000);
    });
    newSocket.on('serverError', (msg) => {
      setError(typeof msg === 'string' ? msg : msg?.message || 'Server error');
      setTimeout(() => setError(''), 3000);
    });
    newSocket.on('error', (err) => {
      setError(err?.message || 'Socket error');
      setTimeout(() => setError(''), 3000);
    });

    return () => {
      newSocket.disconnect();
      setSocket(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  // helper: normalize any message shape to { id, msg, name, time }
  function normalizeIncomingMessage(msg = {}) {
    // msg could be: { id, msg, name, time } OR { id, text, senderName, timestamp } etc.
    const id = msg.id || msg._id || Date.now();
    const text = (msg.msg ?? msg.text ?? msg.message ?? msg.newMessage ?? '').toString();
    const name = msg.name ?? msg.senderName ?? msg.sender ?? 'Anonymous';
    // time might be timestamp number or ISO string
    const time = msg.time ?? msg.timestamp ?? msg.ts ?? (msg.createdAt ? new Date(msg.createdAt).toISOString() : new Date().toISOString());
    return { id, msg: text, name, time };
  }

  // handle logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    socket?.disconnect();
    setSocket(null);
    navigate('/login');
  };

  // create room
  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!socket) return;
    // server expects { roomName, userName } (your server used that shape earlier)
    socket.emit('createRoom', {
      roomName: `${userName}'s Room`,
      userName
    }, (ack) => {
      // optional ack handling
      // server returns { ok: true, roomId, roomName } if ok
    });
  };

  // join room (from form)
  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!roomIdInput.trim()) {
      setError('Please enter room ID');
      setTimeout(() => setError(''), 3000);
      return;
    }
    if (!socket) return;
    // server joinRoom accepts either id string or object; pass string
    socket.emit('joinRoom', roomIdInput.trim(), (ack) => {
      // ack optional
    });
    setRoomIdInput('');
  };

  // copy room id
  const copyToClipboard = async () => {
    try {
      if (!currentRoom.id) return;
      await navigator.clipboard.writeText(currentRoom.id);
      setError('Room ID copied to clipboard!');
      setTimeout(() => setError(''), 2000);
    } catch (err) {
      setError('Could not copy');
      setTimeout(() => setError(''), 2000);
    }
  };

  // send message: IMPORTANT — send only a string to server
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim() || !currentRoom.id || !socket) return;

    // optimistic UI: add immediately with same shape UI expects
    const optimistic = {
      id: `optim-${Date.now()}`,
      msg: message,
      name: userName,
      time: new Date().toISOString()
    };
    setAllMessages(prev => [...prev, optimistic]);

    // send string only
    socket.emit('newMessage', {
      room: currentRoom.id,
      newMessage: message
    }, (ack) => {
      // optional ack handling — server may return message object
      if (ack && ack.ok && ack.message) {
        // replace optimistic message with canonical server message if helpful
        const normalized = normalizeIncomingMessage(ack.message);
        setAllMessages(prev => {
          // remove the optimistic copy (matching by optimistic id) and append the server message
          const withoutOptim = prev.filter(m => m.id !== optimistic.id);
          return [...withoutOptim, normalized];
        });
      }
    });

    setMessage('');
  };

  // leave room both locally and notify server
  const leaveRoomLocal = () => {
    setIsInRoom(false);
    setCurrentRoom({ id: '', name: '' });
    setRoomIdInput('');
    setAllMessages([]);
  };
  const leaveRoom = () => {
    if (socket && currentRoom.id) {
      socket.emit('leaveRoom', currentRoom.id, (ack) => {
        // ignore ack - do local cleanup anyway
      });
    }
    leaveRoomLocal();
  };

  // auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages]);

  // ------ RENDER ------
  if (isInRoom) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col">
        {/* Chat Header */}
        <div className="p-4 bg-slate-800/80 backdrop-blur-md border-b border-slate-700/50 flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center border border-teal-500/30">
              <FiHash className="text-teal-400" size={18} />
            </div>
            <div className="ml-3">
              <h2 className="font-medium text-slate-100">{currentRoom.name || 'Chat Room'}</h2>
              <p className="text-xs text-slate-400">ID: {currentRoom.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={copyToClipboard}
              className="flex items-center text-sm bg-slate-700/50 hover:bg-slate-600/50 px-3 py-1.5 rounded-lg border border-slate-700/50 text-slate-200"
            >
              <FiCopy className="mr-1.5" /> Copy ID
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={leaveRoom}
              className="flex items-center text-sm bg-rose-600/90 hover:bg-rose-700 px-3 py-1.5 rounded-lg text-white"
            >
              Leave
            </motion.button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-3">
            {allMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-4">
                  <FiMessageSquare className="text-slate-500" size={24} />
                </div>
                <h3 className="text-lg font-medium text-slate-300">No messages yet</h3>
                <p className="text-slate-500 mt-1">Send your first message to start the conversation</p>
              </div>
            ) : (
              allMessages.map((m, index) => (
                <motion.div
                  key={m.id ?? index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${userName === (m.name ?? m.senderName) ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs md:max-w-md px-4 py-2 rounded-xl ${
                      userName === (m.name ?? m.senderName)
                        ? 'bg-teal-600 rounded-br-none'
                        : 'bg-slate-700 rounded-bl-none'
                    }`}
                  >
                    {userName !== (m.name ?? m.senderName) && (
                      <p className="text-xs font-semibold text-teal-300">
                        {m.name ?? m.senderName}
                      </p>
                    )}
                    <p className="text-white">{String(m.msg ?? m.text ?? '')}</p>
                    <p
                      className={`text-xs mt-1 ${
                        userName === (m.name ?? m.senderName) ? 'text-teal-200' : 'text-slate-400'
                      } text-right`}
                    >
                      {new Date(m.time ?? Date.now()).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </motion.div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Message Input */}
        <form onSubmit={handleSendMessage} className="p-4 bg-slate-800/80 backdrop-blur-md border-t border-slate-700/50">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 py-3 px-4 bg-slate-700/50 border border-slate-700/50 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 text-white placeholder-slate-400"
              disabled={!currentRoom.id}
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              className="p-3 bg-teal-600 hover:bg-teal-700 rounded-full text-white disabled:opacity-50 disabled:bg-slate-700"
              disabled={!currentRoom.id || !message.trim()}
            >
              <FiSend size={18} />
            </motion.button>
          </div>
        </form>

        {/* Error Notification */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-700 shadow-lg flex items-center"
            >
              <p className="text-sm">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Room Selection UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4 relative">
      {/* Error Notification */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-rose-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center z-50"
          >
            <p className="text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-slate-800/80 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-slate-700/50"
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-800/50 to-slate-900/50 text-center border-b border-slate-700/50">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
            <FiMessageSquare className="text-teal-400" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white">Chat Rooms</h1>
          <p className="text-slate-400 mt-1">
            {activeTab === 'create' ? 'Start a new conversation' : 'Join an existing room'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700/50">
          <button
            onClick={() => setActiveTab('join')}
            className={`flex-1 py-3.5 font-medium text-sm transition-colors ${
              activeTab === 'join'
                ? 'text-teal-400 border-b-2 border-teal-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Join Room
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-3.5 font-medium text-sm transition-colors ${
              activeTab === 'create'
                ? 'text-teal-400 border-b-2 border-teal-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Create Room
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'join' ? (
            <form onSubmit={handleJoinRoom} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Room ID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <FiHash size={18} />
                  </div>
                  <input
                    type="text"
                    value={roomIdInput}
                    onChange={(e) => setRoomIdInput(e.target.value)}
                    placeholder="Paste room ID here"
                    className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 transition-all text-white placeholder-slate-400"
                    required
                  />
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all"
              >
                Join Room
              </motion.button>
            </form>
          ) : (
            <form onSubmit={handleCreateRoom} className="space-y-6">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                  <FiPlus size={32} className="text-teal-400" />
                </div>
                <h3 className="text-lg font-medium text-white">Create New Room</h3>
                <p className="text-slate-400 mt-1">
                  Start a private conversation with friends or colleagues
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all"
              >
                Create Room
              </motion.button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700/50 text-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLogout}
            className="text-slate-400 hover:text-white flex items-center justify-center mx-auto text-sm"
          >
            <FiLogOut className="mr-2" /> Sign Out
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
