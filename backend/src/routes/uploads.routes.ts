import { Router } from 'express';
import multer from 'multer';
import { envelope } from '../dtos/common.dto.js';
import { AppError } from '../errors.js';
import { uploadImage } from '../infra/storage/supabaseStorage.js';
import { requireAuth } from '../middleware/auth.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/** Qualquer usuário autenticado (avatar de cliente, imagens de parceiro/admin). */
export const uploadsRouter = Router();

uploadsRouter.post('/image', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) throw new AppError('Nenhum arquivo enviado.', 400);
  const url = await uploadImage(req.file.buffer);
  res.json(envelope({ url }));
});
