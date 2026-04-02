const fs = require('fs');
const path = require('path');

const registry = require('../services/fileRegistryService');
const { analyzeMacroFile } = require('../services/geminiService');
const { executeMacro } = require('../services/macroExecutionService');

const uploadMacroFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No macro file uploaded.' });
    }

    const entry = registry.registerMacro({
      filePath: req.file.path,
      originalName: req.file.originalname,
    });

    return res.json({
      message: 'Macro file uploaded successfully.',
      fileId: entry.fileId,
      filename: entry.originalName,
    });
  } catch (error) {
    return next(error);
  }
};

const analyzeMacro = async (req, res, next) => {
  try {
    const { fileId } = req.body;
    if (!fileId) {
      return res.status(400).json({ message: 'fileId is required.' });
    }

    const macro = registry.getMacro(fileId);
    if (!macro) {
      return res.status(404).json({ message: 'Macro file not found.' });
    }

    const modules = await analyzeMacroFile({ filePath: macro.filePath });

    return res.json({ modules });
  } catch (error) {
    return next(error);
  }
};

const uploadInputFiles = async (req, res, next) => {
  try {
    const { macroFileId, moduleName } = req.body;

    if (!macroFileId || !moduleName) {
      return res.status(400).json({ message: 'macroFileId and moduleName are required.' });
    }

    if (!req.files || !req.files.length) {
      return res.status(400).json({ message: 'At least one input file is required.' });
    }

    const files = req.files.map((file) => ({
      originalName: file.originalname,
      filePath: file.path,
      mimetype: file.mimetype,
    }));

    const entry = registry.registerInputs({
      macroFileId,
      moduleName,
      files,
    });

    return res.json({
      message: 'Input files uploaded successfully.',
      inputsUploadId: entry.inputsUploadId,
    });
  } catch (error) {
    return next(error);
  }
};

const runMacro = async (req, res, next) => {
  try {
    const { macroFileId, moduleName, inputsUploadId } = req.body;

    if (!macroFileId || !moduleName) {
      return res.status(400).json({ message: 'macroFileId and moduleName are required.' });
    }

    const macro = registry.getMacro(macroFileId);
    if (!macro) {
      return res.status(404).json({ message: 'Macro file not found.' });
    }

    if (inputsUploadId) {
      const inputGroup = registry.getInputs(inputsUploadId);
      if (!inputGroup) {
        return res.status(404).json({ message: 'Input files group not found.' });
      }
    }

    const execution = await executeMacro({
      macroFilePath: macro.filePath,
      moduleName,
    });

    const outputEntry = registry.registerOutput({
      sourceMacroFileId: macroFileId,
      moduleName,
      filePath: execution.outputPath,
      fileName: execution.outputFileName,
    });

    return res.json({
      message: 'Macro executed successfully.',
      outputFileId: outputEntry.outputFileId,
    });
  } catch (error) {
    return next(error);
  }
};

const downloadOutput = async (req, res, next) => {
  try {
    const { fileId } = req.params;

    const output = registry.getOutput(fileId);
    if (!output) {
      return res.status(404).json({ message: 'Output file not found.' });
    }

    if (!fs.existsSync(output.filePath)) {
      return res.status(404).json({ message: 'Output file is missing on disk.' });
    }

    return res.download(path.resolve(output.filePath), output.fileName);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  uploadMacroFile,
  analyzeMacro,
  uploadInputFiles,
  runMacro,
  downloadOutput,
};
