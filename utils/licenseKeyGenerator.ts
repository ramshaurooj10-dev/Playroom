/**
 * Unique School License Key Generator
 * Format: SCH-XXXX-XXXX-XXXX
 * Uses uppercase characters excluding easily confused characters (O, 0, I, 1).
 */
export function generateSchoolLicenseKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const block = (len: number) => {
    let res = '';
    for (let i = 0; i < len; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };
  return `SCH-${block(4)}-${block(4)}-${block(4)}`;
}
