import mongoose from "mongoose";
const formatMongooseError = (err) => {
  // Validation errors (required, minlength, custom validators...)
  if (err.name === 'ValidationError') {
    const details = {};
    for (const [path, e] of Object.entries(err.errors || {})) {
      details[path] = e.message;
    }
    return { status: 400, message: 'Validation failed', details };
  }

  // CastError (invalid ObjectId or wrong type)
  if (err.name === 'CastError') {
    return { status: 400, message: `Invalid ${err.path}: ${err.value}`, details: { [err.path]: `Invalid value ${err.value}` } };
  }

  // Duplicate key error (MongoServerError code 11000)
  // err.keyValue -> { field: value }
  if (err.name === 'MongoServerError' && err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return { status: 409, message: `Duplicate value for ${field}`, details: { [field]: `${err.keyValue[field]}` } };
  }

  // Fallback
  return { status: 500, message: err.message || 'Internal server error' };
};

export default formatMongooseError;