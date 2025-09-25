import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // For GCM, 12 bytes is standard
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-dev-key-change-in-production-32-chars';

interface EncryptedData {
  encryptedData: string;
  iv: string;
  salt: string;
  tag: string;
}

export class CryptoService {
  private static deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
  }

  static encrypt(data: any): EncryptedData {
    try {
      const salt = crypto.randomBytes(SALT_LENGTH);
      const iv = crypto.randomBytes(IV_LENGTH);
      const key = this.deriveKey(ENCRYPTION_KEY, salt);
      
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      cipher.setAAD(Buffer.from('additional-auth-data'));
      
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      const tag = cipher.getAuthTag();
      
      return {
        encryptedData: encrypted,
        iv: iv.toString('base64'),
        salt: salt.toString('base64'),
        tag: tag.toString('base64')
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  static decrypt(encryptedDataObj: EncryptedData): any {
    try {
      const salt = Buffer.from(encryptedDataObj.salt, 'base64');
      const iv = Buffer.from(encryptedDataObj.iv, 'base64');
      const tag = Buffer.from(encryptedDataObj.tag, 'base64');
      const key = this.deriveKey(ENCRYPTION_KEY, salt);
      
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAAD(Buffer.from('additional-auth-data'));
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encryptedDataObj.encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  static isEncrypted(data: any): boolean {
    return data && typeof data === 'object' && 
           'encryptedData' in data && 
           'iv' in data && 
           'salt' in data && 
           'tag' in data;
  }

  // Helper method to safely encrypt credentials for storage
  static encryptCredentials(credentials: Record<string, any>): Record<string, any> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return {};
    }
    
    try {
      return this.encrypt(credentials);
    } catch (error) {
      console.error('Failed to encrypt credentials:', error);
      throw new Error('Credential encryption failed');
    }
  }

  // Helper method to safely decrypt credentials from storage
  static decryptCredentials(encryptedCredentials: Record<string, any>): Record<string, any> {
    if (!encryptedCredentials || Object.keys(encryptedCredentials).length === 0) {
      return {};
    }
    
    if (!this.isEncrypted(encryptedCredentials)) {
      // Handle legacy unencrypted data
      console.warn('Credentials are not encrypted - this should be addressed');
      return encryptedCredentials;
    }
    
    try {
      return this.decrypt(encryptedCredentials as EncryptedData);
    } catch (error) {
      console.error('Failed to decrypt credentials:', error);
      throw new Error('Credential decryption failed');
    }
  }
}