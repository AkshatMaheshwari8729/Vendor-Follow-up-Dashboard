const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const registryPath = path.join(__dirname, '..', 'uploads', 'registry.json');

const defaultRegistry = {
  macros: {},
  inputs: {},
  outputs: {},
};

const load = () => {
  if (!fs.existsSync(registryPath)) {
    fs.writeFileSync(registryPath, JSON.stringify(defaultRegistry, null, 2));
  }

  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
};

const save = (data) => {
  fs.writeFileSync(registryPath, JSON.stringify(data, null, 2));
};

const registerMacro = ({ filePath, originalName }) => {
  const db = load();
  const fileId = uuidv4();

  db.macros[fileId] = {
    fileId,
    filePath,
    originalName,
    createdAt: new Date().toISOString(),
  };

  save(db);
  return db.macros[fileId];
};

const getMacro = (fileId) => {
  const db = load();
  return db.macros[fileId];
};

const registerInputs = ({ macroFileId, moduleName, files }) => {
  const db = load();
  const inputsUploadId = uuidv4();

  db.inputs[inputsUploadId] = {
    inputsUploadId,
    macroFileId,
    moduleName,
    files,
    createdAt: new Date().toISOString(),
  };

  save(db);
  return db.inputs[inputsUploadId];
};

const getInputs = (inputsUploadId) => {
  const db = load();
  return db.inputs[inputsUploadId];
};

const registerOutput = ({ sourceMacroFileId, moduleName, filePath, fileName }) => {
  const db = load();
  const outputFileId = uuidv4();

  db.outputs[outputFileId] = {
    outputFileId,
    sourceMacroFileId,
    moduleName,
    filePath,
    fileName,
    createdAt: new Date().toISOString(),
  };

  save(db);
  return db.outputs[outputFileId];
};

const getOutput = (outputFileId) => {
  const db = load();
  return db.outputs[outputFileId];
};

module.exports = {
  registerMacro,
  getMacro,
  registerInputs,
  getInputs,
  registerOutput,
  getOutput,
};
