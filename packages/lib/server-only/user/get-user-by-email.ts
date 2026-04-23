import { prisma } from '@nexasign/prisma';

export interface GetUserByEmailOptions {
  email: string;
}

export const getUserByEmail = async ({ email }: GetUserByEmailOptions) => {
  return await prisma.user.findFirstOrThrow({
    where: {
      email: email.toLowerCase(),
    },
  });
};
