import { assertEquals, assertFalse } from 'jsr:@std/assert@1';

import { buildLoveNotePayload, FALLBACK_SENDER_NAME, PICTURE_ONLY_BODY } from './payload.ts';

Deno.test('a text note is titled with the sender and carries its text', () => {
  assertEquals(buildLoveNotePayload({ content: 'Thinking of you', image_url: null }, 'Casey'), {
    aps: {
      alert: { title: 'Casey', body: 'Thinking of you' },
      'thread-id': 'love-notes',
    },
  });
});

Deno.test('a picture-only note says a picture was sent', () => {
  const payload = buildLoveNotePayload({ content: ' ', image_url: 'abc/pic.jpg' }, 'Casey');
  assertEquals(payload.aps.alert.body, PICTURE_ONLY_BODY);
  assertEquals(PICTURE_ONLY_BODY, 'Sent you a picture');
});

Deno.test('a picture with a caption pushes the caption', () => {
  const payload = buildLoveNotePayload({ content: 'Look!', image_url: 'abc/pic.jpg' }, 'Casey');
  assertEquals(payload.aps.alert.body, 'Look!');
});

Deno.test('a sender with no name falls back', () => {
  assertEquals(buildLoveNotePayload({ content: 'Hi', image_url: null }, null).aps.alert.title, FALLBACK_SENDER_NAME);
  assertEquals(buildLoveNotePayload({ content: 'Hi', image_url: null }, '  ').aps.alert.title, FALLBACK_SENDER_NAME);
});

Deno.test('the payload carries no badge, sound or image', () => {
  const payload = buildLoveNotePayload({ content: 'Hi', image_url: 'x.jpg' }, 'Casey');
  assertEquals(Object.keys(payload), ['aps']);
  assertEquals(Object.keys(payload.aps).sort(), ['alert', 'thread-id']);
  assertFalse('badge' in payload.aps);
});
