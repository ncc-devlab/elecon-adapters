import type { MessagesEnrichParams } from "../types.js";

export const textMetadata: MessagesEnrichParams = {
  accountId: "synthetic-account",
  items: [{ conversationId: "synthetic-group", conversationKind: "group" }],
  fields: ["title", "hasContent", "lastMessageAt"],
};
export const avatars: MessagesEnrichParams = { ...textMetadata, fields: ["avatarImages"] };
export const invalidScalar: MessagesEnrichParams = {
  ...textMetadata,
  // @ts-expect-error A single field must still be an array.
  fields: "title",
};
export const invalidField: MessagesEnrichParams = {
  ...textMetadata,
  // @ts-expect-error Sending permission cannot be requested as optional metadata.
  fields: ["sendPermission"],
};
