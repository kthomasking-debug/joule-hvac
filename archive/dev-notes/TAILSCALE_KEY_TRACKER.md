# Tailscale Key Expiry Tracker

Automated system to track customer device sales and send email alerts before Tailscale keys expire.

## Quick Start

### 1. Setup

```bash
cd scripts
./setup-key-tracker.sh
```

This will:
- Install required Python packages
- Set up a daily cron job to check and send alerts
- Make the script executable

### 2. Configure Email (Optional but Recommended)

For email alerts, set up Gmail App Password:

1. Go to Google Account → Security → 2-Step Verification
2. Generate an "App Password" for "Mail"
3. Set environment variable:

```bash
export SMTP_PASSWORD='your-app-password-here'
```

Add to `~/.bashrc` or `~/.zshrc` to make permanent:
```bash
echo 'export SMTP_PASSWORD="your-app-password-here"' >> ~/.bashrc
```

### 3. Add Your First Device

When you sell a device, add it to the tracker:

```bash
python3 scripts/tailscale-key-tracker.py add \
  --customer "John Doe" \
  --email "john@example.com" \
  --date "2025-12-28" \
  --ip "100.102.98.23" \
  --notes "Mini PC at customer location"
```

### 4. Generate Calendar

Import all expiry dates into your calendar:

```bash
python3 scripts/tailscale-key-tracker.py calendar
```

This creates `~/tailscale-key-expiry.ics` - import this into:
- Google Calendar
- Apple Calendar
- Outlook
- Any calendar app that supports .ics files

**Re-run this command whenever you add new devices** to update your calendar.

## Usage

### Add a Device

```bash
python3 scripts/tailscale-key-tracker.py add \
  --customer "Customer Name" \
  --email "customer@email.com" \
  --date "YYYY-MM-DD" \
  --ip "100.x.x.x" \
  --notes "Optional notes"
```

**Example:**
```bash
python3 scripts/tailscale-key-tracker.py add \
  --customer "Jane Smith" \
  --email "jane@example.com" \
  --date "2025-12-29" \
  --ip "100.105.12.45"
```

### Check Status

See upcoming expiries:

```bash
python3 scripts/tailscale-key-tracker.py check
```

### List All Devices

```bash
python3 scripts/tailscale-key-tracker.py list
```

Shows:
- All tracked devices
- Setup dates
- Expiry dates
- Days until expiry
- Status (OK, Alert Soon, Expired)

### Send Alerts Manually

The cron job runs daily, but you can trigger manually:

```bash
python3 scripts/tailscale-key-tracker.py alert
```

### Update Calendar

After adding new devices, regenerate calendar:

```bash
python3 scripts/tailscale-key-tracker.py calendar
```

Then re-import the `.ics` file into your calendar app.

## How It Works

### Key Expiry Calculation

- **Default expiry:** 6 months from setup date
- **Alert date:** 30 days before expiry
- **Email alerts:** Sent automatically via cron job

### Data Storage

Device data is stored in: `~/.joule-devices.json`

Format:
```json
[
  {
    "id": 1,
    "customer_name": "John Doe",
    "customer_email": "john@example.com",
    "setup_date": "2025-12-28",
    "expiry_date": "2026-06-28",
    "tailscale_ip": "100.102.98.23",
    "notes": "",
    "alerted": false,
    "created": "2025-12-29T10:00:00"
  }
]
```

### Email Alerts

When a key is within 30 days of expiry:
- Email sent to: `kthomasking@gmail.com`
- Subject: `⚠️ Tailscale Key Expiring Soon: Customer Name (X days)`
- Includes: Customer info, expiry date, Tailscale IP, action steps

### Calendar Events

Two events per device:
1. **Alert Event** (30 days before expiry)
   - Reminder to contact customer
   - Includes re-authentication instructions

2. **Expiry Event** (on expiry date)
   - Key expires today
   - Urgent action required

## Automation

### Daily Cron Job

Automatically runs at 9 AM daily:
- Checks for upcoming expiries
- Sends email alerts
- Logs to: `~/.joule-key-tracker.log`

To modify the schedule, edit crontab:
```bash
crontab -e
```

### Manual Updates

After adding devices, regenerate calendar:
```bash
python3 scripts/tailscale-key-tracker.py calendar
```

Re-import the `.ics` file into your calendar.

## Troubleshooting

### Email Not Sending

1. Check SMTP_PASSWORD is set:
   ```bash
   echo $SMTP_PASSWORD
   ```

2. Verify Gmail App Password is correct
3. Check cron job logs:
   ```bash
   tail ~/.joule-key-tracker.log
   ```

### Calendar Not Updating

- Re-run `calendar` command after adding devices
- Re-import the `.ics` file into your calendar app
- Some calendar apps require manual refresh

### Missing Python Package

```bash
pip3 install ics --user
```

## Example Workflow

**When you sell a device:**

1. **Add to tracker:**
   ```bash
   python3 scripts/tailscale-key-tracker.py add \
     --customer "New Customer" \
     --email "customer@email.com" \
     --date "2025-12-29" \
     --ip "100.x.x.x"
   ```

2. **Update calendar:**
   ```bash
   python3 scripts/tailscale-key-tracker.py calendar
   ```
   Then import `~/tailscale-key-expiry.ics` into your calendar.

**30 days before expiry:**
- Automatic email alert sent
- Calendar event reminder appears
- Contact customer to re-authenticate

**On expiry date:**
- Calendar event reminder
- Follow up if customer hasn't re-authenticated

## Integration with Support Manual

When you receive an alert:
1. Check Support Manual section: "Tailscale Key Expiry Handling"
2. Follow re-authentication instructions
3. Guide customer through `sudo tailscale up`
4. Verify new IP if changed
5. Update device record if needed

