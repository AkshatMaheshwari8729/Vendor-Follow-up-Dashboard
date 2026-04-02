const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const uploadRoot = path.join(__dirname, '..', 'uploads');
const macroDir = path.join(uploadRoot, 'macros');
const inputDir = path.join(uploadRoot, 'inputs');

[uploadRoot, macroDir, inputDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const maxUploadSizeMb = Number(process.env.MAX_UPLOAD_SIZE_MB || 25);

const extensionAllowed = (filename, allowedExts) =>
  allowedExts.includes(path.extname(filename).toLowerCase());

const macroStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, macroDir),
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}-${file.originalname.replace(/\s+/g, '_')}`);
  },
});

const inputStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const groupId = req.body.inputsUploadId || uuidv4();
    req.body.inputsUploadId = groupId;

    const groupPath = path.join(inputDir, groupId);
    fs.mkdirSync(groupPath, { recursive: true });

    cb(null, groupPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}-${file.originalname.replace(/\s+/g, '_')}`);
  },
});

const macroUploadMiddleware = multer({
  storage: macroStorage,
  limits: { fileSize: maxUploadSizeMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!extensionAllowed(file.originalname, ['.xlsm', '.xlsx'])) {
      cb(new Error('Only .xlsm and .xlsx files are allowed.'));
      return;
    }

    cb(null, true);
  },
});

const inputUploadMiddleware = multer({
  storage: inputStorage,
  limits: { fileSize: maxUploadSizeMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!extensionAllowed(file.originalname, ['.xlsm', '.xlsx', '.csv'])) {
      cb(new Error('Only .xlsm, .xlsx, and .csv files are allowed as input files.'));
      return;
    }

    cb(null, true);
  },
});

const uploadErrorHandler = (error, req, res, next) => {
  if (!error) {
    next();
    return;
  }

  res.status(400).json({ message: error.message || 'Upload failed.' });
};

module.exports = {
  macroUploadMiddleware,
  inputUploadMiddleware,
  uploadErrorHandler,
};
