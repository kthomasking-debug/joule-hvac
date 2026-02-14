/**
 * Remote Joule - Cloudflare tunnel URL for accessing Joule Bridge from outside your network.
 * Each person needs their own Cloudflare address for their own Pi.
 */
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, AlertCircle, Search, Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { getBridgeInfo } from "../lib/jouleBridgeApi";

/** Get Pi hostname/IP from connected bridge URL in localStorage */
function getPiAddressFromBridgeUrl() {
  try {
    const url = localStorage.getItem("jouleBridgeUrl") || "";
    if (!url) return null;
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (!host || host === "localhost" || host === "127.0.0.1") return null;
    if (host.includes("trycloudflare.com") || host.includes("ngrok") || host.includes("duckdns")) return null;
    return host;
  } catch {
    return null;
  }
}

/** Search for Joule Bridge on the local network (mDNS + common subnets). Excludes current page host. */
async function findPiIp() {
  const excludeHost = typeof window !== "undefined" ? window.location.hostname : null;

  // Try mDNS first
  try {
    const res = await fetch("http://joule-bridge.local:8080/api/bridge/info", {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const info = await res.json();
      const ip = info?.lan_ip || info?.local_ip;
      if (ip && typeof ip === "string") {
        const trimmed = ip.trim();
        if (excludeHost && trimmed === excludeHost) {
          /* skip - this is the current machine */
        } else if (!trimmed.startsWith("10.") && !trimmed.startsWith("100.")) {
          return trimmed;
        } else if (info?.local_ip && !info.local_ip.startsWith("10.") && !info.local_ip.startsWith("100.")) {
          const alt = info.local_ip.trim();
          if (!excludeHost || alt !== excludeHost) return alt;
        }
      }
    }
  } catch {
    /* mDNS failed, try scanning */
  }

  // Scan common subnets
  const subnets = ["192.168.0", "192.168.1", "10.0.0", "10.0.1"];
  const commonLastOctets = [103, 100, 101, 102, 104, 105, 110, 150, 200];
  for (const subnet of subnets) {
    for (const octet of commonLastOctets) {
      const ip = `${subnet}.${octet}`;
      if (excludeHost && ip === excludeHost) continue;
      try {
        const res = await fetch(`http://${ip}:8080/api/bridge/info`, {
          signal: AbortSignal.timeout(800),
          mode: "cors",
        });
        if (res.ok) {
          const info = await res.json();
          if (
            info?.device_name?.toLowerCase().includes("joule") ||
            info?.hostname?.toLowerCase().includes("joule") ||
            info?.lan_ip ||
            info?.local_ip
          ) {
            return ip;
          }
        }
      } catch {
        continue;
      }
    }
  }
  throw new Error("Pi not found on network");
}

function CopyButton({ text, feedbackKey, copyFeedback, setCopyFeedback }) {
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            setCopyFeedback(feedbackKey);
            setTimeout(() => setCopyFeedback(""), 2000);
          },
          () => {}
        );
      }}
      className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-400 dark:border-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"
      title={`Copy: ${text}`}
    >
      <Copy size={10} />
      {copyFeedback === feedbackKey ? "Copied!" : "Copy"}
    </button>
  );
}

export default function RemoteJouleSettings() {
  const [remoteUrl, setRemoteUrl] = useState(() => {
    try {
      return localStorage.getItem("jouleBridgeRemoteUrl") || "";
    } catch {
      return "";
    }
  });
  const [useRemote, setUseRemote] = useState(() => {
    try {
      return localStorage.getItem("useRemoteBridge") === "true";
    } catch {
      return false;
    }
  });
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [remoteAvailable, setRemoteAvailable] = useState(false);
  const [piIp, setPiIp] = useState(null);
  const [searchingPi, setSearchingPi] = useState(false);
  const [piSearchError, setPiSearchError] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [bridgeInfoIp, setBridgeInfoIp] = useState(null);
  const [appUrlForQr, setAppUrlForQr] = useState(() => {
    try {
      return localStorage.getItem("jouleAppUrlForQr") || "";
    } catch {
      return "";
    }
  });

  const bridgePiAddress = getPiAddressFromBridgeUrl();
  const displayPiAddress = bridgeInfoIp || bridgePiAddress || piIp;

  useEffect(() => {
    let cancelled = false;
    getBridgeInfo().then((info) => {
      if (cancelled || !info) return;
      const ip = info?.lan_ip || info?.local_ip;
      if (ip && typeof ip === "string") {
        const trimmed = ip.trim();
        if (!trimmed.startsWith("10.") && !trimmed.startsWith("100.")) {
          setBridgeInfoIp(trimmed);
        }
      }
    });
    return () => { cancelled = true; };
  }, []);

  const handleFindPiIp = async () => {
    setSearchingPi(true);
    setPiSearchError(null);
    setPiIp(null);
    try {
      const ip = await findPiIp();
      setPiIp(ip);
    } catch (err) {
      setPiSearchError(err?.message || "Pi not found");
    } finally {
      setSearchingPi(false);
    }
  };

  const copySshCommand = () => {
    const addr = displayPiAddress;
    if (!addr) return;
    const cmd = `ssh pi@${addr}`;
    navigator.clipboard?.writeText(cmd).then(
      () => {
        setCopyFeedback("ssh");
        setTimeout(() => setCopyFeedback(""), 2000);
      },
      () => setCopyFeedback("")
    );
  };

  const copyPairingUrl = () => {
    const addr = displayPiAddress;
    if (!addr) return;
    const url = `http://${addr}:8080`;
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopyFeedback("url");
        setTimeout(() => setCopyFeedback(""), 2000);
      },
      () => setCopyFeedback("")
    );
  };

  const checkRemoteHealth = async () => {
    const url = remoteUrl.trim();
    if (!url) {
      setRemoteAvailable(false);
      return;
    }
    setCheckingHealth(true);
    try {
      const normalized = url.replace(/\/$/, "");
      await fetch(`${normalized}/health`, { signal: AbortSignal.timeout(5000) });
      setRemoteAvailable(true);
    } catch {
      setRemoteAvailable(false);
    } finally {
      setCheckingHealth(false);
    }
  };

  useEffect(() => {
    if (remoteUrl.trim()) checkRemoteHealth();
    else setRemoteAvailable(false);
  }, [remoteUrl]);

  useEffect(() => {
    if (remoteUrl.trim()) persistRemoteUrlToBridge(remoteUrl);
  }, []);

  const persistRemoteUrlToBridge = (val) => {
    try {
      const useRemote = localStorage.getItem("useRemoteBridge") === "true";
      const remoteUrlStored = (localStorage.getItem("jouleBridgeRemoteUrl") || "").trim();
      const base = useRemote && remoteUrlStored
        ? remoteUrlStored
        : localStorage.getItem("jouleBridgeUrl") ||
          import.meta.env?.VITE_JOULE_BRIDGE_URL ||
          (typeof window !== "undefined" && window.location?.port === "8080" ? window.location.origin : null) ||
          "";
      if (base) {
        fetch(`${base.replace(/\/$/, "")}/api/settings/jouleBridgeRemoteUrl`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: val ?? "" }),
        }).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  };

  const handleRemoteUrlChange = (e) => {
    const val = e.target.value.trim();
    setRemoteUrl(val);
    try {
      localStorage.setItem("jouleBridgeRemoteUrl", val);
      persistRemoteUrlToBridge(val);
      window.dispatchEvent(new Event("storage"));
    } catch {
      /* ignore */
    }
  };

  const handleUseRemoteChange = (e) => {
    const checked = e.target.checked;
    setUseRemote(checked);
    try {
      localStorage.setItem("useRemoteBridge", checked ? "true" : "false");
      window.dispatchEvent(new Event("storage"));
    } catch {
      /* ignore */
    }
  };

  const handleAppUrlChange = (e) => {
    const val = e.target.value.trim();
    setAppUrlForQr(val);
    try {
      localStorage.setItem("jouleAppUrlForQr", val);
    } catch {
      /* ignore */
    }
  };

  // URL for QR: user-entered app URL, or current origin (e.g. Pi), or remote tunnel when enabled
  const qrUrl = appUrlForQr
    || (useRemote && remoteUrl.trim() ? remoteUrl.trim().replace(/\/$/, "") : null)
    || (typeof window !== "undefined" ? window.location.origin : "");

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Access your Joule Bridge (Pi) from outside your home network using a
        Cloudflare Tunnel.{" "}
        <strong>Each person needs their own Cloudflare address for their own
        Pi.</strong> Run <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded">cloudflared</code> on your Pi to get your URL.
      </p>

      {/* Pi IP discovery */}
      <div className="p-3 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
        <p className="font-semibold mb-2 text-sm text-gray-700 dark:text-gray-300">Your Pi&apos;s IP address</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Find your Pi on the local network to SSH in or configure the bridge URL.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleFindPiIp}
            disabled={searchingPi}
            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Search size={14} />
            {searchingPi ? "Searching…" : "Find Pi IP"}
          </button>
          {displayPiAddress && (
            <>
              <code className="px-3 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-mono">
                {displayPiAddress}
              </code>
              {(bridgeInfoIp || bridgePiAddress) && (
                <span className="text-xs text-slate-500">(from connected bridge)</span>
              )}
              <button
                type="button"
                onClick={copySshCommand}
                className="inline-flex items-center gap-1 px-3 py-2 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm rounded-lg transition-colors"
              >
                <Copy size={14} />
                {copyFeedback === "ssh" ? "Copied!" : "Copy SSH command"}
              </button>
              <button
                type="button"
                onClick={copyPairingUrl}
                className="inline-flex items-center gap-1 px-3 py-2 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm rounded-lg transition-colors"
              >
                <Copy size={14} />
                {copyFeedback === "url" ? "Copied!" : "Copy pairing URL"}
              </button>
            </>
          )}
          {piSearchError && (
            <span className="text-xs text-amber-600 dark:text-amber-400">{piSearchError}</span>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
          Cloudflare tunnel address
        </label>
        <input
          type="url"
          value={remoteUrl}
          onChange={handleRemoteUrlChange}
          placeholder="https://something-random.trycloudflare.com"
          className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono"
          aria-label="Cloudflare tunnel address for Joule Bridge"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Enter the address: a Cloudflare Tunnel URL (e.g.{" "}
          <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded">
            https://xyz.trycloudflare.com
          </code>
          ) or a custom domain if you use one. No trailing slash.
        </p>
      </div>

      {remoteUrl.trim() && (
        <div className="flex items-center gap-2">
          {checkingHealth ? (
            <span className="text-xs text-gray-500">Checking…</span>
          ) : remoteAvailable ? (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 size={14} />
              Remote bridge reachable
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle size={14} />
              Cannot reach remote bridge — check tunnel is running
            </span>
          )}
        </div>
      )}

      {/* App QR code - Cloudflare tunnel for dev app (access from any network) */}
      <div className="p-3 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
        <p className="font-semibold mb-2 text-sm text-gray-700 dark:text-gray-300">Scan to open app (from any network)</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Run a Cloudflare tunnel on your dev machine so you can open the app from your phone when away from home. On your dev machine:{" "}
          <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded">cloudflared tunnel --url http://localhost:5173</code>
          <button type="button" onClick={() => { navigator.clipboard?.writeText("cloudflared tunnel --url http://localhost:5173"); setCopyFeedback("app-tunnel"); setTimeout(() => setCopyFeedback(""), 2000); }} className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-400 dark:border-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300" title="Copy command">{copyFeedback === "app-tunnel" ? "Copied!" : <Copy size={10} />}</button>
          {" "}— then paste the tunnel URL below.
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
          Use the <strong>app</strong> tunnel (port 5173), not the Ollama tunnel (port 11434). If you see &quot;Ollama is running&quot; when scanning, you used the wrong URL.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="flex-shrink-0 p-2 bg-white dark:bg-slate-900 rounded-lg">
            <QRCodeSVG value={qrUrl} size={128} level="M" includeMargin />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <input
              type="url"
              value={appUrlForQr}
              onChange={handleAppUrlChange}
              placeholder="https://xyz.trycloudflare.com (app tunnel, port 5173)"
              className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono"
              aria-label="App Cloudflare tunnel URL for QR code"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {appUrlForQr ? "QR encodes your app tunnel. Scan from any network to open the app." : useRemote && remoteUrl ? "Using Pi tunnel URL." : "Enter the tunnel URL from cloudflared --url http://localhost:5173 (not the Ollama tunnel)."}
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={useRemote}
            onChange={handleUseRemoteChange}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Use remote access (Cloudflare URL)
          </span>
        </label>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 ml-6">
          When enabled, the app uses your Cloudflare address instead of the
          local network URL. Turn this on when you&apos;re away from home.
        </p>
      </div>

      <div className="p-3 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-gray-600 dark:text-gray-400">
        <p className="font-semibold mb-1">Plug-and-play remote access</p>
        <p className="mb-2">
          Run the tunnel script on your Pi once. The display QR code updates automatically — no manual entry needed.
        </p>
        <p className="mb-2">
          <strong>One-time setup:</strong> SSH into your Pi (e.g.{" "}
          <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded">ssh pi@192.168.0.103</code>
          <CopyButton text="ssh pi@192.168.0.103" feedbackKey="ssh-ip" copyFeedback={copyFeedback} setCopyFeedback={setCopyFeedback} />
          {" "}or{" "}
          <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded">ssh pi@joule-bridge.local</code>
          <CopyButton text="ssh pi@joule-bridge.local" feedbackKey="ssh-mdns" copyFeedback={copyFeedback} setCopyFeedback={setCopyFeedback} />
          ),{" "}
          <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded">cd /home/pi/git/joule-hvac/prostat-bridge</code>
          <CopyButton text="cd /home/pi/git/joule-hvac/prostat-bridge" feedbackKey="cd" copyFeedback={copyFeedback} setCopyFeedback={setCopyFeedback} />
          , then run{" "}
          <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded">./cloudflared-tunnel.sh</code>
          <CopyButton text="./cloudflared-tunnel.sh" feedbackKey="tunnel-script" copyFeedback={copyFeedback} setCopyFeedback={setCopyFeedback} />
          {" "}(or{" "}
          <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded">cloudflared tunnel --url http://localhost:8080</code>
          <CopyButton text="cloudflared tunnel --url http://localhost:8080" feedbackKey="tunnel-manual" copyFeedback={copyFeedback} setCopyFeedback={setCopyFeedback} />
          {" "}for manual run). The script captures the URL and the display QR updates within ~1 min. For auto-start at boot:{" "}
          <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded">sudo ./install-cloudflared-service.sh</code>
          <CopyButton text="sudo ./install-cloudflared-service.sh" feedbackKey="install-service" copyFeedback={copyFeedback} setCopyFeedback={setCopyFeedback} />
          .
        </p>
        <p>
          For a persistent setup with a custom domain, see{" "}
          <Link
            to="/tools/bridge-remote-access-wizard"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Bridge Remote Access
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
