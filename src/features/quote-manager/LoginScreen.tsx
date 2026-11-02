import type { ReactNode } from "react";
import { ShieldCheck, Sparkles, Car, ArrowUpRight } from "lucide-react";

export default function LoginScreen({
  checking,
  children,
  onDemo,
  local = false,
}: {
  checking: boolean;
  children: ReactNode;
  onDemo?: () => void;
  local?: boolean;
}) {
  return (
    <div className="app login-shell" data-ready={!checking}>
      <aside className="login-story" aria-label="Formatix studio">
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true">
            F<span />
          </span>
          <div>
            <b>FORMATIX</b>
            <small>PREMIUM DETAILING STUDIO</small>
          </div>
        </div>
        <div className="login-story-content">
          <span className="login-overline">YOUR STUDIO. PERFECTLY IN SYNC.</span>
          <h1>
            Great details.
            <br />
            Greater possibilities.
          </h1>
          <p>
            A dedicated workspace for your quotations, customers and the conversations that move
            your studio forward.
          </p>
          <div className="login-features">
            <span>
              <Car size={20} />
              Every vehicle. Every detail.
            </span>
            <span>
              <Sparkles size={20} />A refined quotation experience.
            </span>
            <span>
              <ShieldCheck size={20} />
              {local ? "Your studio, ready to demonstrate." : "Secure access for your team."}
            </span>
          </div>
        </div>
        <footer>
          THE FORMATIX STANDARD <span>PRECISION IN EVERY DETAIL</span>
        </footer>
      </aside>
      <main className="login-main">
        <div className="login-card">
          <div className="login-emblem">
            <ShieldCheck size={26} />
          </div>
          <p className="login-overline">WELCOME TO YOUR WORKSPACE</p>
          <h2>Welcome back.</h2>
          <p className="login-description">
            {local ? "Sign in to the Formatix client demo." : "Sign in to manage your studio."}
          </p>
          {checking ? (
            <div className="login-loading" role="status">
              <span />
              Checking your session…
            </div>
          ) : (
            children
          )}
          {!checking && onDemo && (
            <div className="login-demo">
              <button type="button" onClick={onDemo}>
                Explore local demo <ArrowUpRight size={15} />
              </button>
              <small>Demo data stays in this browser. No cloud access.</small>
            </div>
          )}
          <p className="login-security">
            <ShieldCheck size={14} />
            {local
              ? "Browser-only demo. No server authentication or shared storage."
              : "Your studio. Your team. Securely connected."}
          </p>
        </div>
        <footer>FORMATIX · PREMIUM DETAILING STUDIO</footer>
      </main>
    </div>
  );
}
