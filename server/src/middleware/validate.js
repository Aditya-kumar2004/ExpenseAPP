/**
 * Zod-based request validation middleware factory.
 * Usage: router.post('/path', validate(schema), handler)
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return res.status(400).json({
        success: false,
        data: null,
        error: errors.join('; '),
      });
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validate };
