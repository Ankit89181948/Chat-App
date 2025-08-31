import { useState, useEffect, useRef, useCallback } from 'react';
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
  const [activeTab, setActiveTab] = useState('join');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [currentRoom, setCurrentRoom] = useState({ id: '', name: '' });
  const [isInRoom, setIsInRoom] = useState(false);
  const [message, setMessage] = useState('');
  const [allMessages, setAllMessages] = useState([]);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');
  const [socket, setSocket] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const user = JSON.parse(localStorage.getItem('user'));
  const userName = user?.name || 'Anonymous';
  const messagesEndRef = useRef(null);

  // Socket event handlers
  const handleRoomCreated = useCallback(({ roomId, roomName, messages = [] }) => {
    setCurrentRoom({ id: roomId, name: roomName });
    setIsInRoom(true);
    setAllMessages(messages);
    setIsLoading(false);
  }, []);

  const handleRoomJoined = useCallback((roomData) => {
    setCurrentRoom({ id: roomData.id, name: roomData.name });
    setIsInRoom(true);
    setAllMessages(roomData.messages || []);
    setIsLoading(false);
  }, []);

  const handleGetLatestMessage = useCallback((newMessage) => {
    setAllMessages(prev => [...prev, newMessage]);
  }, []);

  const handleSocketError = useCallback((err) => {
    setError(err?.message || 'Socket error');
    setIsLoading(false);
    setTimeout(() => setError(''), 3000);
  }, []);

  const handleConnectError = useCallback((err) => {
    setError(err?.message || 'Connection error');
    setIsLoading(false);
    setTimeout(() => setError(''), 3000);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    const newSocket = io('https://chat-app-server-j6h2.onrender.com', {
      auth: { token },
      withCredentials: true
    });

    // Set up event listeners
    newSocket.on('roomCreated', handleRoomCreated);
    newSocket.on('roomJoined', handleRoomJoined);
    newSocket.on('getLatestMessage', handleGetLatestMessage);
    newSocket.on('error', handleSocketError);
    newSocket.on('connect_error', handleConnectError);

    setSocket(newSocket);

    return () => {
      // Remove all event listeners
      newSocket.off('roomCreated', handleRoomCreated);
      newSocket.off('roomJoined', handleRoomJoined);
      newSocket.off('getLatestMessage', handleGetLatestMessage);
      newSocket.off('error', handleSocketError);
      newSocket.off('connect_error', handleConnectError);
      
      // Leave room and disconnect
      if (currentRoom.id) {
        newSocket.emit('leaveRoom', currentRoom.id);
      }
      newSocket.disconnect();
    };
  }, [
    navigate, 
    handleRoomCreated, 
    handleRoomJoined, 
    handleGetLatestMessage, 
    handleSocketError, 
    handleConnectError, 
    currentRoom.id
  ]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (socket && currentRoom.id) {
      socket.emit('leaveRoom', currentRoom.id);
    }
    socket?.disconnect();
    navigate('/login');
  };

  const handleCreateRoom = (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    if (socket) {
      socket.emit('createRoom', {
        roomName: `${userName}'s Room`,
        userName
      });
    }
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    const trimmedId = roomIdInput.trim();
    
    if (!trimmedId) {
      setError('Please enter room ID');
      setIsLoading(false);
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    if (trimmedId.length < 6) {
      setError('Room ID seems too short');
      setIsLoading(false);
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    if (socket) {
      socket.emit('joinRoom', trimmedId);
    }
  };

  const copyToClipboard = () => {
    if (!currentRoom.id) return;
    navigator.clipboard.writeText(currentRoom.id);
    setNotification('Room ID copied to clipboard!');
    setTimeout(() => setNotification(''), 2000);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim() || !currentRoom.id || !socket) return;

    const newMessage = {
      time: new Date(),
      msg: message,
      name: userName
    };

    socket.emit('newMessage', {
      newMessage,
      room: currentRoom.id
    });

    setMessage('');
  };

  const leaveRoom = () => {
    if (socket && currentRoom.id) {
      socket.emit('leaveRoom', currentRoom.id);
    }
    setIsInRoom(false);
    setCurrentRoom({ id: '', name: '' });
    setRoomIdInput('');
    setAllMessages([]);
    setIsLoading(false);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages]);

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
              allMessages.map((message, index) => (
                <motion.div
                  key={`${message.time}-${message.name}-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${userName === message.name ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs md:max-w-md px-4 py-2 rounded-xl ${
                      userName === message.name
                        ? 'bg-teal-600 rounded-br-none'
                        : 'bg-slate-700 rounded-bl-none'
                    }`}
                  >
                    {userName !== message.name && (
                      <p className="text-xs font-semibold text-teal-300">
                        {message.name}
                      </p>
                    )}
                    <p className="text-white">{message.msg}</p>
                    <p
                      className={`text-xs mt-1 ${
                        userName === message.name ? 'text-teal-200' : 'text-slate-400'
                      } text-right`}
                    >
                      {new Date(message.time).toLocaleTimeString([], {
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

        {/* Positive Notification */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center"
            >
              <p className="text-sm">{notification}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
          </div>
        )}
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
                disabled={isLoading}
                className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-700 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all disabled:cursor-not-allowed"
              >
                {isLoading ? 'Joining...' : 'Join Room'}
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
                disabled={isLoading}
                className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-700 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating...' : 'Create Room'}
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

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
        </div>
      )}
    </div>
  );
}