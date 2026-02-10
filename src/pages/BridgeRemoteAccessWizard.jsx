/**
 * Pi Zero Bridge Remote Access Wizard
 * Step-by-step guide to make the Joule bridge accessible from outside your network.
 * DuckDNS + port forward, or Cloudflare Tunnel when ports are blocked, or Tailscale (VPN).
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Server,
  ChevronRight,
  ChevronDown,
  Check,
  Shield,
  Globe,
  Terminal,
  Router,
  Smartphone,
  ExternalLink,
  Cloud,
  Wifi,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import CopyToClipboard from "../components/CopyToClipboard";

const STEPS = [
  { id: "duckdns", title: "DuckDNS auto-update script", icon: Globe },
  { id: "cron", title: "Run every 5 minutes", icon: Terminal },
  { id: "router", title: "Router port forward", icon: Router },
  { id: "test", title: "Test from outside", icon: Smartphone },
  { id: "connect", title: "Connect app to bridge", icon: Server },
  { id: "security", title: "Security (firewall)", icon: Shield },
  { id: "cloudflare", title: "Optional: Cloudflare Tunnel (when ports blocked)", icon: Cloud },
  { id: "tailscale", title: "Optional: Tailscale (zero-config VPN)", icon: Wifi },
];

const BRIDGE_PORT = 8080;

export default function BridgeRemoteAccessWizard() {
  const [domain, setDomain] = useState("joulebridge");
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
  const bridgeUrl = `http://${domain}.duckdns.org:${BRIDGE_PORT}`;

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
                    Do these 3 steps <strong>in order</strong>. Run each command in a terminal on your Pi (SSH in or use the Pi directly).
                  </p>
                  <div className="space-y-2">
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">Step 1 — Create folder (paste in terminal)</p>
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
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">Step 2 — Create the update.sh file (paste in terminal)</p>
                    <p className="text-xl text-gray-600 dark:text-gray-400">Run the whole command below. Replace YOUR_DOMAIN and YOUR_TOKEN with your DuckDNS domain and token from <a href="https://www.duckdns.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">duckdns.org</a>.</p>
                    <div className="flex flex-wrap gap-2 items-start">
                      <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono overflow-x-auto break-all">
                        {createScriptCommand}
                      </code>
                      <CopyToClipboard className="text-lg px-4 py-2" text={createScriptCommand} label="Copy" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">Step 3 — Run the script (paste in terminal)</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">
                        chmod +x update.sh && ./update.sh && cat duck.log
                      </code>
                      <CopyToClipboard className="text-lg px-4 py-2"
                        text="chmod +x update.sh && ./update.sh && cat duck.log"
                        label="Copy"
                      />
                    </div>
                    <p className="text-xl text-gray-500">You should see <strong>OK</strong> or <strong>NOCHANGE</strong>.</p>
                  </div>
                </div>
                <button type="button" onClick={() => markComplete("duckdns")} className="text-xl text-blue-600 dark:text-blue-400 hover:underline">
                  ✓ I've done this
                </button>
              </>
            )}

            {step.id === "cron" && (
              <>
                <div className="space-y-2 pt-4">
                  <p className="text-xl text-gray-600 dark:text-gray-400">Add a cron job on the Pi to keep your domain synced when your IP changes.</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">crontab -e</code>
                    <CopyToClipboard className="text-lg px-4 py-2" text="crontab -e" label="Copy" />
                  </div>
                  <p className="text-xl text-gray-500 mt-2">Choose editor <strong>1</strong> (nano) if asked. Add this line at the bottom:</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">*/5 * * * * ~/duckdns/update.sh &gt;/dev/null 2&gt;&amp;1</code>
                    <CopyToClipboard className="text-lg px-4 py-2" text="*/5 * * * * ~/duckdns/update.sh >/dev/null 2>&1" label="Copy" />
                  </div>
                  <p className="text-xl text-gray-500 mt-2">Save and exit: <strong>Ctrl+O</strong>, <strong>Enter</strong>, <strong>Ctrl+X</strong>.</p>
                </div>
                <button type="button" onClick={() => markComplete("cron")} className="text-xl text-blue-600 dark:text-blue-400 hover:underline">✓ I've done this</button>
              </>
            )}

            {step.id === "router" && (
              <>
                <div className="space-y-4 pt-4">
                  <p className="text-xl text-gray-600 dark:text-gray-400">On your router (often at 192.168.1.1), add a port forwarding rule:</p>
                  <div className="overflow-x-auto">
                    <table className="text-xl border-collapse border border-gray-300 dark:border-gray-600">
                      <thead>
                        <tr className="bg-gray-100 dark:bg-gray-800">
                          <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">Setting</th>
                          <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr><td className="border border-gray-300 dark:border-gray-600 px-4 py-2">Service Name</td><td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-mono">joule-bridge</td></tr>
                        <tr><td className="border border-gray-300 dark:border-gray-600 px-4 py-2">External Port</td><td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-mono">{BRIDGE_PORT}</td></tr>
                        <tr><td className="border border-gray-300 dark:border-gray-600 px-4 py-2">Internal IP</td><td className="border border-gray-300 dark:border-gray-600 px-4 py-2">Your Pi's IP (e.g. 192.168.1.100)</td></tr>
                        <tr><td className="border border-gray-300 dark:border-gray-600 px-4 py-2">Internal Port</td><td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-mono">{BRIDGE_PORT}</td></tr>
                        <tr><td className="border border-gray-300 dark:border-gray-600 px-4 py-2">Protocol</td><td className="border border-gray-300 dark:border-gray-600 px-4 py-2">TCP</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xl text-gray-500">Find your Pi's IP with <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">hostname -I</code> on the Pi.</p>
                </div>
                <button type="button" onClick={() => markComplete("router")} className="text-xl text-blue-600 dark:text-blue-400 hover:underline">✓ I've done this</button>
              </>
            )}

            {step.id === "test" && (
              <>
                <div className="space-y-2 pt-4">
                  <p className="text-xl text-gray-600 dark:text-gray-400">From a phone on cellular or another network, open in a browser:</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono break-all">{bridgeUrl}/health</code>
                    <CopyToClipboard className="text-lg px-4 py-2" text={`${bridgeUrl}/health`} label="Copy" />
                  </div>
                  <p className="text-xl text-gray-500">If it works, you'll see JSON or a health response. If the page doesn't load, many cell carriers block non-HTTPS ports — use <strong>Cloudflare Tunnel</strong> (optional step below).</p>
                </div>
                <button type="button" onClick={() => markComplete("test")} className="text-xl text-blue-600 dark:text-blue-400 hover:underline">✓ I've done this</button>
              </>
            )}

            {step.id === "connect" && (
              <>
                <div className="space-y-2 pt-4">
                  <p className="text-xl text-gray-600 dark:text-gray-400">In Joule: <strong>Settings → Bridge Connection</strong> (or Mission Control → Bridge). Enter the bridge URL:</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <code className="flex-1 min-w-0 text-lg bg-emerald-100 dark:bg-emerald-900/30 px-3 py-2 rounded-lg font-mono break-all">{bridgeUrl}</code>
                    <CopyToClipboard className="text-lg px-4 py-2" text={bridgeUrl} label="Copy" />
                  </div>
                  <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 mt-4">
                    <p className="text-xl text-emerald-800 dark:text-emerald-200 font-semibold">QR code for off-network users</p>
                    <p className="text-xl text-emerald-700 dark:text-emerald-300 mt-1">Create a QR code with this URL. When users scan it, they can open the Joule app pointed at your bridge.</p>
                    <div className="flex flex-wrap gap-2 items-center mt-2">
                      <code className="flex-1 min-w-0 text-lg bg-emerald-100 dark:bg-emerald-900/50 px-3 py-2 rounded-lg font-mono overflow-x-auto break-all">{bridgeUrl}</code>
                      <CopyToClipboard className="text-lg px-4 py-2" text={bridgeUrl} label="Copy" />
                    </div>
                    <p className="text-xl text-emerald-600 dark:text-emerald-400 mt-2">Users need to add this as the bridge URL in Settings. Use any QR generator (e.g. qr-code-generator.com).</p>
                  </div>
                  <Link to="/settings" className="inline-flex items-center gap-1 text-xl text-blue-600 dark:text-blue-400 hover:underline mt-2">
                    Open Settings <ExternalLink size={14} />
                  </Link>
                </div>
                <button type="button" onClick={() => markComplete("connect")} className="text-xl text-blue-600 dark:text-blue-400 hover:underline">✓ I've done this</button>
              </>
            )}

            {step.id === "security" && (
              <>
                <div className="space-y-2 pt-4">
                  <p className="text-xl text-amber-700 dark:text-amber-400">The internet can now reach your bridge. Add firewall rules on the Pi.</p>
                  <p className="text-xl text-gray-600 dark:text-gray-400">Minimum:</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">sudo ufw allow {BRIDGE_PORT}/tcp && sudo ufw enable</code>
                    <CopyToClipboard className="text-lg px-4 py-2" text={`sudo ufw allow ${BRIDGE_PORT}/tcp && sudo ufw enable`} label="Copy" />
                  </div>
                  <p className="text-xl text-gray-500 mt-2">Better (friends only): <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">sudo ufw allow from THEIR_IP to any port {BRIDGE_PORT}</code></p>
                </div>
                <button type="button" onClick={() => markComplete("security")} className="text-xl text-blue-600 dark:text-blue-400 hover:underline">✓ I've done this</button>
              </>
            )}

            {step.id === "cloudflare" && (
              <>
                <div className="space-y-4 pt-4">
                  <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-xl font-semibold text-amber-800 dark:text-amber-200">SSH into your Pi first</p>
                    <p className="text-xl text-amber-700 dark:text-amber-300 mt-1">The Pi has no keyboard. From your computer, run <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">ssh pi@YOUR_PI_IP</code> (e.g. ssh pi@192.168.1.100). Then run the commands below in that SSH session.</p>
                  </div>
                  <p className="text-xl text-gray-600 dark:text-gray-400">
                    Use when port forwarding doesn't work (e.g. ISP blocks ports, phone on cellular). No port forwarding needed.
                  </p>
                  <div className="space-y-2">
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">Step 1 — Install cloudflared on the Pi (paste in terminal)</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono overflow-x-auto">
                        curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
                      </code>
                      <CopyToClipboard className="text-lg px-4 py-2"
                        text="curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb"
                        label="Copy"
                      />
                    </div>
                    <p className="text-xl text-gray-500">Use <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">cloudflared-linux-amd64.deb</code> if your Pi is 64-bit x86.</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">sudo dpkg -i cloudflared.deb</code>
                      <CopyToClipboard className="text-lg px-4 py-2" text="sudo dpkg -i cloudflared.deb" label="Copy" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">Step 2 — Run quick tunnel (paste in terminal)</p>
                    <p className="text-xl text-gray-600 dark:text-gray-400">Keep the terminal open. The tunnel runs while this command runs.</p>
                    <div className="flex flex-wrap gap-2 items-start">
                      <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono overflow-x-auto">
                        cloudflared tunnel --url http://localhost:{BRIDGE_PORT}
                      </code>
                      <CopyToClipboard className="text-lg px-4 py-2"
                        text={`cloudflared tunnel --url http://localhost:${BRIDGE_PORT}`}
                        label="Copy"
                      />
                    </div>
                    <p className="text-xl text-gray-500">You'll see a URL like <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">https://something-random.trycloudflare.com</code>. That's your bridge URL — enter it in Settings → Joule Bridge URL. The URL changes each time you restart the tunnel.</p>
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
                          <p><strong>Get a domain</strong> — Buy one from Namecheap, Cloudflare Registrar, Google Domains, Porkbun, or similar (often a few dollars/year). A subdomain like <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">bridge.yourdomain.com</code> is enough.</p>
                          <p><strong>Add to Cloudflare</strong> — Go to <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="text-amber-800 dark:text-amber-200 underline">dash.cloudflare.com</a> → Add a site → enter your domain → pick the free plan. Cloudflare gives you two nameservers (e.g. <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">ada.ns.cloudflare.com</code>, <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">bob.ns.cloudflare.com</code>). At your registrar (where you bought the domain), change the domain's nameservers to those two. Wait a few minutes to 48 hours for DNS to update. When Cloudflare shows your site as Active, you're ready.</p>
                        </div>
                      </div>
                      <p className="text-xl text-gray-600 dark:text-gray-400">Run these in order, in your SSH session on the Pi. Copy each command, paste into the terminal, press Enter.</p>
                      <div className="space-y-2">
                        <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">1. Log in to Cloudflare (paste in terminal)</p>
                        <div className="flex flex-wrap gap-2 items-center">
                          <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">cloudflared tunnel login</code>
                          <CopyToClipboard className="text-lg px-4 py-2" text="cloudflared tunnel login" label="Copy" />
                        </div>
                        <p className="text-xl text-gray-500">Cloudflared prints a URL. Open that URL on your phone or computer, log in to Cloudflare, and select your domain. Then return to the Pi terminal — the login completes automatically.</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">2. Create the tunnel (paste in terminal)</p>
                        <div className="flex flex-wrap gap-2 items-center">
                          <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">cloudflared tunnel create joule-bridge</code>
                          <CopyToClipboard className="text-lg px-4 py-2" text="cloudflared tunnel create joule-bridge" label="Copy" />
                        </div>
                        <p className="text-xl text-gray-500">Creates credentials in <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">~/.cloudflared/</code>. Note the tunnel UUID shown in the output.</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">3. Create config file (use nano, not paste in terminal)</p>
                        <p className="text-xl text-gray-600 dark:text-gray-400">Run <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">nano ~/.cloudflared/config.yml</code> to edit. Paste this (replace YOUR_USER and TUNNEL_UUID — run <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">cloudflared tunnel list</code> to see the UUID):</p>
                        <pre className="text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono overflow-x-auto">
{`url: http://localhost:8080
tunnel: joule-bridge
credentials-file: /home/YOUR_USER/.cloudflared/TUNNEL_UUID.json`}
                        </pre>
                        <CopyToClipboard className="text-lg px-4 py-2"
                          text={`url: http://localhost:8080
tunnel: joule-bridge
credentials-file: /home/YOUR_USER/.cloudflared/TUNNEL_UUID.json`}
                          label="Copy block"
                        />
                        <p className="text-xl text-gray-500">Save and exit nano: Ctrl+O, Enter, Ctrl+X.</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">4. Route DNS (paste in terminal; replace yourdomain.com)</p>
                        <div className="flex flex-wrap gap-2 items-center">
                          <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">cloudflared tunnel route dns joule-bridge bridge.yourdomain.com</code>
                          <CopyToClipboard className="text-lg px-4 py-2" text="cloudflared tunnel route dns joule-bridge bridge.yourdomain.com" label="Copy" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">5. Start the tunnel (paste in terminal)</p>
                        <div className="flex flex-wrap gap-2 items-center">
                          <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">cloudflared tunnel run joule-bridge</code>
                          <CopyToClipboard className="text-lg px-4 py-2" text="cloudflared tunnel run joule-bridge" label="Copy" />
                        </div>
                        <p className="text-xl text-gray-500">Your bridge URL is <strong>https://bridge.yourdomain.com</strong> — enter it in Settings → Joule Bridge URL. To run as a service (always on), see <a href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/local-management/as-a-service/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Cloudflare docs</a>.</p>
                      </div>
                    </div>
                  </details>
                  <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 mt-4">
                    <p className="text-xl text-emerald-800 dark:text-emerald-200 font-semibold">QR code</p>
                    <p className="text-xl text-emerald-700 dark:text-emerald-300 mt-1">Paste your Cloudflare tunnel URL below. Create a QR code from it for off-network users.</p>
                    <input
                      type="url"
                      value={cloudflareTunnelUrl}
                      onChange={(e) => setCloudflareTunnelUrl(e.target.value)}
                      placeholder="https://something.trycloudflare.com"
                      className="w-full px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-lg font-mono mt-2"
                    />
                    {cloudflareTunnelUrl.trim() && (
                      <div className="flex flex-wrap gap-2 items-center mt-2">
                        <code className="flex-1 min-w-0 text-lg bg-emerald-100 dark:bg-emerald-900/50 px-3 py-2 rounded-lg font-mono overflow-x-auto break-all">{cloudflareTunnelUrl}</code>
                        <CopyToClipboard className="text-lg px-4 py-2" text={cloudflareTunnelUrl} label="Copy" />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {step.id === "tailscale" && (
              <>
                <div className="space-y-4 pt-4">
                  <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-xl font-semibold text-amber-800 dark:text-amber-200">SSH into your Pi first</p>
                    <p className="text-xl text-amber-700 dark:text-amber-300 mt-1">The Pi has no keyboard. Run <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">ssh pi@YOUR_PI_IP</code> from your computer, then paste the commands below.</p>
                  </div>
                  <p className="text-xl text-gray-600 dark:text-gray-400">
                    Tailscale is a zero-config VPN. No port forwarding. Each device installs Tailscale and gets a private IP (100.x.x.x). Best for personal/family use.
                  </p>
                  <div className="space-y-2">
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">On the Pi (paste in terminal)</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono overflow-x-auto">
                        curl -fsSL https://tailscale.com/install.sh | sh
                      </code>
                      <CopyToClipboard className="text-lg px-4 py-2" text="curl -fsSL https://tailscale.com/install.sh | sh" label="Copy" />
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">sudo tailscale up</code>
                      <CopyToClipboard className="text-lg px-4 py-2" text="sudo tailscale up" label="Copy" />
                    </div>
                    <p className="text-xl text-gray-500">Visit the URL shown to log in. Then get the Pi's Tailscale IP:</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <code className="flex-1 min-w-0 text-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono">tailscale ip -4</code>
                      <CopyToClipboard className="text-lg px-4 py-2" text="tailscale ip -4" label="Copy" />
                    </div>
                    <p className="text-xl text-gray-500">Use <strong>http://100.x.x.x:{BRIDGE_PORT}</strong> as the bridge URL. On your phone, install the Tailscale app and log in with the same account — then the bridge is reachable at that IP from anywhere.</p>
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
          { label: "Bridge Remote Access Wizard" },
        ]}
      />
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Server size={24} className="text-blue-600 dark:text-blue-400" />
          </div>
          Bridge Remote Access Wizard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2 text-2xl">
          Make your Pi Zero bridge accessible from outside your network. Use Joule from anywhere — DuckDNS, Cloudflare Tunnel, or Tailscale.
        </p>
      </div>
      <div className="mb-6 p-4 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-3">Your DuckDNS settings</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xl font-medium text-gray-600 dark:text-gray-400 mb-1">Domain (e.g. joulebridge)</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value.replace(/[^a-z0-9-]/g, ""))}
              placeholder="joulebridge"
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
      </div>
      <div className="space-y-3">
        {STEPS.map((s) => renderStep(s))}
      </div>
    </div>
  );
}
