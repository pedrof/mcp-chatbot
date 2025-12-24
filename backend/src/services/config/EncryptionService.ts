import crypto from 'crypto'

export class EncryptionService {
  private algorithm = 'aes-256-cbc'
  private key: Buffer

  constructor(secret: string) {
    if (!secret || secret.length < 32) {
      throw new Error('APP_SECRET must be at least 32 characters')
    }
    // Derive a 32-byte key from the secret using a proper salt
    // Use SHA-256 hash of secret as salt for deterministic but unique key derivation
    const salt = crypto.createHash('sha256').update(secret).digest('hex').slice(0, 16)
    this.key = crypto.scryptSync(secret, salt, 32)
  }

  encrypt(text: string): string {
    if (!text) return ''

    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv)
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    // Return iv:encrypted format
    return iv.toString('hex') + ':' + encrypted
  }

  decrypt(text: string): string {
    if (!text) return ''

    const parts = text.split(':')
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted text format')
    }

    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = Buffer.from(parts[1], 'hex')
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv)

    let decrypted = decipher.update(encrypted)
    decrypted = Buffer.concat([decrypted, decipher.final()])

    return decrypted.toString('utf8')
  }

  maskKey(key: string): string {
    if (!key || key.length <= 8) return '***'
    return key.substring(0, 4) + '...' + key.substring(key.length - 4)
  }
}
