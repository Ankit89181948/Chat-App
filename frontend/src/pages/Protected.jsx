"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import io from "socket.io-client";
import { jwtDecode } from "jwt-decode";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { FaUsers, FaSignOutAlt, FaPaperPlane, FaComments } from "react-icons/fa";

export default function ProtectedPage() {
  const [userName, setUserName] = useState("");
  const [socket, setSocket] = useState(null);
  const [room, setRoom] = useState(null);
  const [roomUsers, setRoomUsers] = useState(1);
  const [message, setMessage] = useState("");
  const [allMessages, setAllMessages] = useState([]);
  const messagesEndRef = useRef(null);
  const router = useRouter();

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";

  // scroll to bottom when new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [allMessages]);

  // initialize socket
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    try {
      const decoded = jwtDecode(token);
      setUserName(decoded.name || "User");
    } catch (err) {
      console.error("Invalid token", err);
      router.push("/login");
      return;
    }

    const newSocket = io(BACKEND_URL, {
      auth: { token },
      withCredentials: true,
    });
    setSocket(newSocket);

    newSocket.on("connect", () => console.log("Socket connected:", newSocket.id));
    newSocket.on("connect_error", (err) => {
      console.error("Socket connect error:", err.message);
      toast.error("Connection failed: " + err.message);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [router, BACKEND_URL]);

  // room creation
  const handleCreateRoom = () => {
    if (!socket) return;
    socket.emit("createRoom", { roomName: "My Room" }, (res) => {
      if (res.ok) {
        setRoom(res);
        toast.success("Room created successfully!");
      } else {
        toast.error("Room creation failed: " + res.error);
      }
    });
  };

  // room join
  const handleJoinRoom = (roomId) => {
    if (!socket) return;
    socket.emit("joinRoom", roomId, (res) => {
      if (res.ok) {
        setRoom({ id: roomId });
        toast.success("Joined room!");
      } else {
        toast.error("Join room failed: " + res.error);
      }
    });
  };

  // room leave
  const handleLeaveRoom = () => {
    if (!socket || !room) return;
    socket.emit("leaveRoom", room.id, (res) => {
      if (res.ok) {
        setRoom(null);
        setAllMessages([]);
        toast.success("Left room");
      } else {
        toast.error("Leave room failed: " + res.error);
      }
    });
  };

  // new message receive
  const handleGetLatestMessage = useCallback((newMessage) => {
    const transformedMessage = {
      id: newMessage.id,
      time: new Date(newMessage.timestamp),
      msg: newMessage.text,
      senderName: newMessage.senderName || "Unknown User",
      senderId: newMessage.senderId,
      socketId: newMessage.socketId,
    };
    setAllMessages((prev) => [...prev, transformedMessage]);
  }, []);

  // attach socket listeners
  useEffect(() => {
    if (!socket) return;
    socket.on("roomUsers", (data) => setRoomUsers(data.count));
    socket.on("getLatestMessage", handleGetLatestMessage);
    socket.on("roomError", (msg) => toast.error(msg));
    socket.on("serverError", (msg) => toast.error(msg));
    socket.on("roomClosed", (data) => {
      if (room && room.id === data.roomId) {
        toast.error("Room was closed by the server");
        setRoom(null);
        setAllMessages([]);
      }
    });

    return () => {
      socket.off("roomUsers");
      socket.off("getLatestMessage", handleGetLatestMessage);
      socket.off("roomError");
      socket.off("serverError");
      socket.off("roomClosed");
    };
  }, [socket, room, handleGetLatestMessage]);

  // send new message
  const handleSendMessage = () => {
    if (!socket || !room || !message.trim()) return;
    socket.emit("newMessage", { room: room.id, newMessage: message }, (res) => {
      if (!res.ok) {
        toast.error("Message send failed: " + res.error);
      }
    });
    setMessage("");
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 p-4 flex flex-col">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <FaComments /> Chat App
        </h2>
        {!room ? (
          <>
            <button
              onClick={handleCreateRoom}
              className="mb-4 bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-lg transition"
            >
              Create Room
            </button>
            <input
              type="text"
              placeholder="Enter Room ID"
              className="mb-2 p-2 rounded-lg text-black"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleJoinRoom(e.target.value);
              }}
            />
          </>
        ) : (
          <button
            onClick={handleLeaveRoom}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg flex items-center gap-2 transition"
          >
            <FaSignOutAlt /> Leave Room
          </button>
        )}
        {room && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold">{room.roomName || "Active Room"}</h3>
            <p className="flex items-center gap-2 mt-2">
              <FaUsers /> {roomUsers} online
            </p>
          </div>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {allMessages.map((message, index) => {
            const isMine = socket && message.socketId === socket.id;
            return (
              <motion.div
                key={message.id || index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs md:max-w-md px-4 py-2 rounded-xl ${
                    isMine
                      ? "bg-teal-600 rounded-br-none"
                      : "bg-slate-700 rounded-bl-none"
                  }`}
                >
                  {!isMine && (
                    <p className="text-xs font-semibold text-teal-300">
                      {message.senderName}
                    </p>
                  )}
                  <p className="text-white">{message.msg}</p>
                  <p
                    className={`text-xs mt-1 ${
                      isMine ? "text-teal-200" : "text-slate-400"
                    } text-right`}
                  >
                    {new Date(message.time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </motion.div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {room && (
          <div className="p-4 bg-gray-800 flex items-center gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Type your message..."
              className="flex-1 p-2 rounded-lg text-black"
            />
            <button
              onClick={handleSendMessage}
              className="bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-lg flex items-center gap-2 transition"
            >
              <FaPaperPlane /> Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
