class IllegalArgumentsError extends Error {
  constructor(message = "Illegal arguments passed") {
    super(message, 404);
  }
}

module.exports = IllegalArgumentsError;