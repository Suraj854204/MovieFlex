// Server-side normalisation for user-generated text. React escapes on render,
// so we never emit HTML — this strips control/format characters and angle
// brackets as defence in depth and keeps stored data tidy.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩﻿]/g;

export function cleanText(input: string): string {
  return input.replace(CONTROL, '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
}

/** Chat messages: keep single spaces but preserve intentional newlines (max 2 in a row). */
export function cleanMessage(input: string): string {
  return input
    .replace(CONTROL, '')
    .replace(/[<>]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
