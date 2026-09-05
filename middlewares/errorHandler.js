const logger = require("../utils/logging");

function errorHandler(err, req, res, next) {
  logger.error({
    method: req.method,
    url: req.originalUrl,
    message: err.message,
    stack: err.stack
  });

  let status = err.status || 500;

  res.status(status).json({
    success: false,
    error: err.message || "Internal Server Error"
  });
}

module.exports = errorHandler;