#!/bin/bash

# Server Player Installation Script
# Usage: curl -fsSL https://raw.githubusercontent.com/vdohide-core/server-player/main/install.sh | sudo -E bash -s -- [OPTIONS]

set -e

# ─── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ─── Defaults ──────────────────────────────────────────────────────────────────
PORT="8083"
MONGODB_URI=""
LOG_PATH="logs/server-content.log"
DOMAINS=()           # optional: --domain cdn1.example.com cdn2.example.com
APP_HOST="localhost"  # --app-host 10.0.0.1 (remote app server)
INSTALL_APP=false
INSTALL_NGINX=false
UNINSTALL=false

APP_NAME="server-player"
APP_DIR="/opt/$APP_NAME"
SERVICE_NAME="server-player"
GITHUB_REPO="vdohide-core/server-player"
RELEASES_URL="https://github.com/$GITHUB_REPO/releases/latest/download"

# ─── Helpers ───────────────────────────────────────────────────────────────────
print_status()  { echo -e "${GREEN}[INFO]${NC}    $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error()   { echo -e "${RED}[ERROR]${NC}   $1"; }
print_section() { echo -e "\n${BLUE}══════════════════════════════════════════${NC}"; echo -e "${BLUE}  $1${NC}"; echo -e "${BLUE}══════════════════════════════════════════${NC}"; }

# ─── Argument Parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case $1 in
        --uninstall)
            UNINSTALL=true
            shift
            ;;
        --app)
            INSTALL_APP=true
            shift
            ;;
        --nginx)
            INSTALL_NGINX=true
            shift
            ;;
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        --mongodb-uri)
            MONGODB_URI="$2"
            shift 2
            ;;
        --log-path)
            LOG_PATH="$2"
            shift 2
            ;;
        -d|--domain)
            # Consume all following non-flag args as domain names
            shift
            while [[ $# -gt 0 && ! "$1" =~ ^-- && ! "$1" =~ ^-[a-zA-Z] ]]; do
                DOMAINS+=("$1")
                shift
            done
            ;;
        --app-host)
            APP_HOST="$2"
            shift 2
            ;;
        -h|--help)
            echo ""
            echo "  Server Player Installer — vdohide-core/server-player"
            echo ""
            echo "  Usage:"
            echo "    curl -fsSL https://raw.githubusercontent.com/$GITHUB_REPO/main/install.sh | sudo -E bash -s -- [OPTIONS]"
            echo ""
            echo "  Components (default: both):"
            echo "    --app              Install/update application binary only"
            echo "    --nginx            Install/update Nginx config only"
            echo "    --uninstall        Remove everything"
            echo ""
            echo "  Configuration:"
            echo "    -p, --port PORT           HTTP port (default: 8083)"
            echo "    -d, --domain D1 D2 ...    Specific domains (optional — default: accept all)"
            echo "    --app-host HOST           App server IP/hostname for Nginx upstream (default: localhost)"
            echo "    --mongodb-uri URI         MongoDB connection string"
            echo "    --log-path PATH           Log file path (default: logs/server-content.log)"
            echo ""
            echo "  Examples:"
            echo ""
            echo "    # Install on same server — accept ALL domains"
            echo "    curl -fsSL ... | sudo -E bash -s -- \\"
            echo "        --port 8083 \\"
            echo "        --mongodb-uri \"mongodb+srv://user:pass@host/db\""
            echo ""
            echo "    # App on Server A, Nginx on Server B (remote)"
            echo "    # On Server A (app only):"
            echo "    curl -fsSL ... | sudo -E bash -s -- --app --port 8083 --mongodb-uri \"...\""
            echo "    # On Server B (nginx only, pointing to Server A):"
            echo "    curl -fsSL ... | sudo -E bash -s -- --nginx --app-host 10.0.0.1 --port 8083"
            echo ""
            echo "    # Install — specific domains only"
            echo "    curl -fsSL ... | sudo -E bash -s -- \\"
            echo "        --port 8083 \\"
            echo "        --domain embed.vdohide.com cdn.vdohide.com \\"
            echo "        --mongodb-uri \"mongodb+srv://user:pass@host/db\""
            echo ""
            echo "    # Uninstall"
            echo "    curl -fsSL ... | sudo bash -s -- --uninstall"
            echo ""
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# If no component selected → install both
if [ "$INSTALL_APP" = false ] && [ "$INSTALL_NGINX" = false ]; then
    INSTALL_APP=true
    INSTALL_NGINX=true
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Uninstall
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$UNINSTALL" = true ]; then
    print_section "Uninstalling $APP_NAME"

    systemctl stop  $SERVICE_NAME 2>/dev/null || true
    systemctl disable $SERVICE_NAME 2>/dev/null || true

    [ -f "/etc/systemd/system/$SERVICE_NAME.service" ] && {
        rm "/etc/systemd/system/$SERVICE_NAME.service"
        systemctl daemon-reload
        print_status "Systemd service removed."
    }

    [ -d "$APP_DIR" ] && {
        rm -rf "$APP_DIR"
        print_status "Application directory removed."
    }

    # Remove nginx vhost if present
    [ -f "/etc/nginx/sites-available/$APP_NAME" ] && {
        rm "/etc/nginx/sites-available/$APP_NAME"
        rm -f "/etc/nginx/sites-enabled/$APP_NAME"
        command -v nginx &>/dev/null && nginx -t && systemctl reload nginx
        print_status "Nginx vhost removed."
    }

    # Restore default nginx site
    if command -v nginx &>/dev/null && [ -f /etc/nginx/sites-available/default ]; then
        cat > /etc/nginx/sites-available/default << 'DEFEOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    root /var/www/html;
    index index.html index.htm;
    server_name _;
    location / {
        try_files $uri $uri/ =404;
    }
}
DEFEOF
        nginx -t && systemctl reload nginx
        print_status "Nginx default site restored."
    fi

    print_status "✅ Uninstallation complete."
    exit 0
fi

# Root check
if [ "$(id -u)" -ne 0 ]; then
    print_error "This script must be run as root (use sudo)."
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════════
# System Dependencies
# ═══════════════════════════════════════════════════════════════════════════════
print_section "System Dependencies"
if command -v apt-get &>/dev/null; then
    apt-get update -qq
    apt-get install -y -qq curl
elif command -v yum &>/dev/null; then
    yum install -y curl
elif command -v dnf &>/dev/null; then
    dnf install -y curl
fi
print_status "Dependencies ready."

# ═══════════════════════════════════════════════════════════════════════════════
# Application Install
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$INSTALL_APP" = true ]; then
    print_section "Installing Application"

    systemctl stop $SERVICE_NAME 2>/dev/null || true

    mkdir -p "$APP_DIR"
    mkdir -p "$APP_DIR/logs"
    mkdir -p "$APP_DIR/conf"

    # ── Architecture ────────────────────────────────────────────────────────────
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64)        BINARY="linux" ;;
        aarch64|arm64) BINARY="linux-arm64" ;;
        *)
            print_error "Unsupported architecture: $ARCH"
            exit 1
            ;;
    esac

    # ── Download binary ─────────────────────────────────────────────────────────
    print_status "Downloading binary ($BINARY) from latest release..."
    curl -fsSL "$RELEASES_URL/$BINARY" -o "$APP_DIR/$APP_NAME"
    chmod +x "$APP_DIR/$APP_NAME"
    print_status "Binary ready: $APP_DIR/$APP_NAME"

    # ── Write .env ──────────────────────────────────────────────────────────────
    if [ -f "$APP_DIR/.env" ] && [ -z "$MONGODB_URI" ]; then
        # Preserve existing config — update PORT only
        print_status "Preserving existing .env — updating PORT..."
        if grep -q "^PORT=" "$APP_DIR/.env"; then
            sed -i "s/^PORT=.*/PORT=$PORT/" "$APP_DIR/.env"
        else
            echo "PORT=$PORT" >> "$APP_DIR/.env"
        fi
    else
        print_status "Writing .env..."
        cat > "$APP_DIR/.env" <<EOF
MONGODB_URI=$MONGODB_URI
PORT=$PORT
LOG_PATH=$LOG_PATH
EOF
        if [ -z "$MONGODB_URI" ]; then
            print_warning "MONGODB_URI is not set — edit $APP_DIR/.env before starting."
        fi
    fi

    # ── Systemd service ─────────────────────────────────────────────────────────
    print_status "Creating systemd service..."
    cat > /etc/systemd/system/$SERVICE_NAME.service <<EOF
[Unit]
Description=Server Player (vdohide-core)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/$APP_NAME
Restart=always
RestartSec=5
EnvironmentFile=$APP_DIR/.env
Environment=PATH=/usr/bin:/bin

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable $SERVICE_NAME
    systemctl start  $SERVICE_NAME

    sleep 2
    if systemctl is-active --quiet $SERVICE_NAME; then
        print_status "✅ Application running."
    else
        print_error "❌ Application failed to start. Run: journalctl -u $SERVICE_NAME -e"
        exit 1
    fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Nginx Install / Configure
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$INSTALL_NGINX" = true ]; then
    print_section "Configuring Nginx"

    if ! command -v nginx &>/dev/null; then
        print_status "Installing Nginx..."
        apt-get update -qq
        apt-get install -y nginx
        systemctl enable nginx
        systemctl start  nginx
    fi

    if [ "${#DOMAINS[@]}" -eq 0 ]; then
        # ── Catch-all: accept every domain ──────────────────────────────────────
        print_status "No --domain specified → configuring Nginx to accept ALL domains..."
        cat > /etc/nginx/sites-available/default << 'EOF'
# server-player: catch-all — accepts every domain
upstream server-player {
    server __APP_HOST__:__PORT__;
    keepalive 32;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    proxy_buffering         off;
    proxy_request_buffering off;

    location / {
        proxy_pass         http://server-player;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        'upgrade';
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
EOF
        sed -i "s/__APP_HOST__/$APP_HOST/g" /etc/nginx/sites-available/default
        sed -i "s/__PORT__/$PORT/g" /etc/nginx/sites-available/default
        ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

        if nginx -t; then
            systemctl reload nginx
            print_status "✅ Nginx configured: all domains → $APP_HOST:$PORT"
        else
            print_error "❌ Nginx configuration test failed."
            exit 1
        fi
    else
        # ── Specific domains vhost ───────────────────────────────────────────────
        SERVER_NAMES="${DOMAINS[*]}"
        print_status "Configuring Nginx for specific domains: $SERVER_NAMES"

        cat > /etc/nginx/sites-available/$APP_NAME << 'EOF'
upstream server-player {
    server __APP_HOST__:__PORT__;
    keepalive 32;
}

server {
    listen 80;
    server_name __SERVER_NAMES__;

    proxy_buffering         off;
    proxy_request_buffering off;

    location / {
        proxy_pass         http://server-player;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        'upgrade';
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
EOF
        sed -i "s/__APP_HOST__/$APP_HOST/g" /etc/nginx/sites-available/$APP_NAME
        sed -i "s/__PORT__/$PORT/g" /etc/nginx/sites-available/$APP_NAME
        sed -i "s/__SERVER_NAMES__/$SERVER_NAMES/g" /etc/nginx/sites-available/$APP_NAME
        ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/

        if nginx -t; then
            systemctl reload nginx
            print_status "✅ Nginx configured for: $SERVER_NAMES"
        else
            print_error "❌ Nginx configuration test failed."
            exit 1
        fi
    fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Done
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo "════════════════════════════════════════════"
print_status "🎉 Installation complete!"
echo "════════════════════════════════════════════"
echo "  Service:  $SERVICE_NAME"
echo "  Port:     $PORT"
if [ "${#DOMAINS[@]}" -gt 0 ]; then
    echo "  Domains:"
    for d in "${DOMAINS[@]}"; do
        echo "    • http://$d"
    done
else
    echo "  Domains:  all (catch-all)"
fi
echo ""
echo "  Health:   http://localhost:$PORT/health"
echo "  Logs API: http://localhost:$PORT/logs"
echo ""
echo "  Commands:"
echo "    systemctl status  $SERVICE_NAME"
echo "    systemctl restart $SERVICE_NAME"
echo "    journalctl -u $SERVICE_NAME -f"
echo "════════════════════════════════════════════"
