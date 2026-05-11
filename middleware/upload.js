const multer = require('multer');
const path = require('path');
const config = require('../config');
const { AppError } = require('../middleware/errorHandler');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = config.upload.allowedMimeTypes;
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`Invalid file type. Allowed: ${allowed.join(', ')}`, 400), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
  fileFilter,
});

const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: {
          message: `File too large. Maximum size is ${config.upload.maxFileSize / 1024 / 1024}MB`,
        },
      });
    }
    return res.status(400).json({
      success: false,
      error: { message: err.message },
    });
  }
  if (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { message: err.message },
    });
  }
  next();
};

module.exports = { upload, handleUploadError };