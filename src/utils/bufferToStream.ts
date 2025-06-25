import { Readable } from 'stream';

// Función utilitaria para convertir un buffer en un stream
export function bufferToStream(buffer: Buffer): Readable {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
}
