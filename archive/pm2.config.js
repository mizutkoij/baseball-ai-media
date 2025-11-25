module.exports = {
  apps: [{
    name: 'baseball-data-collector',
    script: 'npx',
    args: 'tsx scripts/server-data-collector.ts start',
    cwd: '/home/ubuntu/baseball-ai-media',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    log_file: './logs/data-collector.log',
    out_file: './logs/data-collector-out.log',
    error_file: './logs/data-collector-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true
  }]
};