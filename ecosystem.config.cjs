const path = require('node:path')

module.exports = {
  apps: [
    {
      name: 'hwalingo-backend',
      cwd: path.join(__dirname, 'backend'),
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 3000,
      max_memory_restart: '500M',
      kill_timeout: 10000,
      time: true,
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
}
