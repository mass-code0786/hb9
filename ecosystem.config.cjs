module.exports = {
  apps: [
    {
      name: "hb9-web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3000"
      },
      error_file: "logs/hb9-web-error.log",
      out_file: "logs/hb9-web-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      name: "hb9-api",
      script: "server/dist/index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        API_PORT: "4000"
      },
      error_file: "logs/hb9-api-error.log",
      out_file: "logs/hb9-api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    }
  ]
};
