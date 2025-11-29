/**
 * Web Serial API relay control for Android tablets and modern browsers
 * Works directly in the browser - no server needed!
 *
 * Browser Support:
 * - Chrome/Edge 89+ (Android 7.0+)
 * - Requires user permission to access serial port
 *
 * Usage:
 *   const relay = getWebSerialRelay();
 *   await relay.connect();
 *   await relay.toggleRelay(0, true);  // Turn on relay 0
 *   await relay.toggleRelay(0, false); // Turn off relay 0
 */

import React from "react";

export class WebSerialRelay {
  constructor() {
    this.port = null;
    this.writer = null;
    this.reader = null;
    this.connected = false;
  }

  /**
   * Check if Web Serial API is supported
   */
  static isSupported() {
    return "serial" in navigator;
  }

  /**
   * Connect to USB relay via Web Serial API
   * Will prompt user to select the serial port
   */
  async connect() {
    if (!WebSerialRelay.isSupported()) {
      throw new Error(
        "Web Serial API not supported in this browser. Use Chrome or Edge."
      );
    }

    try {
      // Request access to serial port (user will see a device picker)
      this.port = await navigator.serial.requestPort();

      // Open with baud rate 9600 (standard for USB relays)
      await this.port.open({ baudRate: 9600 });

      // Get writer for sending commands
      this.writer = this.port.writable.getWriter();

      // Optional: Set up reader for responses
      if (this.port.readable) {
        this.reader = this.port.readable.getReader();
        // Start reading responses in background (optional)
        this._readLoop();
      }

      this.connected = true;
      console.log("USB relay connected via Web Serial API");
      return true;
    } catch (error) {
      console.error("Failed to connect to USB relay:", error);
      this.connected = false;
      throw error;
    }
  }

  /**
   * Disconnect from USB relay
   */
  async disconnect() {
    try {
      if (this.reader) {
        await this.reader.cancel();
        await this.reader.releaseLock();
        this.reader = null;
      }
      if (this.writer) {
        await this.writer.close();
        this.writer = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
      this.connected = false;
      console.log("USB relay disconnected");
    } catch (error) {
      console.error("Error disconnecting:", error);
      this.connected = false;
    }
  }

  /**
   * Toggle a relay on or off
   * @param {number} index - Relay index (0, 1, 2, etc.)
   * @param {boolean} on - true to turn on, false to turn off
   * @param {string} commandFormat - Command format: 'arduino', 'at', or 'usbrelay'
   */
  async toggleRelay(index, on, commandFormat = "arduino") {
    if (!this.writer) {
      throw new Error("Not connected to USB relay. Call connect() first.");
    }

    let command;
    const encoder = new TextEncoder();

    // Determine command format based on relay module type
    if (commandFormat === "at") {
      // AT command format (for CH340 8CH relay modules)
      // Relay indices are 1-based in AT commands: AT+ON1, AT+OFF1, etc.
      const relayNum = index + 1; // Convert 0-based to 1-based
      command = `AT+${on ? "ON" : "OFF"}${relayNum}\r\n`;
    } else if (commandFormat === "usbrelay") {
      // Simple USB relay format: ON0, OFF0, etc.
      command = `${on ? "ON" : "OFF"}${index}\r`;
    } else {
      // Default Arduino-style format: RELAY 0 ON\n
      command = `RELAY ${index} ${on ? "ON" : "OFF"}\n`;
    }

    try {
      await this.writer.write(encoder.encode(command));
      console.log(
        `Relay ${index} ${on ? "ON" : "OFF"} (format: ${commandFormat})`
      );
      return { ok: true, index, on, format: commandFormat };
    } catch (error) {
      console.error("Failed to toggle relay:", error);
      throw error;
    }
  }

  /**
   * Toggle relay by terminal name (W, Y, G)
   * @param {string} terminal - 'W', 'Y', or 'G'
   * @param {boolean} on - true to turn on, false to turn off
   * @param {string} commandFormat - Command format: 'arduino', 'at', or 'usbrelay'
   */
  async toggleTerminal(terminal, on, commandFormat = "arduino") {
    const indexMap = { W: 0, Y: 1, G: 2 };
    const index = indexMap[terminal.toUpperCase()];

    if (index === undefined) {
      throw new Error(`Invalid terminal: ${terminal}. Use W, Y, or G.`);
    }

    return this.toggleRelay(index, on, commandFormat);
  }

  /**
   * Check if currently connected
   */
  isConnected() {
    return this.connected && this.port !== null && this.writer !== null;
  }

  /**
   * Background read loop for relay responses (optional)
   * Reads any responses from the relay module
   */
  async _readLoop() {
    if (!this.reader) return;

    const decoder = new TextDecoder();

    try {
      while (this.connected && this.reader) {
        const { value, done } = await this.reader.read();
        if (done) break;

        const text = decoder.decode(value);
        // Log relay responses (e.g., "OK RELAY 0 ON")
        if (text.trim()) {
          console.log("Relay response:", text.trim());
        }
      }
    } catch (error) {
      // Reader was cancelled or port closed
      if (this.connected) {
        console.error("Read loop error:", error);
      }
    }
  }

  /**
   * Get list of available serial ports (if supported)
   * Note: Web Serial API doesn't support listing ports without user interaction
   * This is a placeholder for future API improvements
   */
  static async getAvailablePorts() {
    // Web Serial API requires user interaction to select port
    // Cannot enumerate ports without permission
    return [];
  }
}

// Singleton instance
let relayInstance = null;

/**
 * Get the singleton WebSerialRelay instance
 */
export function getWebSerialRelay() {
  if (!relayInstance) {
    relayInstance = new WebSerialRelay();
  }
  return relayInstance;
}

/**
 * React hook for Web Serial Relay
 * Usage in components:
 *   const { relay, connected, connect, disconnect, toggleRelay } = useWebSerialRelay();
 */
export function useWebSerialRelay() {
  const [connected, setConnected] = React.useState(false);
  const [error, setError] = React.useState(null);
  const relayRef = React.useRef(getWebSerialRelay());

  const connect = React.useCallback(async () => {
    try {
      setError(null);
      await relayRef.current.connect();
      setConnected(true);
    } catch (err) {
      setError(err.message);
      setConnected(false);
      throw err;
    }
  }, []);

  const disconnect = React.useCallback(async () => {
    try {
      await relayRef.current.disconnect();
      setConnected(false);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const toggleRelay = React.useCallback(
    async (index, on, commandFormat = "arduino") => {
      if (!connected) {
        throw new Error("Not connected to relay");
      }
      return await relayRef.current.toggleRelay(index, on, commandFormat);
    },
    [connected]
  );

  const toggleTerminal = React.useCallback(
    async (terminal, on, commandFormat = "arduino") => {
      if (!connected) {
        throw new Error("Not connected to relay");
      }
      return await relayRef.current.toggleTerminal(terminal, on, commandFormat);
    },
    [connected]
  );

  React.useEffect(() => {
    // Check connection status on mount
    setConnected(relayRef.current.isConnected());

    // Cleanup on unmount
    return () => {
      const relay = relayRef.current;
      if (relay && relay.isConnected()) {
        relay.disconnect().catch(console.error);
      }
    };
  }, []);

  return {
    relay: relayRef.current,
    connected,
    error,
    isSupported: WebSerialRelay.isSupported(),
    connect,
    disconnect,
    toggleRelay,
    toggleTerminal,
  };
}

// Note: The useWebSerialRelay hook requires React (imported at top of file)
// If used outside React, use the WebSerialRelay class directly:
//   const relay = getWebSerialRelay();
//   await relay.connect();
//   await relay.toggleRelay(0, true);
