import React from 'react';

import { getExtraRecipientsType, getRecipientType } from '@nexasign/lib/client-only/recipient-type';
import type { TRecipientLite } from '@nexasign/lib/types/recipient';
import { recipientAbbreviation } from '@nexasign/lib/utils/recipient-formatter';

import { StackAvatar } from './stack-avatar';

export function StackAvatars({ recipients }: { recipients: TRecipientLite[] }) {
  const renderStackAvatars = (recipients: TRecipientLite[]) => {
    const zIndex = 50;
    const itemsToRender = recipients.slice(0, 5);
    const remainingItems = recipients.length - itemsToRender.length;

    return itemsToRender.map((recipient, index: number) => {
      const first = index === 0;

      if (index === 4 && remainingItems > 0) {
        return (
          <StackAvatar
            key="extra-recipient"
            first={first}
            zIndex={String(zIndex - index * 10)}
            type={getExtraRecipientsType(recipients.slice(4))}
            fallbackText={`+${remainingItems + 1}`}
          />
        );
      }

      return (
        <StackAvatar
          key={recipient.id}
          first={first}
          zIndex={String(zIndex - index * 10)}
          type={getRecipientType(recipient)}
          fallbackText={recipientAbbreviation(recipient)}
        />
      );
    });
  };

  return <>{renderStackAvatars(recipients)}</>;
}
