// src/cloudinary/cloudinary.service.ts → ahora supabase.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Readable } from 'stream';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly supabase: SupabaseClient;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('supabase.url');
    const supabaseKey = this.configService.get<string>('supabase.anonKey');
    this.bucketName =
      this.configService.get<string>('supabase.bucket') || 'uploads';

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    } else {
      this.logger.warn(
        'Supabase configuration missing. StorageService will not be able to upload files.',
      );
    }
  }

  private bufferToStream(buffer: Buffer): Readable {
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    return stream;
  }

  async uploadFile(
    file: Express.Multer.File,
  ): Promise<{ url: string; path: string }> {
    try {
      if (!this.supabase) {
        this.logger.warn('Storage disabled: Supabase not configured');
        return { url: '', path: '' };
      }
      const filePath = `${Date.now()}_${file.originalname}`;
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
        });

      if (error) throw error;

      const {
        data: { publicUrl },
      } = this.supabase.storage.from(this.bucketName).getPublicUrl(data.path);

      return { url: publicUrl, path: data.path };
    } catch (error) {
      this.logger.error('Error uploading file to Supabase', error);
      throw error;
    }
  }

  async deleteFile(path: string): Promise<boolean> {
    try {
      if (!this.supabase) return false;
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([path]);
      if (error) throw error;
      return true;
    } catch (error) {
      this.logger.error('Error deleting file from Supabase', error);
      return false;
    }
  }

  async deleteByUrl(url: string): Promise<boolean> {
    try {
      const bucketUrl = `${this.configService.get<string>('supabase.url')}/storage/v1/object/public/${this.bucketName}/`;
      const path = url.replace(bucketUrl, '');
      return await this.deleteFile(path);
    } catch (error) {
      this.logger.error('Error deleting file by URL', error);
      return false;
    }
  }
}
