import { env } from '../utils/env';

export const NEXASIGN_ENCRYPTION_KEY = env('NEXT_PRIVATE_ENCRYPTION_KEY');

export const NEXASIGN_ENCRYPTION_SECONDARY_KEY = env('NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY');

// if (typeof window === 'undefined') {
//   if (!NEXASIGN_ENCRYPTION_KEY || !NEXASIGN_ENCRYPTION_SECONDARY_KEY) {
//     throw new Error('Missing NEXASIGN_ENCRYPTION_KEY or NEXASIGN_ENCRYPTION_SECONDARY_KEY keys');
//   }

//   if (NEXASIGN_ENCRYPTION_KEY === NEXASIGN_ENCRYPTION_SECONDARY_KEY) {
//     throw new Error(
//       'NEXASIGN_ENCRYPTION_KEY and NEXASIGN_ENCRYPTION_SECONDARY_KEY cannot be equal',
//     );
//   }
// }

// if (NEXASIGN_ENCRYPTION_KEY === 'CAFEBABE') {
//   console.warn('*********************************************************************');
//   console.warn('*');
//   console.warn('*');
//   console.warn('Please change the encryption key from the default value of "CAFEBABE"');
//   console.warn('*');
//   console.warn('*');
//   console.warn('*********************************************************************');
// }
