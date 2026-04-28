import { getCertificateStatus } from '@nexasign/lib/server-only/cert/cert-status';

export const loader = () => {
  try {
    const certStatus = getCertificateStatus();

    return Response.json({
      isAvailable: certStatus.isAvailable,
      transport: certStatus.transport,
      source: certStatus.source,
      filePath: certStatus.filePath,
      reason: certStatus.isAvailable ? undefined : certStatus.reason,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return Response.json(
      {
        isAvailable: false,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
};
