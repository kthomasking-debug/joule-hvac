#!/usr/bin/expect -f
# set-blueair-creds.sh
# Automates setting Blueair credentials on remote bridge

set timeout 30
set bridge_host "tom-pc@192.168.0.106"
set bridge_password "!Tk1234!"
set username "bunnyrita@gmail.com"
set password "12345678"

puts "=========================================="
puts "Setting Blueair Credentials on Remote Bridge"
puts "=========================================="
puts "Host: $bridge_host"
puts "Username: $username"
puts ""

spawn ssh -o StrictHostKeyChecking=no $bridge_host

expect {
    "password:" {
        send "$bridge_password\r"
        exp_continue
    }
    "$ " {
        # Connected
    }
    "# " {
        # Connected as root
    }
    timeout {
        puts "Connection timeout"
        exit 1
    }
}

# Create a script to run on remote
send "cat > /tmp/set_blueair.sh << 'EOFSCRIPT'\r"
send "#!/bin/bash\r"
send "SERVICE_FILE=\"/etc/systemd/system/prostat-bridge.service\"\r"
send "USERNAME=\"$username\"\r"
send "PASSWORD=\"$password\"\r"
send "\r"
send "if [ ! -f \"\\\$SERVICE_FILE\" ]; then\r"
send "    echo \"Error: Service file not found\"\r"
send "    exit 1\r"
send "fi\r"
send "\r"
send "# Backup\r"
send "sudo cp \"\\\$SERVICE_FILE\" \"\\\${SERVICE_FILE}.backup.\\\$(date +%Y%m%d_%H%M%S)\"\r"
send "echo \"✓ Backup created\"\r"
send "\r"
send "# Remove old Blueair credentials if they exist\r"
send "if grep -q \"BLUEAIR_USERNAME\" \"\\\$SERVICE_FILE\"; then\r"
send "    echo \"Removing old credentials...\"\r"
send "    sudo sed -i '/BLUEAIR_USERNAME=/d' \"\\\$SERVICE_FILE\"\r"
send "    sudo sed -i '/BLUEAIR_PASSWORD=/d' \"\\\$SERVICE_FILE\"\r"
send "fi\r"
send "\r"
send "# Add new credentials after [Service]\r"
send "echo \"Adding new credentials...\"\r"
send "sudo sed -i '/\\[Service\\]/a Environment=\"BLUEAIR_USERNAME='\"\\\$USERNAME\"'\"' \"\\\$SERVICE_FILE\"\r"
send "sudo sed -i '/\\[Service\\]/a Environment=\"BLUEAIR_PASSWORD='\"\\\$PASSWORD\"'\"' \"\\\$SERVICE_FILE\"\r"
send "echo \"✓ Credentials added\"\r"
send "\r"
send "# Reload and restart\r"
send "sudo systemctl daemon-reload\r"
send "echo \"✓ Daemon reloaded\"\r"
send "\r"
send "sudo systemctl restart prostat-bridge\r"
send "echo \"✓ Service restarted\"\r"
send "\r"
send "sleep 3\r"
send "echo \"\"\r"
send "echo \"Testing Blueair connection...\"\r"
send "curl -s http://localhost:8080/api/blueair/status | python3 -m json.tool 2>/dev/null || curl -s http://localhost:8080/api/blueair/status\r"
send "EOFSCRIPT\r"
send "chmod +x /tmp/set_blueair.sh\r"
send "bash /tmp/set_blueair.sh\r"

expect {
    "password:" {
        send "$bridge_password\r"
        exp_continue
    }
    "$ " {
        # Done
    }
    "# " {
        # Done
    }
    timeout {
        puts "Script execution timeout"
    }
}

send "exit\r"
expect eof

puts ""
puts "=========================================="
puts "Configuration complete!"
puts "=========================================="
puts ""
puts "Check status:"
puts "  curl http://192.168.0.106:8080/api/blueair/status"
puts ""
puts "Check logs:"
puts "  ssh $bridge_host 'sudo journalctl -u prostat-bridge -f | grep -i blueair'"


