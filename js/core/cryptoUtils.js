class CryptoUtils {
  constructor() {
    this.algorithm = 'AES-GCM';
    this.keySize = 256;
    this.ivSize = 12;
    this.saltSize = 16;
    this.iterations = 100000;
  }

  async deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: this.iterations,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: this.algorithm, length: this.keySize },
      true,
      ['encrypt', 'decrypt']
    );
  }

  generateSalt() {
    return crypto.getRandomValues(new Uint8Array(this.saltSize));
  }

  generateIV() {
    return crypto.getRandomValues(new Uint8Array(this.ivSize));
  }

  async encrypt(data, password) {
    try {
      const encoder = new TextEncoder();
      const salt = this.generateSalt();
      const iv = this.generateIV();
      const key = await this.deriveKey(password, salt);

      const encodedData = encoder.encode(JSON.stringify(data));
      const encrypted = await crypto.subtle.encrypt(
        {
          name: this.algorithm,
          iv: iv
        },
        key,
        encodedData
      );

      const encryptedArray = new Uint8Array(encrypted);
      
      const result = new Uint8Array(
        this.saltSize + this.ivSize + encryptedArray.length
      );
      
      result.set(salt, 0);
      result.set(iv, this.saltSize);
      result.set(encryptedArray, this.saltSize + this.ivSize);

      return this.arrayBufferToBase64(result);
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('加密失败，请检查密码是否正确');
    }
  }

  async decrypt(encryptedData, password) {
    try {
      const decoder = new TextDecoder();
      const dataArray = this.base64ToArrayBuffer(encryptedData);

      const salt = dataArray.slice(0, this.saltSize);
      const iv = dataArray.slice(this.saltSize, this.saltSize + this.ivSize);
      const encrypted = dataArray.slice(this.saltSize + this.ivSize);

      const key = await this.deriveKey(password, salt);

      const decrypted = await crypto.subtle.decrypt(
        {
          name: this.algorithm,
          iv: iv
        },
        key,
        encrypted
      );

      const decoded = decoder.decode(decrypted);
      return JSON.parse(decoded);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('解密失败，请检查密码是否正确');
    }
  }

  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return this.arrayBufferToBase64(hashBuffer);
  }

  generateSecureId() {
    const array = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async verifyPassword(password, hash) {
    const computedHash = await this.hashString(password);
    return computedHash === hash;
  }
}

const cryptoUtils = new CryptoUtils();

export { cryptoUtils, CryptoUtils };
