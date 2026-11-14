import { Prisma } from "../generated/prisma/client.js";
import { randomCode } from "./codes.js";
import { prisma } from "./prisma.js";
import { deleteObjects, photoObjectKeys } from "./storage.js";

/**
 * Takes a user out of their couple (leaving, being removed by the partner, or deleting the account).
 * The couple's places, dates and albums stay with whoever remains; the last one out takes the couple
 * and all of it, photo files included, with them.
 *
 * What only made sense inside the couple goes: the user's reactions there and partner-issued reset
 * codes between the two. What they wrote (memos, comments, dates) stays, as theirs. The invite code
 * changes so a removed partner can't simply join again.
 */
export async function removeFromCouple(userId: number) {
  const orphanedKeys = await prisma.$transaction(
    async (tx) => {
      const { coupleId } = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { coupleId: true } });
      if (coupleId === null) return [];
      await tx.reaction.deleteMany({ where: { userId, coupleId } });
      await tx.passwordResetCode.deleteMany({ where: { viaEmail: false, OR: [{ userId }, { issuedById: userId }] } });
      await tx.user.update({ where: { id: userId }, data: { coupleId: null } });

      if ((await tx.user.count({ where: { coupleId } })) > 0) {
        await tx.couple.update({ where: { id: coupleId }, data: { coupleCode: randomCode(6) } });
        return [];
      }
      const photos = await tx.photo.findMany({
        where: { album: { coupleId } },
        select: { storageKey: true, thumbnailKey: true },
      });
      // Everything the couple owns goes with it (onDelete: Cascade).
      await tx.couple.delete({ where: { id: coupleId } });
      return photos.flatMap(photoObjectKeys);
    },
    // Both leaving at once must not leave an empty couple behind.
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  // Files go after the rows, in the background: a failed delete is only logged, like other photo deletes.
  void deleteObjects(orphanedKeys);
}
