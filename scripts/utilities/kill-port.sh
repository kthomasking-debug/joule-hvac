#!/bin/bash
# Kill processes on a specific port (default: 5173)
# Usage: ./scripts/kill-port.sh [port]
# Example: ./scripts/kill-port.sh 5173

PORT=${1:-5173}

echo "🔍 Checking for processes on port $PORT..."

# Find processes using the port (works on Linux and macOS)
if command -v lsof &> /dev/null; then
    # macOS/Linux with lsof
    PIDS=$(lsof -ti:$PORT)
elif command -v netstat &> /dev/null; then
    # Linux with netstat
    PIDS=$(netstat -tlnp 2>/dev/null | grep ":$PORT" | awk '{print $7}' | cut -d'/' -f1 | sort -u)
else
    echo "❌ Neither lsof nor netstat found. Cannot kill processes."
    exit 1
fi

if [ -z "$PIDS" ]; then
    echo "✓ Port $PORT is already free"
    exit 0
fi

echo "⚠️  Found processes on port $PORT:"
for PID in $PIDS; do
    if [ ! -z "$PID" ] && [ "$PID" != "-" ]; then
        echo "  PID: $PID"
    fi
done

# Kill each process
for PID in $PIDS; do
    if [ ! -z "$PID" ] && [ "$PID" != "-" ]; then
        echo "🔪 Killing process $PID..."
        kill -9 $PID 2>/dev/null
        if [ $? -eq 0 ]; then
            echo "  ✓ Process $PID terminated"
        else
            echo "  ✗ Failed to kill process $PID"
        fi
    fi
done

echo "✅ Port $PORT should now be free"




