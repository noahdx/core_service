import crypto from 'crypto';

export class KashierSignature {
  /**
   * Verifies Kashier webhook HMAC-SHA256 signature according to Kashier documentation:
   * 1. Read signatureKeys array from data payload (or fallback to object keys).
   * 2. Sort signatureKeys alphabetically.
   * 3. For each key, URL-encode ONLY the value.
   * 4. Join pairs with '=' and concatenate with '&'.
   * 5. Compute HMAC-SHA256 hex digest keyed by webhook secret or api key.
   * 6. Compare with provided signature using timingSafeEqual.
   */
  static verify(payload: any, signature: string | undefined | null, secret: string): boolean {
    if (!signature || !secret || !payload) {
      return false;
    }

    try {
      const data = payload.data || payload;
      if (typeof data !== 'object' || data === null) {
        return false;
      }

      let keys: string[] = [];
      if (Array.isArray(data.signatureKeys) && data.signatureKeys.length > 0) {
        keys = [...data.signatureKeys];
      } else {
        keys = Object.keys(data).filter(
          (k) => k !== 'signature' && k !== 'signatureKeys' && k !== 'hash' && data[k] !== undefined && data[k] !== null,
        );
      }

      keys.sort();

      const queryString = keys
        .map((key) => {
          const val = data[key];
          const stringVal = val === undefined || val === null ? '' : String(val);
          return `${key}=${encodeURIComponent(stringVal)}`;
        })
        .join('&');

      const expectedSignature = crypto.createHmac('sha256', secret).update(queryString).digest('hex');

      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const receivedBuffer = Buffer.from(signature, 'utf8');

      if (expectedBuffer.length !== receivedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Helper to generate signature for testing or outbound calls
   */
  static generate(data: Record<string, any>, secret: string): string {
    const keys = Array.isArray(data.signatureKeys) && data.signatureKeys.length > 0
      ? [...data.signatureKeys]
      : Object.keys(data).filter((k) => k !== 'signature' && k !== 'signatureKeys' && k !== 'hash');

    keys.sort();

    const queryString = keys
      .map((key) => {
        const val = data[key];
        const stringVal = val === undefined || val === null ? '' : String(val);
        return `${key}=${encodeURIComponent(stringVal)}`;
      })
      .join('&');

    return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
  }
}
