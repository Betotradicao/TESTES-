import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand, CreateBucketCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';
import { ConfigurationService } from './configuration.service';

export class MinioService {
  private s3Client: S3Client;
  private bucketName: string;
  private endpoint: string = '';
  private port: string = '';
  private accessKey: string = '';
  private secretKey: string = '';
  private useSSL: boolean = false;

  constructor() {
    this.initializeClient();
  }

  /**
   * Initializes or reinitializes the MinIO client with current configuration
   * Loads from database first, falls back to .env if not found
   */
  private async initializeClient() {
    try {
      // Try to load from database first (allows dynamic updates)
      const configs = await ConfigurationService.getAll();

      // Internal connection (backend -> MinIO)
      this.endpoint = configs.minio_endpoint || process.env.MINIO_ENDPOINT || 'localhost';
      this.port = configs.minio_port || process.env.MINIO_PORT || '9000';
      this.accessKey = configs.minio_access_key || process.env.MINIO_ACCESS_KEY || 'minioadmin';
      this.secretKey = configs.minio_secret_key || process.env.MINIO_SECRET_KEY || 'minioadmin123';
      this.useSSL = (configs.minio_use_ssl || process.env.MINIO_USE_SSL) === 'true';
      this.bucketName = configs.minio_bucket_name || process.env.MINIO_BUCKET_NAME || 'employee-avatars';

      this.s3Client = new S3Client({
        endpoint: `${this.useSSL ? 'https' : 'http'}://${this.endpoint}:${this.port}`,
        region: 'us-east-1', // MinIO doesn't care about region, but SDK requires it
        credentials: {
          accessKeyId: this.accessKey,
          secretAccessKey: this.secretKey,
        },
        forcePathStyle: true, // Required for MinIO
      });

      console.log(`✅ MinIO client initialized: ${this.endpoint}:${this.port}`);
    } catch (error) {
      console.error('❌ Error initializing MinIO client:', error);
      // Fall back to .env only
      this.endpoint = process.env.MINIO_ENDPOINT || 'localhost';
      this.port = process.env.MINIO_PORT || '9000';
      this.accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
      this.secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin123';
      this.useSSL = process.env.MINIO_USE_SSL === 'true';
      this.bucketName = process.env.MINIO_BUCKET_NAME || 'employee-avatars';

      this.s3Client = new S3Client({
        endpoint: `${this.useSSL ? 'https' : 'http'}://${this.endpoint}:${this.port}`,
        region: 'us-east-1',
        credentials: {
          accessKeyId: this.accessKey,
          secretAccessKey: this.secretKey,
        },
        forcePathStyle: true,
      });

      console.log(`⚠️ MinIO client initialized from .env (fallback): ${this.endpoint}:${this.port}`);
    }
  }

  /**
   * Reinitializes the MinIO client with fresh configuration from database
   * Call this after saving new MinIO configuration
   */
  async reinitialize(): Promise<void> {
    console.log('🔄 Reinitializing MinIO client with updated configuration...');
    await this.initializeClient();
    console.log('✅ MinIO client reinitialized successfully');
  }

  /**
   * Ensures the bucket exists, creates it if it doesn't
   * Always applies CORS and public read policy
   * Should be called on application startup
   */
  async ensureBucketExists(): Promise<void> {
    try {
      // Try to check if bucket exists
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
      console.log(`MinIO bucket '${this.bucketName}' already exists`);
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        // Bucket doesn't exist, create it
        console.log(`Creating MinIO bucket '${this.bucketName}'...`);
        await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
        console.log(`MinIO bucket '${this.bucketName}' created successfully`);
      } else {
        console.error('Error checking/creating MinIO bucket:', error);
        throw error;
      }
    }

    // Always apply public read policy (even if bucket already existed)
    // Note: CORS is not needed as files are accessed directly via public URLs
    try {
      console.log(`Applying public read policy to bucket '${this.bucketName}'...`);
      const bucketPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucketName}/*`],
          },
        ],
      };

      await this.s3Client.send(new PutBucketPolicyCommand({
        Bucket: this.bucketName,
        Policy: JSON.stringify(bucketPolicy),
      }));

      console.log(`MinIO bucket '${this.bucketName}' configured with public read access`);
    } catch (error) {
      console.error('Error applying bucket policy:', error);
      throw error;
    }
  }

  /**
   * Uploads a file to MinIO
   * @param fileName The name to save the file as
   * @param fileBuffer The file buffer
   * @param contentType The MIME type of the file
   * @returns The URL of the uploaded file
   */
  async uploadFile(fileName: string, fileBuffer: Buffer, contentType: string): Promise<string> {
    try {
      console.log(`📤 MinIO: Enviando arquivo ${fileName} (${(fileBuffer.length / 1024).toFixed(2)} KB)`);
      console.log(`📤 MinIO: Bucket=${this.bucketName}, Endpoint=${this.endpoint}:${this.port}`);

      const uploadStart = Date.now();

      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        Body: fileBuffer,
        ContentType: contentType,
      }));

      const uploadDuration = Date.now() - uploadStart;
      console.log(`✅ MinIO: Arquivo enviado com sucesso em ${uploadDuration}ms`);

      // Return the URL to access the file
      // Use separate config for public URLs (browser-accessible)
      const configs: Record<string, any> = await ConfigurationService.getAll().catch(() => ({}));
      const publicEndpoint = (configs.minio_public_endpoint as string) || process.env.MINIO_PUBLIC_ENDPOINT || this.endpoint;
      const publicPort = (configs.minio_public_port as string) || process.env.MINIO_PUBLIC_PORT || this.port;
      const publicUseSSL = ((configs.minio_public_use_ssl as string) || process.env.MINIO_PUBLIC_USE_SSL) === 'true' || this.useSSL;

      // Don't include port if it's standard (80 for HTTP, 443 for HTTPS) or empty
      const shouldIncludePort = publicPort && publicPort !== '80' && publicPort !== '443';
      const portPart = shouldIncludePort ? `:${publicPort}` : '';

      const url = `${publicUseSSL ? 'https' : 'http'}://${publicEndpoint}${portPart}/${this.bucketName}/${fileName}`;
      console.log(`🔗 MinIO: URL gerada: ${url}`);

      return url;
    } catch (error) {
      console.error('❌ MinIO: Erro ao fazer upload:', error);
      console.error('❌ MinIO: Detalhes:', {
        fileName,
        bucket: this.bucketName,
        endpoint: `${this.endpoint}:${this.port}`,
        contentType,
        bufferSize: fileBuffer.length
      });
      throw new Error('Failed to upload file');
    }
  }

  /**
   * Deletes a file from MinIO
   * @param fileName The name of the file to delete
   */
  async deleteFile(fileName: string): Promise<void> {
    try {
      await this.s3Client.send(new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
      }));
      console.log(`File '${fileName}' deleted successfully from MinIO`);
    } catch (error) {
      console.error('Error deleting file from MinIO:', error);
      throw new Error('Failed to delete file');
    }
  }

  /**
   * Extracts the filename from a MinIO URL
   * @param url The full MinIO URL
   * @returns The filename only
   */
  extractFileNameFromUrl(url: string): string {
    const parts = url.split('/');
    return parts[parts.length - 1];
  }
}

// Singleton instance
export const minioService = new MinioService();
