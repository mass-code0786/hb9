module.exports = {
  apps: [
    {
      name: "hb9-web",
      cwd: "/var/www/hb9",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3000",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "127.0.0.1"
      },
      error_file: "/var/www/hb9/logs/hb9-web-error.log",
      out_file: "/var/www/hb9/logs/hb9-web-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      name: "hb9-api",
      cwd: "/var/www/hb9",
      script: "server/dist/index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "4000",
        API_PORT: "4000",
        HOST: "127.0.0.1"
      },
      error_file: "/var/www/hb9/logs/hb9-api-error.log",
      out_file: "/var/www/hb9/logs/hb9-api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    }
  ]
};
