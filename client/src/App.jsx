import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { socket } from "./socket";

export default function App() {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");
  const [users, setUsers] = useState([]);
  const [code, setCode] = useState("");

  // Guards against re-emitting an update we just received from the server
  const receivingRemoteUpdate = useRef(false);

  useEffect(() => {
    socket.on("room-users", (userList) => setUsers(userList));

    socket.on("code-change", (incomingCode) => {
      receivingRemoteUpdate.current = true;
      setCode(incomingCode);
    });

    return () => {
      socket.off("room-users");
      socket.off("code-change");
    };
  }, []);

  const handleJoin = (e) => {
    e.preventDefault();
    if (!roomId.trim() || !username.trim()) return;
    socket.connect();
    socket.emit("join-room", { roomId: roomId.trim(), username: username.trim() });
    setJoined(true);
  };

  // Monaco's onChange fires with (value, event)
  const handleEditorChange = (value) => {
    setCode(value ?? "");

    if (receivingRemoteUpdate.current) {
      receivingRemoteUpdate.current = false;
      return;
    }
    socket.emit("code-change", value ?? "");
  };

  if (!joined) {
    return (
      <div className="join-screen">
        <form onSubmit={handleJoin}>
          <h1>Realtime Code Editor</h1>
          <input
            placeholder="Room ID (e.g. team-standup)"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <input
            placeholder="Your name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button type="submit">Join room</button>
        </form>
      </div>
    );
  }

  return (
    <div className="editor-screen">
      <header>
        <span>Room: {roomId}</span>
        <span className="users">
          {users.length} online · {users.join(", ")}
        </span>
      </header>
      <div className="monaco-container">
        <Editor
          height="100%"
          defaultLanguage="javascript"
          theme="vs-dark"
          value={code}
          onChange={handleEditorChange}
          options={{ minimap: { enabled: false }, fontSize: 14 }}
        />
      </div>
    </div>
  );
}