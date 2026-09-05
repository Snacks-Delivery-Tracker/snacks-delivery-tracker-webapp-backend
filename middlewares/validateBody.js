const IllegalArgumentsError = require("../utils/exceptions/IllegalArgumentsError");

function validateBody(requiredFields, allowedFields) {
  return (req, res, next) => {
    const body = req.body || {};

    // Check required fields
    for (const field of requiredFields) {
      if (
        body[field] === undefined ||
        body[field] === null ||
        body[field] === ""
      ) {
        return next(new IllegalArgumentsError(`Missing required field: ${field}`));
      }
    }

    // Check for extra fields
    const extraFields = Object.keys(body).filter(
      key => !allowedFields.includes(key)
    );

    if (extraFields.length > 0) {
      return next(
        new IllegalArgumentsError(
          `Unexpected field(s): ${extraFields.join(", ")}`
        )
      );
    }

    next();
  };
}

module.exports = validateBody;