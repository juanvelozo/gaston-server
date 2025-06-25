import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { bufferToStream } from 'src/utils/bufferToStream';

@Injectable()
export class CloudinaryService {
  async uploadImage(file: Express.Multer.File): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'profile_images',
        },
        (error, result) => {
          if (error instanceof Error) {
            reject(error);
          } else if (!result) {
            reject(new Error('Error desconocido al subir la imagen'));
          } else {
            resolve(result);
          }
        },
      );

      const stream = bufferToStream(file.buffer);
      stream.pipe(uploadStream);
    });
  }
}
