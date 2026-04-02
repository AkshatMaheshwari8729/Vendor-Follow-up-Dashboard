const express = require('express');
const multer = require('multer');

const macroController = require('../controllers/macroController');
const {
  macroUploadMiddleware,
  inputUploadMiddleware,
  uploadErrorHandler,
} = require('../services/uploadService');

const router = express.Router();

router.post('/upload-macro', macroUploadMiddleware.single('macroFile'), uploadErrorHandler, macroController.uploadMacroFile);
router.post('/analyze-macro', macroController.analyzeMacro);
router.post('/upload-inputs', inputUploadMiddleware.array('inputFiles', 10), uploadErrorHandler, macroController.uploadInputFiles);
router.post('/run-macro', macroController.runMacro);
router.get('/download/:fileId', macroController.downloadOutput);

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ message: `Upload error: ${error.message}` });
  }

  return next(error);
});

module.exports = router;
