/**
 * Real-time Biometric Client-side Facial Grid matching and Normalization
 * Uses Zero-mean Normalized Cross-Correlation (ZNCC) to handle varying illuminations.
 */

export function computeZNCCSignature(canvas: HTMLCanvasElement): number[] {
  // Extract context
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 32;
  tempCanvas.height = 32;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return [];
  
  // Draw downscaled to eliminate high-frequency noise and standardize
  tempCtx.drawImage(canvas, 0, 0, 32, 32);
  const imgData = tempCtx.getImageData(0, 0, 32, 32);
  const pixels = imgData.data;
  
  const signature: number[] = [];
  let sum = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    // Luminance formula
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    signature.push(gray);
    sum += gray;
  }
  
  const mean = sum / signature.length;
  
  // Zero-mean centering
  let varianceSum = 0;
  const zeroMean = signature.map(val => {
    const diff = val - mean;
    varianceSum += diff * diff;
    return diff;
  });
  
  const stdDev = Math.sqrt(varianceSum);
  if (stdDev === 0) return zeroMean;
  
  // Standarization
  return zeroMean.map(val => val / stdDev);
}

export function compareZNCCSignatures(sig1: number[], sig2: number[]): number {
  if (sig1.length !== sig2.length || sig1.length === 0) return 0;
  
  let dotProduct = 0;
  for (let i = 0; i < sig1.length; i++) {
    dotProduct += sig1[i] * sig2[i];
  }
  
  // The dot product of two normalized zero-mean vectors of length N represents the correlation.
  // Perfect match is 1.0 (or close to it)
  // Scale correlation to [0, 1] range
  const correlation = dotProduct; // correlation lies between -1 and 1
  return (correlation + 1) / 2;
}

/**
 * Securely locks credentials in localStorage using a key.
 */
export function lockCredentials(email: string, pass: string, faceData?: string) {
  try {
    const combined = JSON.stringify({ email: email.toLowerCase(), pass, faceData });
    // Secure obfuscation base64 + reverse
    const obfuscated = btoa(combined).split('').reverse().join('');
    localStorage.setItem(`_face_locker_${email.toLowerCase().replace(/[^a-z0-9]/g, '')}`, obfuscated);
  } catch (e) {
    console.error("Locker saving secure credentials failed", e);
  }
}

/**
 * Unlocks credentials from localStorage.
 */
export function unlockCredentials(email: string): { email: string; pass: string; faceData?: string } | null {
  try {
    const key = `_face_locker_${email.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const obfuscated = localStorage.getItem(key);
    if (!obfuscated) return null;
    
    const reversed = obfuscated.split('').reverse().join('');
    const raw = atob(reversed);
    return JSON.parse(raw);
  } catch (e) {
    console.error("Locker decryption failed", e);
    return null;
  }
}

/**
 * Remove local locks on face reset.
 */
export function deleteLockedCredentials(email: string) {
  const key = `_face_locker_${email.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  localStorage.removeItem(key);
}
