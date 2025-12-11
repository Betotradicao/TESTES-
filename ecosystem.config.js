module.exports = {
  apps: [
    {
      name: '@market-security/backend',
      cwd: './packages/backend',
      script: 'node_modules/nodemon/bin/nodemon.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'development'
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: '../../logs/backend-error.log',
      out_file: '../../logs/backend-out.log',
      time: true
    },
    {
      name: '@market-security/frontend',
      cwd: './packages/frontend',
      script: 'node_modules/vite/bin/vite.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'development'
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: '../../logs/frontend-error.log',
      out_file: '../../logs/frontend-out.log',
      time: true
    }
  ]
};
