import { SubscriptionStatus } from '@prisma/client';

import { prisma } from '@nexasign/prisma';

export type GetActiveSubscriptionsByUserIdOptions = {
  userId: number;
};

export const getActiveSubscriptionsByUserId = async ({
  userId,
}: GetActiveSubscriptionsByUserIdOptions) => {
  return await prisma.subscription.findMany({
    where: {
      organisation: {
        OR: [
          {
            ownerUserId: userId,
          },
          {
            members: {
              some: {
                userId,
              },
            },
          },
        ],
      },
      status: {
        not: SubscriptionStatus.INACTIVE,
      },
    },
  });
};
