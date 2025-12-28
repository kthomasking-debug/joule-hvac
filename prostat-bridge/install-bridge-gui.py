#!/usr/bin/env python3
"""
GUI Installer for Joule Bridge
Double-click this file or run: python3 install-bridge-gui.py
"""

import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox, filedialog
import subprocess
import os
import sys
import threading
from pathlib import Path

class BridgeInstallerGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Joule Bridge Installer")
        self.root.geometry("700x600")
        
        # Variables
        self.usb_path = tk.StringVar(value="/media/thomas/writable")
        self.static_ip = tk.StringVar(value="192.168.0.106")
        self.install_thread = None
        
        self.create_widgets()
        
    def create_widgets(self):
        # Title
        title = tk.Label(self.root, text="Joule Bridge Installer", 
                        font=("Arial", 16, "bold"))
        title.pack(pady=10)
        
        # USB Path Selection
        usb_frame = ttk.LabelFrame(self.root, text="USB Drive Location", padding=10)
        usb_frame.pack(fill=tk.X, padx=20, pady=10)
        
        ttk.Label(usb_frame, text="USB Path:").pack(anchor=tk.W)
        usb_entry = ttk.Entry(usb_frame, textvariable=self.usb_path, width=50)
        usb_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)
        
        def browse_usb():
            path = filedialog.askdirectory(title="Select USB Drive Location")
            if path:
                self.usb_path.set(path)
        
        ttk.Button(usb_frame, text="Browse...", command=browse_usb).pack(side=tk.LEFT, padx=5)
        
        def auto_find_usb():
            try:
                result = subprocess.run(
                    ["find", "/media", "-name", "writable", "-type", "d"],
                    capture_output=True, text=True, timeout=5
                )
                if result.returncode == 0 and result.stdout.strip():
                    found = result.stdout.strip().split('\n')[0]
                    self.usb_path.set(found)
                    messagebox.showinfo("Found USB", f"Found USB at: {found}")
                else:
                    messagebox.showinfo("Not Found", "Could not auto-detect USB. Please browse manually.")
            except Exception as e:
                messagebox.showerror("Error", f"Error finding USB: {e}")
        
        ttk.Button(usb_frame, text="Auto-Find", command=auto_find_usb).pack(side=tk.LEFT, padx=5)
        
        # Static IP (Optional)
        ip_frame = ttk.LabelFrame(self.root, text="Network Configuration (Optional)", padding=10)
        ip_frame.pack(fill=tk.X, padx=20, pady=10)
        
        ttk.Label(ip_frame, text="Static IP Address:").pack(anchor=tk.W)
        ttk.Entry(ip_frame, textvariable=self.static_ip, width=20).pack(anchor=tk.W, pady=5)
        ttk.Label(ip_frame, text="Leave blank to use DHCP", font=("Arial", 8)).pack(anchor=tk.W)
        
        # Install Button
        button_frame = tk.Frame(self.root)
        button_frame.pack(pady=20)
        
        self.install_button = ttk.Button(button_frame, text="Install Bridge", 
                                         command=self.start_installation,
                                         style="Accent.TButton")
        self.install_button.pack(padx=10)
        
        # Progress/Output Area
        output_frame = ttk.LabelFrame(self.root, text="Installation Progress", padding=10)
        output_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)
        
        self.output_text = scrolledtext.ScrolledText(output_frame, height=15, 
                                                     wrap=tk.WORD, state=tk.DISABLED)
        self.output_text.pack(fill=tk.BOTH, expand=True)
        
        # Status Bar
        self.status_label = tk.Label(self.root, text="Ready to install", 
                                     relief=tk.SUNKEN, anchor=tk.W)
        self.status_label.pack(fill=tk.X, side=tk.BOTTOM)
        
    def log(self, message):
        """Add message to output area"""
        self.output_text.config(state=tk.NORMAL)
        self.output_text.insert(tk.END, message + "\n")
        self.output_text.see(tk.END)
        self.output_text.config(state=tk.DISABLED)
        self.root.update()
        
    def update_status(self, message):
        """Update status bar"""
        self.status_label.config(text=message)
        self.root.update()
        
    def start_installation(self):
        """Start installation in background thread"""
        if self.install_thread and self.install_thread.is_alive():
            messagebox.showwarning("Installation Running", "Installation is already in progress!")
            return
            
        self.install_button.config(state=tk.DISABLED)
        self.output_text.config(state=tk.NORMAL)
        self.output_text.delete(1.0, tk.END)
        self.output_text.config(state=tk.DISABLED)
        
        self.install_thread = threading.Thread(target=self.install_bridge, daemon=True)
        self.install_thread.start()
        
    def install_bridge(self):
        """Run installation process"""
        try:
            self.log("=" * 60)
            self.log("Joule Bridge Installation Starting...")
            self.log("=" * 60)
            self.update_status("Installing...")
            
            # Step 1: Verify USB path
            usb_path = self.usb_path.get().strip()
            bridge_source = os.path.join(usb_path, "prostat-bridge")
            
            self.log(f"\nStep 1: Checking USB drive at: {usb_path}")
            if not os.path.exists(bridge_source):
                raise FileNotFoundError(f"Bridge files not found at: {bridge_source}")
            
            if not os.path.exists(os.path.join(bridge_source, "server.py")):
                raise FileNotFoundError(f"server.py not found in {bridge_source}")
            
            self.log("✅ USB drive found")
            
            # Step 2: Copy files
            self.log(f"\nStep 2: Copying files to home directory...")
            home_bridge = os.path.expanduser("~/prostat-bridge")
            
            if os.path.exists(home_bridge):
                self.log("⚠️  Existing installation found. Backing up...")
                subprocess.run(["mv", home_bridge, home_bridge + ".backup"], check=True)
            
            subprocess.run(["cp", "-r", bridge_source, home_bridge], check=True)
            self.log(f"✅ Files copied to: {home_bridge}")
            
            # Step 3: Verify files
            self.log(f"\nStep 3: Verifying files...")
            required_files = ["server.py", "requirements.txt", "pre-configure-bridge.sh"]
            for file in required_files:
                file_path = os.path.join(home_bridge, file)
                if not os.path.exists(file_path):
                    raise FileNotFoundError(f"Required file missing: {file}")
                self.log(f"  ✓ {file}")
            
            # Step 4: Make script executable
            self.log(f"\nStep 4: Setting permissions...")
            script_path = os.path.join(home_bridge, "pre-configure-bridge.sh")
            os.chmod(script_path, 0o755)
            self.log("✅ Script is executable")
            
            # Step 5: Run installation script
            self.log(f"\nStep 5: Running installation script...")
            self.log("This may take a few minutes...")
            
            static_ip = self.static_ip.get().strip()
            cmd = [script_path]
            if static_ip:
                cmd.extend(["--static-ip", static_ip])
            
            process = subprocess.Popen(
                cmd,
                cwd=home_bridge,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )
            
            # Stream output
            for line in process.stdout:
                self.log(line.rstrip())
                self.root.update()
            
            process.wait()
            
            if process.returncode != 0:
                raise subprocess.CalledProcessError(process.returncode, cmd)
            
            # Step 6: Verify installation
            self.log(f"\nStep 6: Verifying installation...")
            result = subprocess.run(
                ["sudo", "systemctl", "status", "prostat-bridge", "--no-pager"],
                capture_output=True, text=True, timeout=10
            )
            self.log(result.stdout)
            
            # Step 7: Test API
            self.log(f"\nStep 7: Testing bridge API...")
            import time
            time.sleep(2)
            result = subprocess.run(
                ["curl", "-s", "http://localhost:8080/api/paired"],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                self.log("✅ Bridge API is responding!")
            else:
                self.log("⚠️  Bridge may still be starting...")
            
            self.log("\n" + "=" * 60)
            self.log("✅ Installation Complete!")
            self.log("=" * 60)
            self.log(f"\nBridge is running at: http://192.168.0.106:8080")
            self.log("\nNext steps:")
            self.log("1. Go to your web app → Settings → Joule Bridge Settings")
            self.log("2. Enter: http://192.168.0.106:8080")
            self.log("3. Click Save, then Refresh")
            
            self.update_status("Installation complete!")
            self.install_button.config(state=tk.NORMAL)
            
            messagebox.showinfo("Installation Complete", 
                              "Bridge has been installed successfully!\n\n"
                              "Bridge is running at: http://192.168.0.106:8080")
            
        except Exception as e:
            self.log(f"\n❌ Error: {str(e)}")
            self.update_status("Installation failed!")
            self.install_button.config(state=tk.NORMAL)
            messagebox.showerror("Installation Failed", 
                               f"Installation failed with error:\n\n{str(e)}")

def main():
    # Check if running as root
    if os.geteuid() == 0:
        root = tk.Tk()
        msg = tk.Message(root, text="Don't run as root. Run as regular user (will use sudo when needed).", 
                        width=400)
        msg.pack(padx=20, pady=20)
        root.mainloop()
        sys.exit(1)
    
    root = tk.Tk()
    app = BridgeInstallerGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()




