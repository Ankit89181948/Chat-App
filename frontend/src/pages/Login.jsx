import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, MessageCircle } from "lucide-react";

export default function Login() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await axios.post(
        "https://chat-app-server-j6h2.onrender.com/api/auth/login",
        formData
      );
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      navigate("/protected");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-4 relative overflow-hidden">
      

      {/* Error Notification */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-rose-600 text-white px-6 py-3 rounded-xl shadow-xl z-50 font-medium"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md bg-slate-900/70 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-800/60 p-8 relative z-10"
      >
        {/* Chat Icon */}
        <div className="flex justify-center mb-6">
          <motion.div
            whileHover={{ rotate: 10 }}
            className="p-3 rounded-full bg-gradient-to-br from-teal-500 "
          >
            <MessageCircle className="text-white w-7 h-7" />
          </motion.div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-extrabold text-center text-white tracking-tight mb-2">
          Login to ChatApp
        </h1>
        <p className="text-center text-slate-400 mb-8">
          Connect and start chatting instantly 
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-3 top-3.5 text-slate-400" />
            <input
              type="email"
              name="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full pl-10 pr-4 py-3 bg-slate-800/60 border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500/40 text-white placeholder-slate-400 transition"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 text-slate-400" />
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full pl-10 pr-4 py-3 bg-slate-800/60 border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500/40 text-white placeholder-slate-400 transition"
            />
          </div>

          {/* Login Button */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all"
          >
            {isLoading ? "Logging in..." : "Login"}
          </motion.button>
        </form>

        {/* Signup Link */}
        <p className="text-center text-slate-400 mt-8 text-sm">
          Don’t have an account?{" "}
          <Link
            to="/signup"
            className="text-teal-400 hover:text-teal-300 font-medium transition"
          >
            Sign up
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
