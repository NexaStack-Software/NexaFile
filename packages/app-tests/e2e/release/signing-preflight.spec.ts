import { expect, test } from '@playwright/test';

type CertificateStatusResponse = {
  isAvailable: boolean;
  transport?: string;
  source?: string;
  filePath?: string;
  reason?: string;
};

type HealthResponse = {
  status: 'ok' | 'warning' | 'error';
  checks: {
    certificate?: CertificateStatusResponse & {
      status?: 'ok' | 'warning' | 'error';
    };
  };
};

test.describe('Release signing preflight', () => {
  test('has a configured signing certificate before E2E signing flows run', async ({ request }) => {
    const certificateStatus = await request.get('/api/certificate-status');
    expect(certificateStatus.ok()).toBe(true);

    const certificateJson = (await certificateStatus.json()) as CertificateStatusResponse;
    expect(certificateJson, certificateJson.reason).toMatchObject({
      isAvailable: true,
    });

    const healthStatus = await request.get('/api/health');
    expect(healthStatus.ok()).toBe(true);

    const healthJson = (await healthStatus.json()) as HealthResponse;
    expect(healthJson.checks.certificate, healthJson.checks.certificate?.reason).toMatchObject({
      status: 'ok',
      isAvailable: true,
    });
  });
});
