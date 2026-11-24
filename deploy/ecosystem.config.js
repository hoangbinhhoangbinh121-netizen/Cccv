// PM2: pm2 start deploy/ecosystem.config.js && pm2 save && pm2 startup
module.exports = { apps: [{ name: 'thien-tong-fishing', script: 'src/index.js', cwd: __dirname + '/..', instances: 1, exec_mode: 'fork', autorestart: true, max_restarts: 20, kill_timeout: 20000, max_memory_restart: '500M' }] };
