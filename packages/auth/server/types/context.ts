import type { RequestMetadata } from '@nexasign/lib/universal/extract-request-metadata';

export type HonoAuthContext = {
  Variables: {
    requestMetadata: RequestMetadata;
  };
};
