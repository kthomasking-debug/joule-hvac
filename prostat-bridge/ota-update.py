#!/usr/bin/env python3
"""
OTA Update System for Joule Bridge
Allows remote updates without SSH access
"""

import asyncio
import json
import logging
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
GIT_REPO_URL = "https://github.com/kthomasking-debug/joule-hvac.git"
GIT_REPO_PATH = Path.home() / "git" / "joule-hvac"
SERVICE_PATH = Path.home() / "prostat-bridge"
SERVICE_FILE = "/etc/systemd/system/prostat-bridge.service"
BACKUP_PATH = Path.home() / ".joule-bridge-backups"

def get_current_version():
    """Get current version from git or version file"""
    try:
        if (GIT_REPO_PATH / ".git").exists():
            result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=GIT_REPO_PATH,
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                return result.stdout.strip()[:8]  # Short commit hash
    except Exception as e:
        logger.debug(f"Could not get git version: {e}")
    
    # Fallback: check version file
    version_file = SERVICE_PATH / "VERSION"
    if version_file.exists():
        return version_file.read_text().strip()
    
    return "unknown"

def get_latest_version():
    """Get latest version from GitHub"""
    try:
        result = subprocess.run(
            ["git", "ls-remote", "--heads", GIT_REPO_URL, "main"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            commit_hash = result.stdout.split()[0]
            return commit_hash[:8]  # Short commit hash
    except Exception as e:
        logger.error(f"Failed to get latest version: {e}")
    return None

def create_backup():
    """Create backup of current server.py before update"""
    BACKUP_PATH.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = BACKUP_PATH / f"server.py.{timestamp}"
    
    current_server = SERVICE_PATH / "server.py"
    if current_server.exists():
        shutil.copy2(current_server, backup_file)
        logger.info(f"Created backup: {backup_file}")
        return str(backup_file)
    return None

def update_code():
    """Update code from GitHub"""
    try:
        # Ensure repo exists
        if not (GIT_REPO_PATH / ".git").exists():
            logger.info("Cloning repository...")
            GIT_REPO_PATH.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(
                ["git", "clone", GIT_REPO_URL, str(GIT_REPO_PATH)],
                check=True,
                timeout=60
            )
        else:
            logger.info("Pulling latest changes...")
            subprocess.run(
                ["git", "pull", "origin", "main"],
                cwd=GIT_REPO_PATH,
                check=True,
                timeout=60
            )
        
        # Copy updated server.py to service location
        source_file = GIT_REPO_PATH / "prostat-bridge" / "server.py"
        if not source_file.exists():
            raise FileNotFoundError(f"Source file not found: {source_file}")
        
        # Create backup first
        backup_file = create_backup()
        
        # Copy to service location
        SERVICE_PATH.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_file, SERVICE_PATH / "server.py")
        
        # Save version
        version = get_current_version()
        (SERVICE_PATH / "VERSION").write_text(version)
        
        logger.info(f"Code updated successfully. Version: {version}")
        return {
            "success": True,
            "version": version,
            "backup": backup_file
        }
    except subprocess.TimeoutExpired:
        raise Exception("Update timed out. Check network connection.")
    except subprocess.CalledProcessError as e:
        raise Exception(f"Git operation failed: {e.stderr}")
    except Exception as e:
        raise Exception(f"Update failed: {e}")

def restart_service():
    """Restart the bridge service"""
    try:
        result = subprocess.run(
            ["sudo", "systemctl", "restart", "prostat-bridge"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            logger.info("Service restarted successfully")
            return True
        else:
            logger.error(f"Service restart failed: {result.stderr}")
            return False
    except Exception as e:
        logger.error(f"Failed to restart service: {e}")
        return False

def rollback(backup_file):
    """Rollback to previous version"""
    if backup_file and Path(backup_file).exists():
        try:
            shutil.copy2(backup_file, SERVICE_PATH / "server.py")
            restart_service()
            logger.info("Rolled back to previous version")
            return True
        except Exception as e:
            logger.error(f"Rollback failed: {e}")
    return False

async def check_for_updates():
    """Check if updates are available"""
    current = get_current_version()
    latest = get_latest_version()
    
    if latest and latest != current:
        return {
            "update_available": True,
            "current_version": current,
            "latest_version": latest
        }
    return {
        "update_available": False,
        "current_version": current,
        "latest_version": latest or current
    }

async def perform_update():
    """Perform OTA update"""
    try:
        logger.info("Starting OTA update...")
        
        # Create backup
        backup_file = create_backup()
        
        # Update code
        result = update_code()
        
        # Restart service
        if restart_service():
            return {
                "success": True,
                "version": result["version"],
                "backup": backup_file,
                "message": "Update completed successfully"
            }
        else:
            # Rollback on service restart failure
            logger.warning("Service restart failed, rolling back...")
            rollback(backup_file)
            return {
                "success": False,
                "error": "Service restart failed, rolled back to previous version"
            }
    except Exception as e:
        logger.error(f"Update failed: {e}")
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Joule Bridge OTA Update")
    parser.add_argument("--check", action="store_true", help="Check for updates")
    parser.add_argument("--update", action="store_true", help="Perform update")
    
    args = parser.parse_args()
    
    if args.check:
        result = asyncio.run(check_for_updates())
        print(json.dumps(result, indent=2))
    elif args.update:
        result = asyncio.run(perform_update())
        print(json.dumps(result, indent=2))
    else:
        parser.print_help()

