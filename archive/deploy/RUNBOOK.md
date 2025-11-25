# NPB Live Prediction System - Operations Runbook

## Quick Reference

### Service Management
```bash
# Check service status
sudo systemctl status npb-live
sudo systemctl status npb-metrics

# Start/stop/restart services
sudo systemctl start npb-live
sudo systemctl stop npb-live
sudo systemctl restart npb-live

# View logs
sudo journalctl -u npb-live -f
sudo journalctl -u npb-metrics -f

# Check health
curl http://localhost:8787/health
curl http://localhost:9465/metrics
```

### Key Endpoints
- **Health Check**: `GET /health`
- **Today's Games**: `GET /live/games/today`
- **Game Data**: `GET /live/{gameId}?date=2025-08-12`
- **Live Stream**: `GET /live/{gameId}/stream?date=2025-08-12&replay=1`
- **Metrics**: `GET /metrics`

## Deployment

### Fresh Installation
```bash
# Clone repository
git clone https://github.com/your-org/baseball-ai-media.git
cd baseball-ai-media

# Run deployment script
sudo chmod +x deploy/deploy-production.sh
sudo ./deploy/deploy-production.sh

# Verify deployment
curl http://localhost:8787/health
```

### Updates
```bash
# Stop services
sudo systemctl stop npb-live npb-metrics

# Pull latest code
git pull origin main

# Install dependencies
sudo -u npb npm ci --production

# Restart services
sudo systemctl start npb-live npb-metrics

# Verify
curl http://localhost:8787/health
```

### Rollback
```bash
# List available backups
ls -la /opt/npb/backups/

# Stop services
sudo systemctl stop npb-live npb-metrics

# Restore backup
sudo cp -r /opt/npb/backups/backup-YYYYMMDD-HHMMSS/* /opt/npb/baseball-ai-media/
sudo chown -R npb:npb /opt/npb/baseball-ai-media

# Start services
sudo systemctl start npb-live npb-metrics
```

## Monitoring & Alerting

### Key Metrics
- **Service Uptime**: `up{job="npb-live"}`
- **Request Rate**: `rate(http_requests_total[5m])`
- **Error Rate**: `rate(http_requests_total{status=~"5.."}[5m])`
- **Response Time**: `histogram_quantile(0.95, http_request_duration_seconds_bucket)`
- **SSE Connections**: `sse_connections_active`
- **Data Freshness**: `time() - data_last_update_timestamp`

### Alert States
- **Green**: All systems operational
- **Yellow**: Performance degraded, attention needed
- **Red**: Critical issue, immediate action required

## Troubleshooting

### Service Won't Start

**Symptoms**: `systemctl start npb-live` fails
```bash
# Check detailed status
sudo systemctl status npb-live -l

# Check logs
sudo journalctl -u npb-live -n 50

# Common issues:
# 1. Port already in use
sudo netstat -tlnp | grep :8787

# 2. Permission issues
sudo chown -R npb:npb /opt/npb/baseball-ai-media
sudo chown -R npb:npb /opt/npb/data

# 3. Missing dependencies
cd /opt/npb/baseball-ai-media
sudo -u npb npm ci --production
```

### High Response Times

**Symptoms**: API responses > 2 seconds
```bash
# Check system resources
top -u npb
df -h /opt/npb/data

# Check active connections
sudo netstat -an | grep :8787 | wc -l

# Review recent logs for errors
sudo journalctl -u npb-live --since "1 hour ago" | grep ERROR

# Restart service if needed
sudo systemctl restart npb-live
```

### No Data Updates

**Symptoms**: `data_last_update_timestamp` is stale
```bash
# Check data directory
ls -la /opt/npb/data/predictions/live/date=$(date +%Y-%m-%d)/

# Check file permissions
sudo -u npb ls -la /opt/npb/data/

# Check data pipeline logs
sudo journalctl -u npb-live --since "30 minutes ago" | grep -i "data\|update\|file"

# Manual data check
curl http://localhost:8787/live/games/today
```

### SSE Connection Issues

**Symptoms**: Clients can't connect to `/stream` endpoints
```bash
# Test SSE manually
curl -N http://localhost:8787/live/20250812_G-T_01/stream?date=2025-08-12

# Check nginx configuration (if using nginx)
sudo nginx -t
sudo journalctl -u nginx --since "10 minutes ago"

# Check connection limits
# Current connections
sudo netstat -an | grep :8787 | grep ESTABLISHED | wc -l

# Check rate limits in nginx
sudo tail -f /var/log/nginx/error.log | grep "limiting"
```

### High Memory Usage

**Symptoms**: Memory usage > 1GB
```bash
# Check memory usage
ps aux | grep node | grep npb

# Check for memory leaks
sudo -u npb node --inspect=127.0.0.1:9229 server/live-api.js &
# Connect Chrome DevTools to localhost:9229

# Restart service to clear memory
sudo systemctl restart npb-live

# Check if issue persists
watch 'ps aux | grep node | grep npb'
```

### Database Issues

**Symptoms**: Can't access game data
```bash
# Check database files
ls -la /opt/npb/data/*.db

# Test database connectivity
cd /opt/npb/baseball-ai-media
sudo -u npb npm run test:db

# Check disk space
df -h /opt/npb/data

# Backup database
sudo -u npb cp /opt/npb/data/baseball.db /opt/npb/backups/db-$(date +%Y%m%d-%H%M%S).db
```

## Performance Optimization

### Scaling SSE Connections
```bash
# Increase file descriptor limits
echo "npb soft nofile 65536" >> /etc/security/limits.conf
echo "npb hard nofile 65536" >> /etc/security/limits.conf

# Update systemd service
# Add to npb-live.service under [Service]:
# LimitNOFILE=65536
```

### Memory Optimization
```bash
# Tune Node.js garbage collection
# Add to service file:
# Environment=NODE_OPTIONS="--max-old-space-size=1024 --gc-interval=100"
```

### Disk Space Management
```bash
# Clean old prediction data (older than 30 days)
find /opt/npb/data/predictions/live -name "date=*" -type d -mtime +30 -exec rm -rf {} +

# Set up automatic cleanup (add to crontab)
echo "0 2 * * * npb find /opt/npb/data/predictions/live -name 'date=*' -type d -mtime +30 -exec rm -rf {} +" | sudo crontab -u npb -
```

## Security

### Access Control
```bash
# Verify service runs as npb user
ps aux | grep npb

# Check file permissions
sudo find /opt/npb -type f -perm /o+w
sudo find /opt/npb -type d -perm /o+w

# Review nginx access logs
sudo tail -f /var/log/nginx/access.log | grep -v "GET /health"
```

### SSL/TLS Configuration
```bash
# Generate SSL certificate (if needed)
sudo certbot --nginx -d api.your-domain.com

# Test SSL configuration
openssl s_client -connect api.your-domain.com:443 -servername api.your-domain.com
```

## Emergency Procedures

### Complete Service Outage
1. **Immediate Response**:
   ```bash
   sudo systemctl restart npb-live npb-metrics
   curl http://localhost:8787/health
   ```

2. **If restart fails**:
   ```bash
   # Kill all processes
   sudo pkill -f "npb-live"
   
   # Check for port conflicts
   sudo netstat -tlnp | grep :8787
   
   # Start manually for debugging
   cd /opt/npb/baseball-ai-media
   sudo -u npb node server/live-api.js
   ```

3. **If still failing**:
   ```bash
   # Rollback to last working backup
   sudo cp -r /opt/npb/backups/backup-LATEST/* /opt/npb/baseball-ai-media/
   sudo systemctl start npb-live
   ```

### Data Corruption
1. **Stop services immediately**:
   ```bash
   sudo systemctl stop npb-live npb-metrics
   ```

2. **Assess damage**:
   ```bash
   cd /opt/npb/data
   find . -name "*.jsonl" -size 0
   find . -name "*.json" ! -path "*/backups/*" -exec file {} \;
   ```

3. **Restore from backup**:
   ```bash
   sudo cp -r /opt/npb/backups/data-LATEST/* /opt/npb/data/
   sudo chown -R npb:npb /opt/npb/data
   ```

### Network Issues
1. **Check connectivity**:
   ```bash
   # Test internal connectivity
   curl http://localhost:8787/health
   
   # Test external connectivity (if applicable)
   curl http://api.your-domain.com/health
   ```

2. **Check nginx (if used)**:
   ```bash
   sudo systemctl status nginx
   sudo nginx -t
   sudo systemctl reload nginx
   ```

3. **Check firewall**:
   ```bash
   sudo ufw status
   sudo iptables -L
   ```

## Maintenance

### Regular Tasks
- **Daily**: Check service status and logs
- **Weekly**: Review metrics and performance
- **Monthly**: Clean old data and update dependencies
- **Quarterly**: Security updates and configuration review

### Backup Schedule
```bash
# Daily database backup
0 3 * * * npb cp /opt/npb/data/baseball.db /opt/npb/backups/db-$(date +\%Y\%m\%d).db

# Weekly data backup
0 4 * * 0 npb tar -czf /opt/npb/backups/data-$(date +\%Y\%m\%d).tar.gz /opt/npb/data/predictions

# Monthly cleanup
0 5 1 * * npb find /opt/npb/backups -name "*.db" -mtime +90 -delete
```

## Contact Information

- **Engineering Team**: engineering@your-org.com
- **On-call**: +1-555-0123
- **Escalation**: cto@your-org.com

## Additional Resources

- **API Documentation**: `/docs/api.md`
- **Architecture Overview**: `/docs/architecture.md`
- **Metrics Dashboard**: `http://grafana.your-domain.com/dashboard/npb-live`
- **Log Aggregation**: `http://kibana.your-domain.com/app/logs`