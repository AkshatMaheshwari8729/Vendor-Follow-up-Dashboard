const notFoundHandler = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};

const errorHandler = (error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  const payload = {
    message: error.message || 'Internal server error.',
  };

  if (process.env.NODE_ENV !== 'production') {
    payload.stack = error.stack;
  }

  res.status(statusCode).json(payload);
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
