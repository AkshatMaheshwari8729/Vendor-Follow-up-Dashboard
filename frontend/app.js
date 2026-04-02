const state = {
  macroFileId: null,
  macroFilename: null,
  modules: [],
  selectedModule: null,
  inputsUploadId: null,
  outputFileId: null,
};

const refs = {
  macroFileInput: document.getElementById('macroFileInput'),
  macroFileName: document.getElementById('macroFileName'),
  uploadMacroBtn: document.getElementById('uploadMacroBtn'),
  moduleList: document.getElementById('moduleList'),
  dynamicInputs: document.getElementById('dynamicInputs'),
  uploadInputsBtn: document.getElementById('uploadInputsBtn'),
  inputsForm: document.getElementById('inputsForm'),
  runMacroBtn: document.getElementById('runMacroBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  loader: document.getElementById('loader'),
  toast: document.getElementById('toast'),
  logSection: document.getElementById('logSection'),
  dropzone: document.getElementById('dropzone'),
};

const apiBase =
  window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin;

const showLoader = (show) => refs.loader.classList.toggle('hidden', !show);

const toast = (message, isError = false) => {
  refs.toast.textContent = message;
  refs.toast.className = `toast show${isError ? ' error' : ''}`;
  setTimeout(() => (refs.toast.className = 'toast'), 3000);
};

const setLogs = (text) => {
  refs.logSection.textContent = text || '';
};

const uploadMacro = async () => {
  const file = refs.macroFileInput.files[0];

  if (!file) {
    toast('Please choose a macro file first.', true);
    return;
  }

  const data = new FormData();
  data.append('macroFile', file);

  showLoader(true);
  setLogs('Uploading macro file...');

  try {
    const uploadRes = await fetch(`${apiBase}/upload-macro`, {
      method: 'POST',
      body: data,
    });

    const uploadJson = await uploadRes.json();
    if (!uploadRes.ok) {
      throw new Error(uploadJson.message || 'Upload failed');
    }

    state.macroFileId = uploadJson.fileId;
    state.macroFilename = uploadJson.filename;

    setLogs('Analyzing macro modules using Gemini...');

    const analyzeRes = await fetch(`${apiBase}/analyze-macro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: state.macroFileId }),
    });

    const analyzeJson = await analyzeRes.json();
    if (!analyzeRes.ok) {
      throw new Error(analyzeJson.message || 'Analysis failed');
    }

    state.modules = analyzeJson.modules || [];
    renderModules();
    toast('Macro uploaded and analyzed successfully.');
    setLogs(`Detected ${state.modules.length} module(s). Select one to continue.`);
  } catch (error) {
    toast(error.message, true);
    setLogs(`Error: ${error.message}`);
  } finally {
    showLoader(false);
  }
};

const renderModules = () => {
  refs.moduleList.innerHTML = '';

  if (!state.modules.length) {
    refs.moduleList.classList.add('empty');
    refs.moduleList.textContent = 'No modules detected.';
    return;
  }

  refs.moduleList.classList.remove('empty');

  state.modules.forEach((module) => {
    const card = document.createElement('div');
    card.className = 'module-card';
    card.innerHTML = `
      <strong>${module.name}</strong>
      <p>${module.description || 'No description available.'}</p>
      <small>Inputs: ${(module.inputs || []).join(', ') || 'None detected'}</small>
    `;

    card.addEventListener('click', () => {
      state.selectedModule = module;
      [...document.querySelectorAll('.module-card')].forEach((el) =>
        el.classList.remove('selected')
      );
      card.classList.add('selected');
      renderInputFields();
      refs.runMacroBtn.disabled = true;
      state.inputsUploadId = null;
      setLogs(`Selected module: ${module.name}`);
    });

    refs.moduleList.appendChild(card);
  });
};

const renderInputFields = () => {
  refs.dynamicInputs.innerHTML = '';

  const inputs = state.selectedModule?.inputs || [];
  if (!inputs.length) {
    refs.dynamicInputs.innerHTML = '<p class="muted">No input files required for this module.</p>';
    refs.uploadInputsBtn.disabled = false;
    return;
  }

  inputs.forEach((inputName, idx) => {
    const wrapper = document.createElement('div');
    const id = `input-file-${idx}`;
    wrapper.innerHTML = `
      <label for="${id}">${inputName}
        <input id="${id}" name="requiredInput${idx}" type="file" accept=".xlsx,.xlsm,.csv" required />
      </label>
    `;

    refs.dynamicInputs.appendChild(wrapper);
  });

  refs.uploadInputsBtn.disabled = false;
};

const uploadInputs = async (event) => {
  event.preventDefault();

  if (!state.selectedModule) {
    toast('Select a module first.', true);
    return;
  }

  const inputElements = refs.dynamicInputs.querySelectorAll('input[type="file"]');
  const data = new FormData();
  data.append('macroFileId', state.macroFileId);
  data.append('moduleName', state.selectedModule.name);

  for (const el of inputElements) {
    if (el.files[0]) {
      data.append('inputFiles', el.files[0]);
    }
  }

  showLoader(true);
  setLogs('Uploading input files...');

  try {
    const res = await fetch(`${apiBase}/upload-inputs`, {
      method: 'POST',
      body: data,
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Input upload failed');
    }

    state.inputsUploadId = json.inputsUploadId;
    refs.runMacroBtn.disabled = false;
    toast('Input files uploaded successfully.');
    setLogs(`Inputs uploaded. Upload ID: ${state.inputsUploadId}`);
  } catch (error) {
    toast(error.message, true);
    setLogs(`Error: ${error.message}`);
  } finally {
    showLoader(false);
  }
};

const runMacro = async () => {
  if (!state.selectedModule || !state.macroFileId) {
    toast('Upload and select a module first.', true);
    return;
  }

  showLoader(true);
  setLogs('Running macro... This may take time depending on Excel automation.');

  try {
    const res = await fetch(`${apiBase}/run-macro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        macroFileId: state.macroFileId,
        moduleName: state.selectedModule.name,
        inputsUploadId: state.inputsUploadId,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Macro execution failed');
    }

    state.outputFileId = json.outputFileId;
    refs.downloadBtn.disabled = false;
    toast('Macro executed successfully.');
    setLogs(`Macro executed successfully. Output ID: ${state.outputFileId}`);
  } catch (error) {
    toast(error.message, true);
    setLogs(`Error: ${error.message}`);
  } finally {
    showLoader(false);
  }
};

const downloadOutput = () => {
  if (!state.outputFileId) {
    toast('No output file available yet.', true);
    return;
  }

  window.open(`${apiBase}/download/${state.outputFileId}`, '_blank');
};

const wireDragAndDrop = () => {
  ['dragenter', 'dragover'].forEach((eventName) => {
    refs.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      refs.dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    refs.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      refs.dropzone.classList.remove('dragover');
    });
  });

  refs.dropzone.addEventListener('drop', (event) => {
    const [file] = event.dataTransfer.files;
    if (!file) {
      return;
    }

    const dt = new DataTransfer();
    dt.items.add(file);
    refs.macroFileInput.files = dt.files;
    refs.macroFileName.textContent = file.name;
  });
};

refs.macroFileInput.addEventListener('change', () => {
  refs.macroFileName.textContent = refs.macroFileInput.files[0]?.name || '';
});
refs.uploadMacroBtn.addEventListener('click', uploadMacro);
refs.inputsForm.addEventListener('submit', uploadInputs);
refs.runMacroBtn.addEventListener('click', runMacro);
refs.downloadBtn.addEventListener('click', downloadOutput);
wireDragAndDrop();

fetch(`${apiBase}/health`)
  .then((res) => {
    if (!res.ok) {
      throw new Error('Backend health check failed.');
    }
  })
  .catch(() => {
    setLogs(
      'Backend is not reachable. Start the server with: cd backend && npm install && npm run start'
    );
    toast('Backend is not running. Start backend server first.', true);
  });
