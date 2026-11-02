import { useState } from "react";

// Presentation-only demo credentials. This is a browser UI gate, not server authentication.
export const DEMO_USERNAME = "admin";
export const DEMO_PASSWORD = "Formatix@123";
export const DEMO_SESSION = "formatix-client-demo-session-v1";

export default function LocalLogin({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState("");
  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        setError("");
        if (username.trim() !== DEMO_USERNAME || password !== DEMO_PASSWORD) {
          setError("Incorrect demo username or password. Please try again.");
          return;
        }
        onLogin();
      }}
    >
      <label className="field">
        <span>Username</span>
        <input
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter username"
        />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
        />
      </label>
      {error && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn primary" type="submit">
        Sign in
      </button>
      <p className="muted">
        Client demo · No registration needed. Quotations and settings are saved only in this
        browser.
      </p>
    </form>
  );
}
