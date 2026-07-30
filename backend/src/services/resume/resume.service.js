const fs = require("fs");
const pdfParse = require("pdf-parse-new");

async function extractResumeText(filePath) {
  const dataBuffer = fs.readFileSync(filePath);

  const pdfData = await pdfParse(dataBuffer);

  return pdfData.text;
}

module.exports = {
  extractResumeText,
};