// PM2 Ecosystem config — auto-restart, watchdog, log management
module.exports = {
  apps: [{
    name: 'owntown-bot',
    script: 'bot.js',
    cwd: __dirname,

    // Auto-restart
    autorestart: true,
    max_restarts: 50,
    min_uptime: '10s',
    restart_delay: 5000,

    // Watchdog: restart if memory exceeds 500MB
    max_memory_restart: '500M',

    // Logging
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,

    // Rotate logs (requires pm2-logrotate)
    // pm2 install pm2-logrotate
    // pm2 set pm2-logrotate:max_size 50M
    // pm2 set pm2-logrotate:retain 7

    // Environment
    env: {
      NODE_ENV: 'production',
    },

    // Health check (optional — requires pm2-health)
    // Restart if no stdout for 15 minutes (bot is stuck)
    kill_timeout: 10000,

    // Cron restart: restart daily at 4am UTC to refresh state
    // cron_restart: '0 4 * * *',
  }],
};
