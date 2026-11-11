import { z } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { HttpError } from "../middlewares/error-handler.js";
import { prisma } from "./prisma.js";

// Reactions and comments the two leave on each other's photos and place memos.

export const REACTION_EMOJIS = ["❤️", "😍", "😂", "🥹", "👍", "🔥"] as const;

export const reactionBody = z.object({ emoji: z.enum(REACTION_EMOJIS) });
export const commentBody = z.object({ content: z.string().trim().min(1).max(300) });

export const feedbackInclude = {
  reactions: { select: { userId: true, emoji: true }, orderBy: { createdAt: "asc" } },
  comments: {
    orderBy: { createdAt: "asc" },
    select: { id: true, content: true, createdAt: true, writer: { select: { id: true, nickname: true } } },
  },
} as const satisfies Prisma.PhotoInclude & Prisma.PlaceNoteInclude;

/** What the feedback hangs on. Callers check it belongs to the couple before using it. */
export type FeedbackTarget = { photoId: number } | { noteId: number };

export async function loadFeedback(target: FeedbackTarget) {
  const [reactions, comments] = await Promise.all([
    prisma.reaction.findMany({ where: target, ...feedbackInclude.reactions }),
    prisma.comment.findMany({ where: target, ...feedbackInclude.comments }),
  ]);
  return { reactions, comments };
}

/** One reaction per person per photo or memo: picking another emoji replaces it. */
export async function setReaction(coupleId: number, userId: number, target: FeedbackTarget, emoji: string) {
  const where = "photoId" in target ? { userId_photoId: { userId, photoId: target.photoId } } : { userId_noteId: { userId, noteId: target.noteId } };
  await prisma.reaction.upsert({ where, create: { coupleId, userId, ...target, emoji }, update: { emoji } });
}

export async function clearReaction(userId: number, target: FeedbackTarget) {
  await prisma.reaction.deleteMany({ where: { userId, ...target } });
}

export async function addComment(coupleId: number, writerId: number, target: FeedbackTarget, content: string) {
  await prisma.comment.create({ data: { coupleId, writerId, ...target, content } });
}

/** Only the writer can take a comment back. */
export async function deleteComment(writerId: number, target: FeedbackTarget, commentId: number) {
  const { count } = await prisma.comment.deleteMany({ where: { id: commentId, writerId, ...target } });
  if (count === 0) throw new HttpError(404, "Not Found");
}

/** Who a notification about new feedback is from. */
export async function nicknameOf(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { nickname: true } });
  return user?.nickname ?? "";
}
