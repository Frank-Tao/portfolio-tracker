import { Router } from 'express';
import multer from 'multer';
import { join } from 'path';
import { tmpdir } from 'os';
import { importExcelFile } from '../services/excel-importer.js';

const router = Router();
const upload = multer({ dest: join(tmpdir(), 'portfolio-uploads') });

router.post('/excel', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const result = importExcelFile(req.file.path);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/excel/path', (req, res) => {
  const { path } = req.body;
  if (!path) {
    return res.status(400).json({ error: 'path is required' });
  }

  try {
    const result = importExcelFile(path);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
