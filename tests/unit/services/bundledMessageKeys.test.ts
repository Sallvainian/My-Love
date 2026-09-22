/**
 * The bundled-favorite server key rests on one assumption: every bundled
 * message text is unique. Bundled ids are device-local autoincrement values,
 * so `message_favorites` keys a favorite by `b:<sha-256 of the text>`
 * (`messageFavoritesApi.bundledMessageKey`). Two identical texts would share
 * one key, and favoriting either would light up both on every device.
 */
import { describe, expect, it } from 'vitest';
import defaultMessages from '../../../src/data/defaultMessages';
import { bundledMessageKey } from '../../../src/services/messageFavoritesApi';

describe('bundled message texts', () => {
  it('are all unique, exactly as written', () => {
    const texts = defaultMessages.map((message) => message.text);
    const duplicates = texts.filter((text, index) => texts.indexOf(text) !== index);

    expect(duplicates).toEqual([]);
    expect(new Set(texts).size).toBe(defaultMessages.length);
  });

  it('map to distinct favorite keys', async () => {
    const keys = await Promise.all(defaultMessages.map((message) => bundledMessageKey(message.text)));

    expect(new Set(keys).size).toBe(defaultMessages.length);
  });
});
