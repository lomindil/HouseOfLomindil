import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const tokenStorage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/tokens'),
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage: tokenStorage, limits: { fileSize: 2 * 1024 * 1024 } });

router.post('/', upload.single('image'), (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/tokens/${req.file.filename}` });
});

export default router;
