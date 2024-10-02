// src/logger.js

const { createLogger, format, transports } = require("winston");

const logger = createLogger({
  level: "debug", // Set to 'debug' to capture all logs
  format: format.combine(
    format.colorize(),
    format.printf(({ level, message }) => `[${level}] ${message}`)
  ),
  transports: [new transports.Console()],
});

module.exports = logger;
