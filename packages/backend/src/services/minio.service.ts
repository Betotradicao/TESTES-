import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand, CreateBucketCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';

export class MinioService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    // Internal connection (backend -> MinIO)
    const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = process.env.MINIO_PORT || '9000';
    const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
    const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin123';
    const useSSL = process.env.MINIO_USE_SSL === 'true';
    this.bucketName = process.env.MINIO_BUCKET_NAME || 'employee-avatars';

    this.s3Client = new S3Client({
      endpoint: `${useSSL ? 'https' : 'http'}://${endpoint}:${port}`,
      region: 'us-east-1', // MinIO doesn't care about region, but SDK requires it
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true, // Required for MinIO
    });
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
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        Body: fileBuffer,
        ContentType: contentType,
      }));

      // Return the URL to access the file
      // Use separate config for public URLs (browser-accessible)
      const publicEndpoint = process.env.MINIO_PUBLIC_ENDPOINT || process.env.MINIO_ENDPOINT || 'localhost';
      const publicPort = process.env.MINIO_PUBLIC_PORT || process.env.MINIO_PORT || '9000';
      const publicUseSSL = process.env.MINIO_PUBLIC_USE_SSL === 'true' || process.env.MINIO_USE_SSL === 'true';

      // Don't include port if it's standard (80 for HTTP, 443 for HTTPS) or empty
      const shouldIncludePort = publicPort && publicPort !== '80' && publicPort !== '443';
      const portPart = shouldIncludePort ? `:${publicPort}` : '';

      return `${publicUseSSL ? 'https' : 'http'}://${publicEndpoint}${portPart}/${this.bucketName}/${fileName}`;
    } catch (error) {
      console.error('Error uploading file to MinIO:', error);
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
