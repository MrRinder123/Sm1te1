import fs from 'fs';
import path from 'path';
import { env } from '../config/env';

/**
 * Abstraction point for local file storage. Keep this contract stable so we can
 * swap local disk implementation with S3-backed storage later.
 */
export const storage = {
  ensureBaseDir() {
    fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
  },
  resolveUserAvatar(fileName: string) {
    return path.join(env.UPLOAD_DIR, 'avatars', fileName);
  }
};
