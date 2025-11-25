module.exports = {
  apps: [
    {
      name: 'ingest-live',
      script: 'npx',
      args: 'tsx baseball-dataset/orchestrator/ingest_day.ts --mode=live --verbose',
      cwd: '/home/ubuntu/baseball-ai-media',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production'
      },
      cron_restart: '*/2 * * * *', // 2分ごと
      log_file: './logs/ingest-live.log',
      out_file: './logs/ingest-live-out.log',
      error_file: './logs/ingest-live-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    },
    {
      name: 'ingest-recent',
      script: 'npx',
      args: 'tsx baseball-dataset/orchestrator/ingest_day.ts --mode=recent --verbose',
      cwd: '/home/ubuntu/baseball-ai-media',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production'
      },
      cron_restart: '*/15 * * * *', // 15分ごと
      log_file: './logs/ingest-recent.log',
      out_file: './logs/ingest-recent-out.log',
      error_file: './logs/ingest-recent-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    },
    {
      name: 'ingest-archive',
      script: 'npx',
      args: 'tsx baseball-dataset/orchestrator/ingest_day.ts --mode=archive --verbose',
      cwd: '/home/ubuntu/baseball-ai-media',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production'
      },
      cron_restart: '0 3 * * *', // 毎日3時
      log_file: './logs/ingest-archive.log',
      out_file: './logs/ingest-archive-out.log',
      error_file: './logs/ingest-archive-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    },
    {
      name: 'quality-gate',
      script: 'npx',
      args: 'tsx baseball-dataset/orchestrator/quality_gate.ts --notify',
      cwd: '/home/ubuntu/baseball-ai-media',
      instances: 1,
      autorestart: false, // 一回実行のみ
      watch: false,
      max_memory_restart: '150M',
      env: {
        NODE_ENV: 'production'
      },
      cron_restart: '0 */6 * * *', // 6時間ごと
      log_file: './logs/quality-gate.log',
      out_file: './logs/quality-gate-out.log',
      error_file: './logs/quality-gate-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    }
  ]
};