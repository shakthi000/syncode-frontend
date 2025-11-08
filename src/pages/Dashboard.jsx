import React, { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import axios from "axios";
import io from "socket.io-client";
import "./dashboard.css";
import { FaUserCircle } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import ChatBot from "./Chatbot";

const API_URL = process.env.REACT_APP_API_URL;
const socket = io(API_URL); // Socket.IO connects to deployed backend

const Dashboard = () => {
  const username = localStorage.getItem("username") || "User";
  const userId = localStorage.getItem("userId");
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("editor");
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("python");
  const [output, setOutput] = useState("");
  const [snippets, setSnippets] = useState([]);
  const [pinned, setPinned] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    socket.on("receive-code", (data) => setCode(data));
    return () => socket.off("receive-code");
  }, []);

  useEffect(() => {
    if (!userId) return;
    const fetchSnippets = async () => {
      try {
        const res = await axios.get(`${API_URL}/snippets/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSnippets(res.data);
        setPinned(res.data.filter((s) => s.pinned));
      } catch (err) {
        console.error("Error fetching snippets:", err);
      }
    };
    fetchSnippets();
  }, [userId, token]);

  const handleCodeChange = (value) => {
    setCode(value);
    socket.emit("code-change", value);
  };

  const runCode = async () => {
    if (!code.trim()) {
      setOutput("⚠️ Code is empty!");
      return;
    }
    setIsRunning(true);
    setOutput("Running...");
    try {
      const languageMap = {
        python: "python",
        cpp: "c++",
        c: "c",
        java: "java",
        javascript: "javascript",
      };
      const res = await axios.post(
        `${API_URL}/run`,
        { language: languageMap[language], code },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setOutput(res.data.run?.output || "No output");
    } catch (err) {
      setOutput("❌ Error: " + (err.response?.data?.error || err.message));
    } finally {
      setIsRunning(false);
    }
  };

  const saveSnippet = async () => {
    if (!code.trim()) return;
    setIsSaving(true);
    try {
      const saveRes = await axios.post(
        `${API_URL}/save`,
        { language, code },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await axios.post(
        `${API_URL}/chatbot/addSnippet`,
        { snippetId: saveRes.data._id, code },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const res = await axios.get(`${API_URL}/snippets/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSnippets(res.data);
      setPinned(res.data.filter((s) => s.pinned));
      alert("✅ Snippet saved and synced to ChatBot!");
    } catch (err) {
      alert("Error saving snippet: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSnippet = async (id) => {
    if (!window.confirm("Delete this snippet?")) return;
    try {
      await axios.delete(`${API_URL}/snippets/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSnippets(snippets.filter((s) => s._id !== id));
      setPinned(pinned.filter((s) => s._id !== id));
    } catch (err) {
      alert("Error deleting snippet: " + err.message);
    }
  };

  const togglePin = async (sn) => {
    try {
      const updated = { ...sn, pinned: !sn.pinned };
      await axios.put(`${API_URL}/snippets/${sn._id}`, updated, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const updatedSnippets = snippets.map((s) => (s._id === sn._id ? updated : s));
      setSnippets(updatedSnippets);
      setPinned(updatedSnippets.filter((s) => s.pinned));
    } catch (err) {
      alert("Error updating pin: " + err.message);
    }
  };

  const downloadSnippet = (sn) => {
    const element = document.createElement("a");
    const file = new Blob([sn.code], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `snippet.${sn.language === "cpp" ? "cpp" : sn.language}`;
    document.body.appendChild(element);
    element.click();
  };

  const clearOutput = () => setOutput("");

  const handleLogout = () => {
    setLoggingOut(true);
    setTimeout(() => {
      localStorage.clear();
      window.location.reload();
    }, 500);
  };

  return (
    <div className={`dashboard-container ${loggingOut ? "fade-out" : ""}`}>
      <header className="dashboard-header">
        <h2>🚀 Welcome, {username}</h2>
        <button className="logout-btn" onClick={handleLogout}>🔒 Logout</button>
        <div className="header-actions" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <FaUserCircle size={30} style={{ cursor: "pointer" }} onClick={() => navigate("/profile")} />
        </div>
      </header>

      <div className="dashboard-tabs">
        <button className={activeTab === "editor" ? "active" : ""} onClick={() => setActiveTab("editor")}>🖥️ Editor</button>
        <button className={activeTab === "chat" ? "active" : ""} onClick={() => setActiveTab("chat")}>🤖 ChatBot</button>
      </div>

      {activeTab === "editor" && (
        <>
          <div className="toolbar">
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="python">🐍 Python</option>
              <option value="cpp">⚙️ C++</option>
              <option value="c">💡 C</option>
              <option value="java">☕ Java</option>
              <option value="javascript">⚡ JavaScript</option>
            </select>
            <div>
              <button onClick={runCode} disabled={isRunning}>{isRunning ? "Running..." : "Run ▶️"}</button>
              <button onClick={saveSnippet} disabled={isSaving}>{isSaving ? "Saving..." : "💾 Save"}</button>
              <button onClick={clearOutput}>🧹 Clear Output</button>
            </div>
          </div>

          <Editor
            height="55vh"
            width="100%"
            theme="vs-dark"
            language={language}
            value={code}
            onChange={handleCodeChange}
            options={{
              fontSize: 16,
              minimap: { enabled: false },
              fontFamily: "JetBrains Mono, monospace",
              scrollBeyondLastLine: false,
            }}
          />

          <div className="output-container">
            <h3>🖥 Output</h3>
            <pre>{output}</pre>
          </div>

          <div className="snippets-section">
            <h3>📜 Your Snippets</h3>
            <ul>
              {[...pinned, ...snippets.filter((s) => !s.pinned)].map((sn) => (
                <li key={sn._id} className={sn.pinned ? "pinned-snippet" : ""}>
                  <div className="snippet-item" onClick={() => { setCode(sn.code); setLanguage(sn.language); }}>
                    <strong>{sn.language}</strong> {sn.pinned && "⭐"} — <span>{new Date(sn.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="snippet-actions">
                    <button onClick={() => downloadSnippet(sn)}>💾 Download</button>
                    <button onClick={() => togglePin(sn)}>{sn.pinned ? "📌 Unpin" : "📌 Pin"}</button>
                    <button onClick={() => deleteSnippet(sn._id)}>🗑️ Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {activeTab === "chat" && <ChatBot />}
    </div>
  );
};

export default Dashboard;
