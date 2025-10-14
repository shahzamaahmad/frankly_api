const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize, errors } = format;
const path = require('path');

const logFormat = printf(({ level, message, timestamp, stack }) => {
  if (stack) {
    // print stack trace for errors
    return `${timestamp} ${level}: ${message} - ${stack}`;
  }
  return `${timestamp} ${level}: ${message}`;
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new transports.File({ filename: path.join(__dirname, '../../logs/error.log'), level: 'error' }),
    new transports.File({ filename: path.join(__dirname, '../../logs/combined.log') }),
  ],
});

// If we're not in production, also log to the console with colorized output.
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), logFormat),
  }));
}

// stream object for morgan
logger.stream = {
  write: function (message) {
    // Morgan adds a newline at the end of each message; trim it.
    logger.info(message.trim());
  }
};

module.exports = logger;
