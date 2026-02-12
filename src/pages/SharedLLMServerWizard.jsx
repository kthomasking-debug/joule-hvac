/**
 * Shared Joule LLM Server Setup Wizard
 * Step-by-step guide for hosting a shared LLM server with DuckDNS + Ollama.
 * Free. Includes DuckDNS, optional Caddy/HTTPS, and Cloudflare Tunnel when ports are blocked.
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Server,
  ChevronRight,
  ChevronDown,
  Check,
  Shield,
  Lock,
  Wrench,
  Globe,
  Terminal,
  Router,
  Smartphone,
  ExternalLink,
  Cloud,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import CopyToClipboard from "../components/CopyToClipboard";

const STEPS = [
  { id: "duckdns", title: "DuckDNS auto-update script", icon: Globe },
  { id: "cron", title: "Run every 5 minutes", icon: Terminal },
  { id: "ollama", title: "Ollama listen on internet", icon: Server },
  { id: "router", title: "Router port forward", icon: Router },
  { id: "test", title: "Test from outside", icon: Smartphone },
  { id: "joule", title: "Joule users connect", icon: Globe },
  { id: "security", title: "Security (firewall)", icon: Shield },
  { id: "https", title: "Optional: Free HTTPS", icon: Lock },
  { id: "cloudflare", title: "Optional: Cloudflare Tunnel (when ports blocked)", icon: Cloud },
];

export default function SharedLLMServerWizard() {
  const [domain, setDomain] = useState("joulehvac");
  const [token, setToken] = useState("");
  const [cloudflareTunnelUrl, setCloudflareTunnelUrl] = useState("");
  const [expandedStep, setExpandedStep] = useState("duckdns");
  const [completedSteps, setCompletedSteps] = useState(new Set());

  const toggleStep = (id) => {
    setExpandedStep((prev) => (prev === id ? prev : id));
  };

  const markComplete = (id) => {
    setCompletedSteps((prev) => new Set([...prev, id]));
  };

  const tokenVal = (token || "YOUR_TOKEN").trim();
  const updateScript = `echo url="https://www.duckdns.org/update?domains=${domain}&token=${tokenVal}&ip=" | curl -k -o ~/duckdns/duck.log -K -`;
  const createScriptCommand = `echo '${updateScript.replace(/'/g, "'\"'\"'")}' > update.sh`;
  const jouleUrl = `http://${domain}.duckdns.org:11434/v1`;
  const jouleUrlHttps = `https://${domain}.duckdns.org/v1`;

  const renderStep = (step) => {
    const isExpanded = expandedStep === step.id;
    const isDone = completedSteps.has(step.id);
    const Icon = step.icon;

    return (
      <div
        key={step.id}
        className={`rounded-xl border transition-all ${
          isExpanded
            ? "border-blue-500/50 bg-blue-50/30 dark:bg-blue-900/10 dark:border-blue-400/50"
            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
        }`}
      >
        <button
          type="button"
          onClick={() => toggleStep(step.id)}
          className="w-full flex items-center gap-4 p-4 text-left"
        >
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
            <Icon size={20} className="text-slate-600 dark:text-slate-300" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-xl text-gray-900 dark:text-gray-100">
              {step.title}
            </h3>
          </div>
          {isDone && (
            <Check size={20} className="text-green-600 dark:text-green-400 flex-shrink-0" />
          )}
          {isExpanded ? (
            <ChevronDown size={20} className="text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRight size={20} className="text-gray-500 flex-shrink-0" />
          )}
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 pt-0 space-y-4 border-t border-gray-200 dark:border-gray-700/50">
            {step.id === "duckdns" && (
              <>
                <div className="space-y-4 pt-4">
                  <p className="text-xl text-gray-600 dark:text-gray-400">
                    Do these 3 steps <strong>in order</strong>. Step 1 creates a folder. Step 2 creates the script <em>file</em>. Step 3 runs it.
                  </p>

                  <div className="space-y-2">
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">Step 1 — Create folder</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono overflow-x-auto">
                        mkdir -p ~/duckdns && cd ~/duckdns
                      </code>
                      <CopyToClipboard className="text-lg px-4 py-2"
                        text="mkdir -p ~/duckdns && cd ~/duckdns"
                        label="Copy"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">Step 2 — Create the update.sh file</p>
                    <p className="text-xl text-gray-600 dark:text-gray-400">Copy and run the whole command below. It creates a file called <code>update.sh</code> on your computer. That file is what runs later — don't try to run just part of the command.</p>
                    <div className="flex flex-wrap gap-2 items-start">
                      <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono overflow-x-auto break-all">
                        {createScriptCommand}
                      </code>
                      <CopyToClipboard className="text-lg px-4 py-2" text={createScriptCommand} label="Copy" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">Step 3 — Run the script</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">
                        chmod +x update.sh && ./update.sh && cat duck.log
                      </code>
                      <CopyToClipboard className="text-lg px-4 py-2"
                        text="chmod +x update.sh && ./update.sh && cat duck.log"
                        label="Copy"
                      />
                    </div>
                    <p className="text-xl text-gray-500">You should see <strong>OK</strong> or <strong>NOCHANGE</strong>. It may appear right next to your prompt (e.g. <code>OKthomas@dev-machine:~$</code>) with no space — that means it worked.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => markComplete("duckdns")}
                  className="text-xl text-blue-600 dark:text-blue-400 hover:underline"
                >
                  ✓ I've done this
                </button>
              </>
            )}

            {step.id === "cron" && (
              <>
                <div className="space-y-2 pt-4">
                  <p className="text-xl text-gray-600 dark:text-gray-400">
                    Add a cron job to keep your domain synced.
                  </p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">
                      crontab -e
                    </code>
                    <CopyToClipboard className="text-lg px-4 py-2" text="crontab -e" label="Copy" />
                  </div>
                  <p className="text-xl text-gray-500 mt-2">If it asks you to choose an editor, pick <strong>1</strong> (nano) — it's the easiest. Press Enter.</p>
                  <p className="text-xl text-gray-500 mt-2">Add this line (paste at the bottom):</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">
                      */5 * * * * ~/duckdns/update.sh &gt;/dev/null 2&gt;&amp;1
                    </code>
                    <CopyToClipboard className="text-lg px-4 py-2"
                      text="*/5 * * * * ~/duckdns/update.sh >/dev/null 2>&1"
                      label="Copy"
                    />
                  </div>
                  <p className="text-xl text-gray-500 mt-2">To save and exit: press <strong>Ctrl+O</strong>, then <strong>Enter</strong>, then <strong>Ctrl+X</strong>.</p>
                </div>
                <button
                  type="button"
                  onClick={() => markComplete("cron")}
                  className="text-xl text-blue-600 dark:text-blue-400 hover:underline"
                >
                  ✓ I've done this
                </button>
              </>
            )}

            {step.id === "ollama" && (
              <>
                <div className="space-y-4 pt-4">
                  <p className="text-xl text-gray-600 dark:text-gray-400">
                    Configure Ollama to listen on all interfaces. Run these 3 commands in order.
                  </p>
                  <div className="space-y-2">
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">Step 1 — Create folder</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">
                        sudo mkdir -p /etc/systemd/system/ollama.service.d/
                      </code>
                      <CopyToClipboard className="text-lg px-4 py-2"
                        text="sudo mkdir -p /etc/systemd/system/ollama.service.d/"
                        label="Copy"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">Step 2 — Create the config file</p>
                    <p className="text-xl text-gray-600 dark:text-gray-400">Copy and run the whole command. <strong>Do not paste the text inside the command into the terminal by itself.</strong></p>
                    <div className="flex flex-wrap gap-2 items-start">
                      <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono overflow-x-auto break-all">
                        printf '[Service]\nEnvironment="OLLAMA_KEEP_ALIVE=24h"\nEnvironment="OLLAMA_HOST=0.0.0.0"\nEnvironment="OLLAMA_ORIGINS=*"\n' | sudo tee /etc/systemd/system/ollama.service.d/override.conf
                      </code>
                      <CopyToClipboard className="text-lg px-4 py-2"
                        text={'printf \'[Service]\\nEnvironment="OLLAMA_KEEP_ALIVE=24h"\\nEnvironment="OLLAMA_HOST=0.0.0.0"\\nEnvironment="OLLAMA_ORIGINS=*"\\n\' | sudo tee /etc/systemd/system/ollama.service.d/override.conf'}
                        label="Copy"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">Step 3 — Restart Ollama</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">
                        sudo systemctl daemon-reload && sudo systemctl restart ollama
                      </code>
                      <CopyToClipboard className="text-lg px-4 py-2"
                        text="sudo systemctl daemon-reload && sudo systemctl restart ollama"
                        label="Copy"
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => markComplete("ollama")}
                  className="text-xl text-blue-600 dark:text-blue-400 hover:underline"
                >
                  ✓ I've done this
                </button>
              </>
            )}

            {step.id === "router" && (
              <>
                <div className="space-y-4 pt-4">
                  <p className="text-xl text-gray-600 dark:text-gray-400">
                    Forward port 11434 on your router. Log in at <strong>192.168.1.1</strong> (or your router's address), find Port Forwarding, then add a new rule. Fill it in like this:
                  </p>
                  <div className="space-y-3 text-xl">
                    <div><strong>Service Name:</strong> <code className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">Joule LLM</code> or <code className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">Ollama</code> (any name is fine)</div>
                    <div><strong>Device IP Address:</strong> Your Linux machine's IP (e.g. 192.168.1.100). Use "View Connected Devices" to find it — pick the one running Ollama.</div>
                    <div><strong>External Port:</strong> <code className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">11434</code></div>
                    <div><strong>Internal Port:</strong> <code className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">11434</code></div>
                    <div><strong>Protocol:</strong> Choose <strong>TCP</strong> (not "All" or UDP)</div>
                    <div><strong>Enable This Entry:</strong> Leave checked</div>
                  </div>
                  <p className="text-xl text-gray-500">Save the rule. Your router may need a minute to apply it.</p>
                </div>
                <button
                  type="button"
                  onClick={() => markComplete("router")}
                  className="text-xl text-blue-600 dark:text-blue-400 hover:underline"
                >
                  ✓ I've done this
                </button>
              </>
            )}

            {step.id === "test" && (
              <>
                <div className="space-y-4 pt-4">
                  <p className="text-xl text-gray-600 dark:text-gray-400">
                    From a device <strong>not</strong> on your home WiFi (phone on cellular, or friend's network), test:
                  </p>
                  <div className="space-y-2">
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">On a phone:</p>
                    <p className="text-xl text-gray-600 dark:text-gray-400">Open your browser and go to this URL (no "curl" — that's for computers):</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono break-all">
                        http://{domain}.duckdns.org:11434
                      </code>
                      <CopyToClipboard className="text-lg px-4 py-2"
                        text={`http://${domain}.duckdns.org:11434`}
                        label="Copy URL"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">On a computer (terminal):</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono break-all">
                        curl http://{domain}.duckdns.org:11434
                      </code>
                      <CopyToClipboard className="text-lg px-4 py-2"
                        text={`curl http://${domain}.duckdns.org:11434`}
                        label="Copy"
                      />
                    </div>
                  </div>
                  <p className="text-xl text-gray-500">If working → you'll see Ollama's JSON response (or a page with JSON on a phone).</p>
                  <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-xl text-amber-800 dark:text-amber-200 font-semibold">Phone says "unable to open page"?</p>
                    <p className="text-xl text-amber-700 dark:text-amber-300 mt-1">Many cell carriers block port 11434. Try from a laptop on cellular, or from a friend's WiFi. Or set up <strong>Optional: Free HTTPS</strong> below — that uses port 443, which works from phones.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => markComplete("test")}
                  className="text-xl text-blue-600 dark:text-blue-400 hover:underline"
                >
                  ✓ I've done this
                </button>
              </>
            )}

            {step.id === "joule" && (
              <>
                <div className="space-y-2 pt-4">
                  <p className="text-xl text-gray-600 dark:text-gray-400">
                    Joule users: Settings → AI Integration → Local (Ollama) → On another device.
                  </p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <code className="flex-1 min-w-0 text-sm bg-emerald-100 dark:bg-emerald-900/30 px-3 py-2 rounded-lg font-mono break-all">
                      {jouleUrl}
                    </code>
                    <CopyToClipboard className="text-lg px-4 py-2" text={jouleUrl} label="Copy URL" />
                  </div>
                  <p className="text-xl text-gray-500">Model: <code>llama3</code></p>
                  <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 mt-4">
                    <p className="text-xl text-emerald-800 dark:text-emerald-200 font-semibold">QR code for off-network users</p>
                    <p className="text-xl text-emerald-700 dark:text-emerald-300 mt-1">This link auto-configures Local Ollama. Create a QR code from it; when users scan and open it, the app will use this shared server.</p>
                    <div className="flex flex-wrap gap-2 items-center mt-2">
                      <code className="flex-1 min-w-0 text-lg bg-emerald-100 dark:bg-emerald-900/50 px-3 py-2 rounded-lg font-mono overflow-x-auto break-all">
                        {typeof window !== "undefined" ? `${window.location.origin}/?ollamaUrl=${encodeURIComponent(jouleUrl)}&aiProvider=local&ollamaModel=llama3:latest` : jouleUrl}
                      </code>
                      <CopyToClipboard className="text-lg px-4 py-2"
                        text={typeof window !== "undefined" ? `${window.location.origin}/?ollamaUrl=${encodeURIComponent(jouleUrl)}&aiProvider=local&ollamaModel=llama3:latest` : jouleUrl}
                        label="Copy link"
                      />
                    </div>
                    <p className="text-xl text-emerald-600 dark:text-emerald-400 mt-2">Use any QR generator (e.g. qr-code-generator.com). Users must open the app from this same origin (e.g. Pi on network, or a tunnel for the app).</p>
                  </div>
                  <Link
                    to="/settings"
                    className="inline-flex items-center gap-1 text-xl text-blue-600 dark:text-blue-400 hover:underline mt-2"
                  >
                    Open Settings <ExternalLink size={14} />
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={() => markComplete("joule")}
                  className="text-xl text-blue-600 dark:text-blue-400 hover:underline"
                >
                  ✓ I've done this
                </button>
              </>
            )}

            {step.id === "security" && (
              <>
                <div className="space-y-2 pt-4">
                  <p className="text-xl text-amber-700 dark:text-amber-400">
                    Right now the entire internet can hit your GPU. Add firewall rules.
                  </p>
                  <p className="text-xl text-gray-600 dark:text-gray-400">Minimum:</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">
                      sudo ufw allow 11434/tcp && sudo ufw enable
                    </code>
                    <CopyToClipboard className="text-lg px-4 py-2"
                      text="sudo ufw allow 11434/tcp && sudo ufw enable"
                      label="Copy"
                    />
                  </div>
                  <p className="text-xl text-gray-500 mt-2">Better (friends only):</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">
                      sudo ufw allow from THEIR_IP to any port 11434
                    </code>
                    <CopyToClipboard className="text-lg px-4 py-2"
                      text="sudo ufw allow from THEIR_IP to any port 11434"
                      label="Copy"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => markComplete("security")}
                  className="text-xl text-blue-600 dark:text-blue-400 hover:underline"
                >
                  ✓ I've done this
                </button>
              </>
            )}

            {step.id === "https" && (
              <>
                <div className="space-y-4 pt-4">
                  <p className="text-xl text-gray-600 dark:text-gray-400">
                    Optional: Free HTTPS with Caddy (auto SSL). Uses port 443, so it works from phones on cellular.
                  </p>
                  <p className="text-xl text-amber-700 dark:text-amber-300 font-semibold">Important: Caddy needs two port forwards. Add both on your router: External 80 → your Linux machine port 80, and External 443 → port 443. (Port 80 is used to get the SSL certificate.)</p>
                  <div className="space-y-2">
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">Step 1 — Install Caddy</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">
                        sudo apt install caddy
                      </code>
                      <CopyToClipboard className="text-lg px-4 py-2" text="sudo apt install caddy" label="Copy" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">Step 2 — Edit the config file</p>
                    <p className="text-xl text-gray-600 dark:text-gray-400">Run this to open the file in an editor (don't paste the config into the terminal):</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">
                        sudo nano /etc/caddy/Caddyfile
                      </code>
                      <CopyToClipboard className="text-lg px-4 py-2" text="sudo nano /etc/caddy/Caddyfile" label="Copy" />
                    </div>
                    <p className="text-xl text-gray-600 dark:text-gray-400 mt-2">At the bottom of the file, add this block (copy and paste it into nano):</p>
                    <pre className="text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono overflow-x-auto">
{`${domain}.duckdns.org {
    reverse_proxy localhost:11434
}`}
                    </pre>
                    <CopyToClipboard className="text-lg px-4 py-2"
                      text={`${domain}.duckdns.org {\n    reverse_proxy localhost:11434\n}`}
                      label="Copy block"
                    />
                    <p className="text-xl text-gray-500">Save and exit: <strong>Ctrl+O</strong>, <strong>Enter</strong>, <strong>Ctrl+X</strong></p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">Step 3 — Restart Caddy</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">
                        sudo systemctl restart caddy
                      </code>
                      <CopyToClipboard className="text-lg px-4 py-2" text="sudo systemctl restart caddy" label="Copy" />
                    </div>
                  </div>
                  <p className="text-xl text-gray-500">Users connect via: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{jouleUrlHttps}</code> (no port needed)</p>
                  <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 mt-4">
                    <p className="text-xl text-amber-800 dark:text-amber-200 font-semibold">"Connection timed out" or "took too long to respond"?</p>
                    <p className="text-xl text-amber-700 dark:text-amber-300 mt-1">Forward both <strong>80</strong> and <strong>443</strong> on your router. If your ISP blocks ports 80/443, use <strong>Cloudflare Tunnel</strong> (next step) instead.</p>
                  </div>
                </div>
              </>
            )}

            {step.id === "cloudflare" && (
              <>
                <div className="space-y-4 pt-4">
                  <p className="text-xl text-gray-600 dark:text-gray-400">
                    Use this when Caddy/port forwarding doesn't work (e.g. ISP blocks ports 80 and 443). No port forwarding needed — traffic goes outbound through Cloudflare.
                  </p>
                  <div className="space-y-2">
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">Step 1 — Install cloudflared</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono overflow-x-auto">
                        curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
                      </code>
                      <CopyToClipboard className="text-lg px-4 py-2"
                        text="curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb"
                        label="Copy"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">
                        sudo dpkg -i cloudflared.deb
                      </code>
                      <CopyToClipboard className="text-lg px-4 py-2" text="sudo dpkg -i cloudflared.deb" label="Copy" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">Step 2 — Run quick tunnel</p>
                    <p className="text-xl text-gray-600 dark:text-gray-400">This creates a public URL. No login or domain needed. Keep the terminal open — the tunnel runs while this command runs.</p>
                    <div className="flex flex-wrap gap-2 items-start">
                      <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono overflow-x-auto">
                        cloudflared tunnel --url http://localhost:11434
                      </code>
                      <CopyToClipboard className="text-lg px-4 py-2"
                        text="cloudflared tunnel --url http://localhost:11434"
                        label="Copy"
                      />
                    </div>
                    <p className="text-xl text-gray-500">You'll see a URL like <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">https://something-random.trycloudflare.com</code>. Add <strong>/v1</strong> for Joule (e.g. https://something-random.trycloudflare.com/v1).</p>
                    <p className="text-xl text-amber-700 dark:text-amber-300">Note: The URL changes each time you restart the tunnel.</p>
                  </div>
                  <details className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 overflow-hidden">
                    <summary className="px-4 py-3 cursor-pointer text-xl font-semibold text-gray-900 dark:text-gray-100 hover:bg-slate-100 dark:hover:bg-slate-800">
                      Stable URL: named tunnel with your own domain
                    </summary>
                    <div className="px-4 pb-4 pt-0 space-y-4 border-t border-slate-200 dark:border-slate-700">
                      <div className="pt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 space-y-3">
                        <p className="text-xl font-semibold text-amber-800 dark:text-amber-200">Do this first</p>
                        <p className="text-xl text-amber-700 dark:text-amber-300">Add your domain to Cloudflare and point its nameservers to Cloudflare. Only then run the commands below.</p>
                        <div className="text-xl text-amber-700 dark:text-amber-300 space-y-2">
                          <p><strong>Get a domain</strong> — Buy one from Namecheap, Cloudflare Registrar, Google Domains, Porkbun, or similar (often a few dollars/year). A subdomain like <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">ollama.yourdomain.com</code> is enough.</p>
                          <p><strong>Add to Cloudflare</strong> — Go to <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="text-amber-800 dark:text-amber-200 underline">dash.cloudflare.com</a> → Add a site → enter your domain → pick the free plan. Cloudflare gives you two nameservers (e.g. <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">ada.ns.cloudflare.com</code>, <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">bob.ns.cloudflare.com</code>). At your registrar (where you bought the domain), change the domain's nameservers to those two. Wait a few minutes to 48 hours for DNS to update. When Cloudflare shows your site as Active, you're ready.</p>
                        </div>
                      </div>
                      <p className="text-xl text-gray-600 dark:text-gray-400">Run these in order, in a terminal on the machine running Ollama. Copy each command, paste into the terminal, press Enter.</p>
                      <div className="space-y-2">
                        <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">1. Log in to Cloudflare (paste in terminal)</p>
                        <div className="flex flex-wrap gap-2 items-center">
                          <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">cloudflared tunnel login</code>
                          <CopyToClipboard className="text-lg px-4 py-2" text="cloudflared tunnel login" label="Copy" />
                        </div>
                        <p className="text-xl text-gray-500">A browser opens — log in and select your domain. Then return to the terminal.</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">2. Create the tunnel (paste in terminal)</p>
                        <div className="flex flex-wrap gap-2 items-center">
                          <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">cloudflared tunnel create joule-llm</code>
                          <CopyToClipboard className="text-lg px-4 py-2" text="cloudflared tunnel create joule-llm" label="Copy" />
                        </div>
                        <p className="text-xl text-gray-500">Creates credentials in <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">~/.cloudflared/</code>. Note the tunnel UUID shown in the output.</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">3. Create config file (use a text editor, not terminal)</p>
                        <p className="text-xl text-gray-600 dark:text-gray-400">Create file <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">~/.cloudflared/config.yml</code>. Run <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">nano ~/.cloudflared/config.yml</code> to edit. Paste this (replace YOUR_USER and TUNNEL_UUID with values from step 2 — run <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">cloudflared tunnel list</code> to see UUID):</p>
                        <pre className="text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono overflow-x-auto">
{`url: http://localhost:11434
tunnel: joule-llm
credentials-file: /home/YOUR_USER/.cloudflared/TUNNEL_UUID.json`}
                        </pre>
                        <CopyToClipboard className="text-lg px-4 py-2"
                          text={`url: http://localhost:11434
tunnel: joule-llm
credentials-file: /home/YOUR_USER/.cloudflared/TUNNEL_UUID.json`}
                          label="Copy block"
                        />
                        <p className="text-xl text-gray-500">Save and exit nano: Ctrl+O, Enter, Ctrl+X.</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">4. Route DNS (paste in terminal; replace yourdomain.com)</p>
                        <div className="flex flex-wrap gap-2 items-center">
                          <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">cloudflared tunnel route dns joule-llm ollama.yourdomain.com</code>
                          <CopyToClipboard className="text-lg px-4 py-2" text="cloudflared tunnel route dns joule-llm ollama.yourdomain.com" label="Copy" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">5. Start the tunnel (paste in terminal)</p>
                        <div className="flex flex-wrap gap-2 items-center">
                          <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">cloudflared tunnel run joule-llm</code>
                          <CopyToClipboard className="text-lg px-4 py-2" text="cloudflared tunnel run joule-llm" label="Copy" />
                        </div>
                        <p className="text-xl text-gray-500">Users connect via <strong>https://ollama.yourdomain.com/v1</strong>. To run as a service (always on), see <a href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/local-management/as-a-service/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Cloudflare docs</a>.</p>
                      </div>
                    </div>
                  </details>
                  <p className="text-xl text-gray-500">Joule users: Settings → AI Integration → Local (Ollama) → On another device → enter the URL.</p>
                  <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 mt-4">
                    <p className="text-xl text-emerald-800 dark:text-emerald-200 font-semibold">QR code for off-network users</p>
                    <p className="text-xl text-emerald-700 dark:text-emerald-300 mt-1">Paste your Cloudflare tunnel URL below (e.g. https://unexpected-helena-houston-develop.trycloudflare.com). The link will auto-configure Local Ollama when users open it. Create a QR code from the link.</p>
                    <input
                      type="url"
                      value={cloudflareTunnelUrl}
                      onChange={(e) => setCloudflareTunnelUrl(e.target.value)}
                      placeholder="https://something.trycloudflare.com"
                      className="w-full px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-lg font-mono mt-2"
                    />
                    {(() => {
                      const base = cloudflareTunnelUrl.trim() ? (cloudflareTunnelUrl.replace(/\/v1$/, "") + "/v1") : `https://YOUR-TUNNEL.trycloudflare.com/v1`;
                      const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/?ollamaUrl=${encodeURIComponent(base)}&aiProvider=local&ollamaModel=llama3:latest` : "";
                      return (
                        <>
                          <div className="flex flex-wrap gap-2 items-center mt-2">
                            <code className="flex-1 min-w-0 text-lg bg-emerald-100 dark:bg-emerald-900/50 px-3 py-2 rounded-lg font-mono overflow-x-auto break-all">
                              {shareUrl}
                            </code>
                            <CopyToClipboard className="text-lg px-4 py-2" text={shareUrl} label="Copy link" />
                          </div>
                          <p className="text-xl text-emerald-600 dark:text-emerald-400 mt-2">Use any QR generator (e.g. qr-code-generator.com) with the link. Users must open the app from this same origin (e.g. Pi on network, or a tunnel for the app).</p>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 py-6 font-serif text-xl" style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "1.5rem" }}>
      <Breadcrumbs
        items={[
          { label: "Tools", to: "/tools" },
          { label: "Shared LLM Server Wizard" },
        ]}
      />

      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Server size={24} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          Shared Joule LLM Server Wizard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2 text-2xl">
          Turn your Linux PC with a GPU into a shared LLM server. All free — DuckDNS + Ollama, no ngrok or Cloudflare.
        </p>
      </div>

      <div className="mb-6 p-4 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-3">Your DuckDNS settings</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xl font-medium text-gray-600 dark:text-gray-400 mb-1">Domain (e.g. joulehvac)</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value.replace(/[^a-z0-9-]/g, ""))}
              placeholder="joulehvac"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xl font-mono"
            />
          </div>
          <div>
            <label className="block text-xl font-medium text-gray-600 dark:text-gray-400 mb-1">Token (from duckdns.org)</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Your DuckDNS token"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xl font-mono"
            />
          </div>
        </div>
        <p className="text-xl text-gray-500 mt-2">
          Commands below use these values. Token is only used locally for generated commands — never sent to any server.
        </p>
      </div>

      <div className="space-y-3">
        {STEPS.map(renderStep)}
      </div>

      <div className="mt-8 p-4 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
          <Wrench size={16} />
          Quick diagnostics
        </h3>
        <div className="space-y-2 text-xl">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-gray-600 dark:text-gray-400">Check port open:</span>
            <code className="text-lg bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded font-mono">sudo ss -tulpn | grep 11434</code>
            <CopyToClipboard className="text-lg px-4 py-2" text="sudo ss -tulpn | grep 11434" label="Copy" />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-gray-600 dark:text-gray-400">Check firewall:</span>
            <code className="text-lg bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded font-mono">sudo ufw status</code>
            <CopyToClipboard className="text-lg px-4 py-2" text="sudo ufw status" label="Copy" />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-gray-600 dark:text-gray-400">Check public IP:</span>
            <code className="text-lg bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded font-mono">curl ifconfig.me</code>
            <CopyToClipboard className="text-lg px-4 py-2" text="curl ifconfig.me" label="Copy" />
          </div>
          <p className="text-lg text-gray-500">Make sure it matches DuckDNS IP.</p>
        </div>
      </div>

      <div className="mt-6 text-xl text-gray-500 dark:text-gray-400">
        <Link to="/docs/SHARED-LLM-SERVER.md" className="text-blue-600 dark:text-blue-400 hover:underline">
          View full documentation →
        </Link>
      </div>
    </div>
  );
}
