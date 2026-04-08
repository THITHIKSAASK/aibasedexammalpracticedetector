const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument();
const filePath = 'Institutional_Science_Protocol_2026.pdf';
doc.pipe(fs.createWriteStream(filePath));

// TITLE
doc.fontSize(25).text('Bannari Amman Institute - Science Syllabus', 100, 100);
doc.moveDown();

// SECTION 1: Cellular Biology
doc.fontSize(18).text('Section 1: Cellular Biology', { underline: true });
doc.fontSize(12).text('The mitochondria is the powerhouse of the cell, providing energy through ATP. Cells use DNA to store genetic information. Ribosomes are responsible for protein synthesis.');
doc.moveDown();

// SECTION 2: Physics & Energy
doc.fontSize(18).text('Section 2: Physics & Light', { underline: true });
doc.fontSize(12).text('The speed of light is approximately 299,792 kilometers per second. Einstein\'s theory of relativity (E=mc^2) defines the relationship between mass and energy.');
doc.moveDown();

// SECTION 3: Chemistry
doc.fontSize(18).text('Section 3: Simple Chemistry', { underline: true });
doc.fontSize(12).text('Hydrogen is the first element on the periodic table (Atomic Number 1). Oxygen is essential for human respiration and has an atomic weight of 16.');
doc.moveDown();

doc.end();
console.log(`Generated sample PDF: ${filePath}`);
