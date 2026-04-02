const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const modelName = process.env.GEMINI_MODEL || 'gemini-3-pro';

const getWorkbookMetadata = async (filePath) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  return {
    worksheets: workbook.worksheets.map((sheet) => ({
      name: sheet.name,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
    })),
    definedNames: workbook.definedNames?.model || [],
  };
};

const fallbackModuleDetection = (metadata) => {
  const guesses = metadata.worksheets.slice(0, 5).map((sheet) => ({
    name: `Process_${sheet.name.replace(/\W+/g, '_')}`,
    description: `Heuristic module guess based on worksheet ${sheet.name}.`,
    inputs: [`${sheet.name} source data file`],
  }));

  return guesses.length
    ? guesses
    : [
        {
          name: 'MainMacro',
          description: 'Default macro fallback when no modules were inferable.',
          inputs: ['Primary input workbook'],
        },
      ];
};

const cleanJsonPayload = (rawText) => {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  return JSON.parse(candidate);
};

const analyzeMacroFile = async ({ filePath }) => {
  const metadata = await getWorkbookMetadata(filePath);
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return fallbackModuleDetection(metadata);
  }

  const prompt = `Analyze the following VBA macro content. Extract:\n\nMacro names\nPurpose of each macro\nAny required input files inferred from code\n\nReturn structured JSON only.\n\nWorkbook metadata:\n${JSON.stringify(
    metadata,
    null,
    2
  )}\n\nNote: If VBA source is unavailable, infer likely modules from worksheet names and metadata.`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelName
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('\n') || '[]';

  const parsed = cleanJsonPayload(text);

  if (!Array.isArray(parsed)) {
    throw new Error('Gemini response did not return an array of modules.');
  }

  return parsed.map((item) => ({
    name: item.name || item.macroName || 'UnnamedMacro',
    description: item.description || item.purpose || 'No description provided.',
    inputs: Array.isArray(item.inputs) ? item.inputs : [],
  }));
};

module.exports = {
  analyzeMacroFile,
};
