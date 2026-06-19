const express = require('express');
const multer  = require('multer');
const axios   = require('axios');
const FormData = require('form-data');
const path    = require('path');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

const PYTHON_API = process.env.PYTHON_API_URL || 'http://localhost:8000';

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/convert', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file provided.' });
  }

  //Check if uploaded files are in PDF format. Later will apply other format as well? 
  if (req.file.mimetype !== 'application/pdf') {
    return res.status(400).json({ error: 'File must be a PDF.' });
  }

  try {
    // req.body.pdf_filename is a plain text field decoded as UTF-8 by busboy —
    // safe for Japanese/CJK. The Content-Disposition filename header drops bytes
    // in 0x80-0x9F so req.file.originalname is unreliable for non-ASCII names.
    const pdfFilename = req.body.pdf_filename || req.file.originalname;

    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: 'application/pdf',
    });

    // pass the safe filename as a query param (always URL-encoded UTF-8)
    const response = await axios.post(
      `${PYTHON_API}/convert?filename=${encodeURIComponent(pdfFilename)}`,
      form,
      {
        headers: form.getHeaders(),
        responseType: 'arraybuffer',  // ZIP is binary — must not be decoded as text
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="output.zip"');
    res.send(Buffer.from(response.data));
  } catch (err) {
    const detail = err.response?.data?.detail || err.message || 'Conversion failed.';
    console.error('[convert error]', detail);
    res.status(500).json({ error: detail });
  }
});

//Temporaly set port as 5555 
const PORT = process.env.PORT || 5555;
app.listen(PORT, () => {
  console.log(`Frontend: http://localhost:${PORT}`);
});
