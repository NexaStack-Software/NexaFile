import { Trans } from '@lingui/react/macro';

import { Link, Section, Text } from '../components';
import { useBranding } from '../providers/branding';

export type TemplateFooterProps = {
  isDocument?: boolean;
};

export const TemplateFooter = ({ isDocument = true }: TemplateFooterProps) => {
  const branding = useBranding();

  return (
    <Section>
      {isDocument && !branding.brandingHidePoweredBy && (
        <Text className="my-4 text-base text-slate-400">
          {/* Plain-Text statt Link — Self-Hoster kann über das Team-Branding
              (brandingCompanyDetails / brandingHidePoweredBy) einen eigenen
              Footer mit eigener URL ausspielen. Hier keinen externen Link
              hart-codieren, damit wir nie auf eine Domain zeigen, die der
              Deployer nicht kontrolliert. */}
          <Trans>This document was sent using NexaSign.</Trans>
        </Text>
      )}

      {branding.brandingEnabled && branding.brandingCompanyDetails && (
        <Text className="my-8 text-sm text-slate-400">
          {branding.brandingCompanyDetails.split('\n').map((line, idx) => {
            return (
              <>
                {idx > 0 && <br />}
                {line}
              </>
            );
          })}
        </Text>
      )}

      {/* NexaSign ist self-hosted — keine Zentral-Adresse. Wenn der Betreiber
          in den Team-Einstellungen ein eigenes Branding + Firmenadresse setzt,
          wird der obige Block mit `brandingCompanyDetails` gerendert. Ohne
          Branding-Config lassen wir diesen Footer-Abschnitt bewusst leer,
          damit keine falsche/NexaSign-Adresse in User-Emails auftaucht. */}
    </Section>
  );
};

export default TemplateFooter;
