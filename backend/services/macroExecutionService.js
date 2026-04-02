const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const outputDir = path.join(__dirname, '..', 'outputs');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const securityPatterns = [/WScript\.Shell/i, /CreateObject\("Scripting\.FileSystemObject"\)/i, /Shell\s*\(/i];

const runMacroSecurityChecks = (moduleName) => {
  const match = securityPatterns.some((pattern) => pattern.test(moduleName));
  if (match) {
    throw new Error('Macro blocked by security policy due to suspicious pattern.');
  }
};

const runPowerShellMacro = ({ macroFilePath, moduleName, outputPath }) =>
  new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'run_macro.ps1');

    const processRef = spawn('powershell.exe', [
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
      '-WorkbookPath',
      macroFilePath,
      '-MacroName',
      moduleName,
      '-OutputPath',
      outputPath,
    ]);

    let stderr = '';
    let stdout = '';

    processRef.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    processRef.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    processRef.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`PowerShell execution failed: ${stderr || stdout}`));
        return;
      }

      resolve({ logs: stdout });
    });
  });

const executeMacro = async ({ macroFilePath, moduleName }) => {
  runMacroSecurityChecks(moduleName);

  const outputFileName = `${uuidv4()}-${path.basename(macroFilePath)}`;
  const outputPath = path.join(outputDir, outputFileName);

  if (process.platform === 'win32') {
    await runPowerShellMacro({ macroFilePath, moduleName, outputPath });
  } else {
    // Non-Windows fallback for development environments: create output copy.
    fs.copyFileSync(macroFilePath, outputPath);
  }

  return {
    outputPath,
    outputFileName,
  };
};

module.exports = {
  executeMacro,
};
