#!/bin/bash
#
# NPB Live Prediction System - Production Deployment Script
#
# Usage: ./deploy-production.sh [--dry-run]
#

set -euo pipefail

# Configuration
APP_NAME="npb-live"
APP_USER="npb"
APP_GROUP="npb"
APP_DIR="/opt/npb/baseball-ai-media"
DATA_DIR="/opt/npb/data"
BACKUP_DIR="/opt/npb/backups"
NODE_VERSION="18"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

error() {
    echo -e "${RED}❌${NC} $1"
    exit 1
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (use sudo)"
    fi
}

# Dry run flag
DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
    warning "DRY RUN MODE - No changes will be made"
fi

# Execute command (respects dry run)
execute() {
    local cmd="$1"
    local desc="${2:-$cmd}"
    
    log "$desc"
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "  [DRY RUN] $cmd"
    else
        eval "$cmd"
    fi
}

# Pre-deployment checks
pre_checks() {
    log "🔍 Running pre-deployment checks..."
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed. Please install Node.js $NODE_VERSION"
    fi
    
    # Check Node.js version
    local node_version=$(node --version | sed 's/v//')
    local major_version=$(echo $node_version | cut -d. -f1)
    if [[ $major_version -lt $NODE_VERSION ]]; then
        error "Node.js version $node_version is too old. Please upgrade to v$NODE_VERSION+"
    fi
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        error "npm is not installed"
    fi
    
    # Check if systemctl is available
    if ! command -v systemctl &> /dev/null; then
        error "systemctl is not available. This deployment requires systemd"
    fi
    
    # Check if nginx is installed
    if ! command -v nginx &> /dev/null; then
        warning "nginx is not installed. Web server configuration will be skipped"
    fi
    
    success "Pre-deployment checks passed"
}

# Create system user and directories
setup_user() {
    log "👤 Setting up system user and directories..."
    
    # Create system user
    if ! id "$APP_USER" &>/dev/null; then
        execute "useradd --system --shell /bin/false --home $APP_DIR --create-home $APP_USER" \
                "Creating system user $APP_USER"
    else
        log "User $APP_USER already exists"
    fi
    
    # Create directories
    execute "mkdir -p $APP_DIR" "Creating application directory"
    execute "mkdir -p $DATA_DIR" "Creating data directory" 
    execute "mkdir -p $BACKUP_DIR" "Creating backup directory"
    execute "mkdir -p /var/log/$APP_NAME" "Creating log directory"
    
    # Set permissions
    execute "chown -R $APP_USER:$APP_GROUP $APP_DIR" "Setting ownership of app directory"
    execute "chown -R $APP_USER:$APP_GROUP $DATA_DIR" "Setting ownership of data directory"
    execute "chown -R $APP_USER:$APP_GROUP $BACKUP_DIR" "Setting ownership of backup directory"
    execute "chown -R $APP_USER:$APP_GROUP /var/log/$APP_NAME" "Setting ownership of log directory"
    
    # Set directory permissions
    execute "chmod 755 $APP_DIR" "Setting app directory permissions"
    execute "chmod 755 $DATA_DIR" "Setting data directory permissions"
    execute "chmod 755 $BACKUP_DIR" "Setting backup directory permissions"
    
    success "User and directories set up"
}

# Deploy application code
deploy_code() {
    log "📦 Deploying application code..."
    
    # Stop services if running
    execute "systemctl stop $APP_NAME || true" "Stopping NPB Live service"
    execute "systemctl stop $APP_NAME-metrics || true" "Stopping NPB Metrics service"
    
    # Backup current deployment
    if [[ -d "$APP_DIR/package.json" ]]; then
        local backup_name="backup-$(date +%Y%m%d-%H%M%S)"
        execute "cp -r $APP_DIR $BACKUP_DIR/$backup_name" "Creating backup of current deployment"
    fi
    
    # Copy application files
    execute "cp -r ./* $APP_DIR/" "Copying application files"
    execute "chown -R $APP_USER:$APP_GROUP $APP_DIR" "Setting ownership of deployed files"
    
    # Install dependencies
    execute "cd $APP_DIR && sudo -u $APP_USER npm ci --production" "Installing production dependencies"
    
    # Build application if needed
    if [[ -f "$APP_DIR/tsconfig.json" ]]; then
        execute "cd $APP_DIR && sudo -u $APP_USER npm run build" "Building application"
    fi
    
    success "Application code deployed"
}

# Install systemd services
install_services() {
    log "⚙️ Installing systemd services..."
    
    # Install service files
    execute "cp deploy/npb-live.service /etc/systemd/system/" "Installing NPB Live service"
    execute "cp deploy/npb-metrics.service /etc/systemd/system/" "Installing NPB Metrics service"
    
    # Reload systemd
    execute "systemctl daemon-reload" "Reloading systemd daemon"
    
    # Enable services
    execute "systemctl enable npb-live.service" "Enabling NPB Live service"
    execute "systemctl enable npb-metrics.service" "Enabling NPB Metrics service"
    
    success "Systemd services installed"
}

# Configure nginx
configure_nginx() {
    if ! command -v nginx &> /dev/null; then
        warning "nginx not found, skipping web server configuration"
        return
    fi
    
    log "🌐 Configuring nginx..."
    
    # Install nginx configuration
    execute "cp deploy/nginx-npb-live.conf /etc/nginx/sites-available/npb-live" \
            "Installing nginx configuration"
    
    # Enable site
    execute "ln -sf /etc/nginx/sites-available/npb-live /etc/nginx/sites-enabled/" \
            "Enabling nginx site"
    
    # Test nginx configuration
    execute "nginx -t" "Testing nginx configuration"
    
    # Reload nginx
    execute "systemctl reload nginx" "Reloading nginx"
    
    success "nginx configured"
}

# Configure monitoring
configure_monitoring() {
    log "📊 Configuring monitoring..."
    
    # Install Prometheus rules if Prometheus is available
    if [[ -d "/etc/prometheus/rules" ]]; then
        execute "cp deploy/prometheus-alerts.yml /etc/prometheus/rules/npb-live.yml" \
                "Installing Prometheus alerting rules"
        
        # Reload Prometheus if running
        if systemctl is-active --quiet prometheus; then
            execute "systemctl reload prometheus" "Reloading Prometheus"
        fi
    else
        warning "Prometheus rules directory not found, skipping alerting rules installation"
    fi
    
    success "Monitoring configured"
}

# Start services
start_services() {
    log "🚀 Starting services..."
    
    # Start services
    execute "systemctl start npb-live.service" "Starting NPB Live service"
    execute "systemctl start npb-metrics.service" "Starting NPB Metrics service"
    
    # Check service status
    sleep 3
    
    if execute "systemctl is-active --quiet npb-live.service" "Checking NPB Live service status"; then
        success "NPB Live service is running"
    else
        error "NPB Live service failed to start"
    fi
    
    if execute "systemctl is-active --quiet npb-metrics.service" "Checking NPB Metrics service status"; then
        success "NPB Metrics service is running"
    else
        warning "NPB Metrics service failed to start (non-critical)"
    fi
}

# Verify deployment
verify_deployment() {
    log "🔍 Verifying deployment..."
    
    # Test health endpoint
    sleep 5
    if curl -s http://localhost:8787/health | grep -q '"ok":true'; then
        success "Health endpoint responding correctly"
    else
        error "Health endpoint not responding"
    fi
    
    # Test metrics endpoint
    if curl -s http://localhost:9465/metrics | grep -q "# HELP"; then
        success "Metrics endpoint responding correctly"
    else
        warning "Metrics endpoint not responding (non-critical)"
    fi
    
    success "Deployment verification completed"
}

# Post-deployment cleanup
cleanup() {
    log "🧹 Cleaning up..."
    
    # Remove old backups (keep last 5)
    if [[ -d "$BACKUP_DIR" ]]; then
        execute "find $BACKUP_DIR -type d -name 'backup-*' | sort -r | tail -n +6 | xargs rm -rf" \
                "Cleaning up old backups"
    fi
    
    # Clean npm cache
    execute "sudo -u $APP_USER npm cache clean --force" "Cleaning npm cache"
    
    success "Cleanup completed"
}

# Main deployment process
main() {
    log "🚀 Starting NPB Live Prediction System deployment..."
    echo "======================================================"
    
    check_root
    pre_checks
    setup_user
    deploy_code
    install_services
    configure_nginx
    configure_monitoring
    start_services
    verify_deployment
    cleanup
    
    echo "======================================================"
    success "🎉 NPB Live Prediction System deployed successfully!"
    
    log "📋 Next steps:"
    echo "   • Monitor logs: journalctl -u npb-live -f"
    echo "   • Check metrics: curl http://localhost:9465/metrics"
    echo "   • API health: curl http://localhost:8787/health"
    echo "   • SSE test: curl http://localhost:8787/live/games/today"
    
    if command -v nginx &> /dev/null; then
        echo "   • Web access: http://$(hostname)/health"
    fi
    
    log "📊 Service status:"
    systemctl status npb-live.service --no-pager -l
    echo ""
    systemctl status npb-metrics.service --no-pager -l
}

# Run main function
main "$@"