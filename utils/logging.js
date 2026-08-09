const winston = require('winston')
const dotenv = require('dotenv')

dotenv.config();
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL,
    format: winston.format.json(),
    transports:[new winston.transports.Console()],
})

module.exports = logger;