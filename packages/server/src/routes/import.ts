import { Router } from 'express';
import multer from 'multer';
import { join } from 'path';
import { tmpdir } from 'os';
import { importExcelFile } from '../services/excel-importer.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
const upload = multer({ dest: join(tmpdir(), 'portfolio-uploads') });

router.post('/excel', upload.single('file'), (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const result = importExcelFile(userId, req.file.path);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/excel/path', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { path } = req.body;
  if (!path) {
    return res.status(400).json({ error: 'path is required' });
  }

  try {
    const result = importExcelFile(userId, path);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
