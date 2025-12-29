#!/usr/bin/env python3
"""
Tailscale Key Expiry Tracker
Tracks customer devices and sends email alerts before keys expire.

Usage:
    # Add a new device
    python3 tailscale-key-tracker.py add --customer "John Doe" --email "john@example.com" --date "2025-12-28"
    
    # Check upcoming expiries
    python3 tailscale-key-tracker.py check
    
    # Send email alerts (runs automatically, or manually)
    python3 tailscale-key-tracker.py alert
    
    # Generate calendar file
    python3 tailscale-key-tracker.py calendar
    
    # List all devices
    python3 tailscale-key-tracker.py list
"""

import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
import argparse
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
try:
    from icalendar import Calendar, Event
    HAS_ICALENDAR = True
except ImportError:
    try:
        import ics
        from ics import Calendar, Event
        HAS_ICALENDAR = True
        USE_ICS_LIB = True
    except ImportError:
        HAS_ICALENDAR = False
        USE_ICS_LIB = False

# Configuration
DATA_FILE = Path.home() / ".joule-devices.json"
KEY_EXPIRY_MONTHS = 6
ALERT_DAYS_BEFORE = 30  # Alert 30 days before expiry
SUPPORT_EMAIL = "kthomasking@gmail.com"

# Email configuration (update with your SMTP settings)
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USER = "kthomasking@gmail.com"  # Update with your email
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")  # Set as environment variable for security


def load_devices():
    """Load device database from JSON file"""
    if DATA_FILE.exists():
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    return []


def save_devices(devices):
    """Save device database to JSON file"""
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(DATA_FILE, 'w') as f:
        json.dump(devices, f, indent=2)


def add_device(customer_name, customer_email, setup_date, tailscale_ip=None, notes=None):
    """Add a new device to the tracker"""
    devices = load_devices()
    
    setup_dt = datetime.strptime(setup_date, "%Y-%m-%d")
    expiry_dt = setup_dt + timedelta(days=KEY_EXPIRY_MONTHS * 30)  # Approximate 6 months
    
    device = {
        "id": len(devices) + 1,
        "customer_name": customer_name,
        "customer_email": customer_email,
        "setup_date": setup_date,
        "expiry_date": expiry_dt.strftime("%Y-%m-%d"),
        "tailscale_ip": tailscale_ip,
        "notes": notes or "",
        "alerted": False,
        "created": datetime.now().isoformat()
    }
    
    devices.append(device)
    save_devices(devices)
    
    print(f"✅ Added device for {customer_name}")
    print(f"   Setup: {setup_date}")
    print(f"   Expiry: {expiry_dt.strftime('%Y-%m-%d')}")
    print(f"   Alert date: {(expiry_dt - timedelta(days=ALERT_DAYS_BEFORE)).strftime('%Y-%m-%d')}")
    
    return device


def check_expiries():
    """Check for upcoming key expiries"""
    devices = load_devices()
    today = datetime.now().date()
    
    upcoming = []
    expired = []
    
    for device in devices:
        expiry_date = datetime.strptime(device['expiry_date'], "%Y-%m-%d").date()
        days_until = (expiry_date - today).days
        
        if days_until < 0:
            expired.append((device, days_until))
        elif days_until <= ALERT_DAYS_BEFORE:
            upcoming.append((device, days_until))
    
    return upcoming, expired


def send_email_alert(device, days_until):
    """Send email alert about upcoming key expiry"""
    if not SMTP_PASSWORD:
        print("⚠️  SMTP_PASSWORD not set. Skipping email alert.")
        print("   Set it with: export SMTP_PASSWORD='your-app-password'")
        return False
    
    expiry_date = datetime.strptime(device['expiry_date'], "%Y-%m-%d")
    alert_date = expiry_date - timedelta(days=ALERT_DAYS_BEFORE)
    
    subject = f"⚠️ Tailscale Key Expiring Soon: {device['customer_name']} ({abs(days_until)} days)"
    
    body = f"""
Tailscale Key Expiry Alert

Customer: {device['customer_name']}
Email: {device['customer_email']}
Setup Date: {device['setup_date']}
Expiry Date: {device['expiry_date']}
Days Until Expiry: {abs(days_until)} days

Tailscale IP: {device.get('tailscale_ip', 'Not provided')}

Action Required:
1. Contact customer to re-authenticate Tailscale
2. Guide them through: sudo tailscale up
3. Verify new IP if changed
4. Update device record if needed

See Admin Manual section "Tailscale Key Expiry Handling" for detailed instructions.

Notes: {device.get('notes', 'None')}
"""
    
    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_USER
        msg['To'] = SUPPORT_EMAIL
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        print(f"✅ Email alert sent for {device['customer_name']}")
        return True
    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        return False


def send_alerts():
    """Check and send email alerts for upcoming expiries"""
    upcoming, expired = check_expiries()
    devices = load_devices()
    updated = False
    
    # Send alerts for upcoming expiries
    for device, days_until in upcoming:
        device_id = device['id']
        device_obj = next((d for d in devices if d['id'] == device_id), None)
        
        if device_obj and not device_obj.get('alerted', False):
            if send_email_alert(device, days_until):
                device_obj['alerted'] = True
                device_obj['last_alert'] = datetime.now().isoformat()
                updated = True
    
    # Send alerts for expired keys
    for device, days_until in expired:
        device_id = device['id']
        device_obj = next((d for d in devices if d['id'] == device_id), None)
        
        if device_obj:
            # Reset alerted flag if it's been more than 7 days since last alert
            last_alert = device_obj.get('last_alert')
            if last_alert:
                last_alert_dt = datetime.fromisoformat(last_alert)
                if (datetime.now() - last_alert_dt).days > 7:
                    device_obj['alerted'] = False
            
            if not device_obj.get('alerted', False):
                if send_email_alert(device, days_until):
                    device_obj['alerted'] = True
                    device_obj['last_alert'] = datetime.now().isoformat()
                    updated = True
    
    if updated:
        save_devices(devices)
    
    return len(upcoming) + len(expired)


def generate_calendar():
    """Generate iCal calendar file with all expiry dates"""
    devices = load_devices()
    calendar = Calendar()
    
    for device in devices:
        expiry_date = datetime.strptime(device['expiry_date'], "%Y-%m-%d")
        alert_date = expiry_date - timedelta(days=ALERT_DAYS_BEFORE)
        
        # Alert event (30 days before)
        alert_event = Event()
        alert_event.name = f"⚠️ Tailscale Key Expiry Alert: {device['customer_name']}"
        alert_event.begin = alert_date
        alert_event.description = f"""
Customer: {device['customer_name']}
Email: {device['customer_email']}
Tailscale IP: {device.get('tailscale_ip', 'Not provided')}
Expiry Date: {device['expiry_date']}

Action: Contact customer to re-authenticate Tailscale key.
See Admin Manual for instructions.
"""
        alert_event.make_all_day()
        calendar.events.add(alert_event)
        
        # Expiry event
        expiry_event = Event()
        expiry_event.name = f"🔴 Tailscale Key Expires: {device['customer_name']}"
        expiry_event.begin = expiry_date
        expiry_event.description = f"""
Customer: {device['customer_name']}
Email: {device['customer_email']}
Tailscale IP: {device.get('tailscale_ip', 'Not provided')}

Key expires today! Customer needs to re-authenticate immediately.
"""
        expiry_event.make_all_day()
        calendar.events.add(expiry_event)
    
    # Save calendar file
    calendar_file = Path.home() / "tailscale-key-expiry.ics"
    with open(calendar_file, 'w') as f:
        f.writelines(calendar)
    
    print(f"✅ Calendar generated: {calendar_file}")
    print(f"   Import this file into Google Calendar, Outlook, or Apple Calendar")
    print(f"   Total events: {len(devices) * 2} (alert + expiry for each device)")
    
    return calendar_file


def list_devices():
    """List all tracked devices"""
    devices = load_devices()
    today = datetime.now().date()
    
    if not devices:
        print("No devices tracked yet.")
        return
    
    print(f"\n📋 Tracked Devices ({len(devices)} total)\n")
    print(f"{'ID':<4} {'Customer':<20} {'Setup Date':<12} {'Expiry Date':<12} {'Days Left':<10} {'Status':<15}")
    print("-" * 85)
    
    for device in sorted(devices, key=lambda x: x['expiry_date']):
        expiry_date = datetime.strptime(device['expiry_date'], "%Y-%m-%d").date()
        days_until = (expiry_date - today).days
        
        if days_until < 0:
            status = "🔴 EXPIRED"
        elif days_until <= ALERT_DAYS_BEFORE:
            status = "⚠️ ALERT SOON"
        else:
            status = "✅ OK"
        
        print(f"{device['id']:<4} {device['customer_name']:<20} {device['setup_date']:<12} "
              f"{device['expiry_date']:<12} {days_until:>9} {status:<15}")
    
    # Summary
    upcoming, expired = check_expiries()
    print(f"\n📊 Summary:")
    print(f"   ✅ OK: {len(devices) - len(upcoming) - len(expired)}")
    print(f"   ⚠️  Alert Soon ({ALERT_DAYS_BEFORE} days): {len(upcoming)}")
    print(f"   🔴 Expired: {len(expired)}")


def main():
    parser = argparse.ArgumentParser(description="Track Tailscale key expiry for customer devices")
    subparsers = parser.add_subparsers(dest='command', help='Commands')
    
    # Add device
    add_parser = subparsers.add_parser('add', help='Add a new device')
    add_parser.add_argument('--customer', required=True, help='Customer name')
    add_parser.add_argument('--email', required=True, help='Customer email')
    add_parser.add_argument('--date', required=True, help='Setup date (YYYY-MM-DD)')
    add_parser.add_argument('--ip', help='Tailscale IP address')
    add_parser.add_argument('--notes', help='Additional notes')
    
    # Check expiries
    subparsers.add_parser('check', help='Check upcoming expiries')
    
    # Send alerts
    subparsers.add_parser('alert', help='Send email alerts for upcoming expiries')
    
    # Generate calendar
    subparsers.add_parser('calendar', help='Generate iCal calendar file')
    
    # List devices
    subparsers.add_parser('list', help='List all tracked devices')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    if args.command == 'add':
        add_device(args.customer, args.email, args.date, args.ip, args.notes)
    elif args.command == 'check':
        upcoming, expired = check_expiries()
        print(f"\n📅 Key Expiry Status\n")
        print(f"⚠️  Upcoming ({ALERT_DAYS_BEFORE} days): {len(upcoming)}")
        print(f"🔴 Expired: {len(expired)}\n")
        
        if upcoming:
            print("Upcoming expiries:")
            for device, days in upcoming:
                print(f"  - {device['customer_name']}: {abs(days)} days ({device['expiry_date']})")
        
        if expired:
            print("\nExpired keys:")
            for device, days in expired:
                print(f"  - {device['customer_name']}: {abs(days)} days overdue ({device['expiry_date']})")
    elif args.command == 'alert':
        count = send_alerts()
        print(f"\n📧 Sent {count} email alert(s)")
    elif args.command == 'calendar':
        generate_calendar()
    elif args.command == 'list':
        list_devices()


if __name__ == '__main__':
    main()

