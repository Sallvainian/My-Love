import { assertEquals, assertFalse } from 'jsr:@std/assert@1';

import {
  buildDatePayload,
  buildInteractionPayload,
  buildLoveNotePayload,
  buildMoodPayload,
  buildPartnerAcceptPayload,
  buildPartnerRequestPayload,
  buildPhotoPayload,
  FALLBACK_REQUESTER_NAME,
  FALLBACK_SENDER_NAME,
  MOOD_LABELS,
  PICTURE_ONLY_BODY,
} from './payload.ts';

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

// ---- Story 3.4 ----

const thread = 'partner-activity';

Deno.test('a mood lists its labels in stored order, joined by a comma', () => {
  assertEquals(
    buildMoodPayload({ mood_type: 'happy', mood_types: ['happy', 'grateful'] }, 'Casey'),
    { aps: { alert: { title: 'Casey', body: 'Logged a mood: Happy, Grateful' }, 'thread-id': thread } }
  );
  assertEquals(
    buildMoodPayload({ mood_type: 'tired', mood_types: ['tired', 'sad', 'loved'] }, 'Casey').aps.alert.body,
    'Logged a mood: Tired, Sad, Loved'
  );
});

Deno.test('a mood with no mood_types uses mood_type', () => {
  assertEquals(buildMoodPayload({ mood_type: 'angry', mood_types: null }, 'Casey').aps.alert.body, 'Logged a mood: Angry');
  assertEquals(buildMoodPayload({ mood_type: 'angry', mood_types: [] }, 'Casey').aps.alert.body, 'Logged a mood: Angry');
});

Deno.test('unrecognised mood_types are dropped, and none valid falls back to mood_type', () => {
  assertEquals(
    buildMoodPayload({ mood_type: 'happy', mood_types: ['bogus', 'sad'] }, 'Casey').aps.alert.body,
    'Logged a mood: Sad'
  );
  assertEquals(
    buildMoodPayload({ mood_type: 'happy', mood_types: ['bogus'] }, 'Casey').aps.alert.body,
    'Logged a mood: Happy'
  );
});

Deno.test('a mood with no valid value says only that a mood was logged', () => {
  assertEquals(buildMoodPayload({ mood_type: 'bogus', mood_types: ['nope'] }, 'Casey').aps.alert.body, 'Logged a mood');
  assertEquals(buildMoodPayload({ mood_type: null, mood_types: null }, 'Casey').aps.alert.body, 'Logged a mood');
});

Deno.test('the 12 mood labels match MOOD_DISPLAY', () => {
  assertEquals(Object.keys(MOOD_LABELS).length, 12);
  assertEquals(
    Object.entries(MOOD_LABELS).map(([key, label]) => `${key}=${label}`),
    [
      'loved=Loved', 'happy=Happy', 'content=Content', 'excited=Excited', 'thoughtful=Thoughtful',
      'grateful=Grateful', 'sad=Sad', 'anxious=Anxious', 'frustrated=Frustrated', 'angry=Angry',
      'lonely=Lonely', 'tired=Tired',
    ]
  );
});

Deno.test('a photo, a poke and a kiss carry their R7 text on the partner thread', () => {
  assertEquals(buildPhotoPayload('Casey'), {
    aps: { alert: { title: 'Casey', body: 'Added a photo' }, 'thread-id': thread },
  });
  assertEquals(buildInteractionPayload('poke', 'Casey'), {
    aps: { alert: { title: 'Casey', body: 'Poked you' }, 'thread-id': thread },
  });
  assertEquals(buildInteractionPayload('kiss', 'Casey'), {
    aps: { alert: { title: 'Casey', body: 'Sent you a kiss' }, 'thread-id': thread },
  });
  assertEquals(buildInteractionPayload('fart', 'Casey'), null);
});

Deno.test('the partner payloads fall back to Your partner and carry no badge, sound or image', () => {
  for (const payload of [
    buildMoodPayload({ mood_type: 'happy', mood_types: null }, null),
    buildPhotoPayload('  '),
    buildInteractionPayload('poke', null)!,
  ]) {
    assertEquals(payload.aps.alert.title, FALLBACK_SENDER_NAME);
    assertEquals(Object.keys(payload), ['aps']);
    assertEquals(Object.keys(payload.aps).sort(), ['alert', 'thread-id']);
    assertFalse('badge' in payload.aps || 'sound' in payload.aps);
  }
});

Deno.test('a mood\'s note is never part of the payload', () => {
  const mood = { mood_type: 'happy', mood_types: ['happy'], note: 'private thoughts' };
  assertFalse(JSON.stringify(buildMoodPayload(mood, 'Casey')).includes('private'));
});

// ---- Story 3.5 ----

Deno.test('an event is named by its label, added or changed', () => {
  assertEquals(
    buildDatePayload({ subject: 'event', action: 'added', event_label: 'Paris trip' }, 'Casey'),
    { aps: { alert: { title: 'Casey', body: 'Added an event: Paris trip' }, 'thread-id': thread } }
  );
  assertEquals(
    buildDatePayload({ subject: 'event', action: 'changed', event_label: 'Paris trip' }, 'Casey').aps.alert.body,
    'Changed an event: Paris trip'
  );
});

Deno.test('the wedding date, the start date and a birthday each have a set and a changed body', () => {
  const body = (subject: 'wedding_date' | 'relationship_start' | 'birthday', action: 'added' | 'changed') =>
    buildDatePayload({ subject, action, event_label: null }, 'Casey').aps.alert.body;
  assertEquals(body('wedding_date', 'added'), 'Set the wedding date');
  assertEquals(body('wedding_date', 'changed'), 'Changed the wedding date');
  assertEquals(body('relationship_start', 'added'), 'Set the date you got together');
  assertEquals(body('relationship_start', 'changed'), 'Changed the date you got together');
  assertEquals(body('birthday', 'added'), 'Added their birthday');
  assertEquals(body('birthday', 'changed'), 'Changed their birthday');
});

Deno.test('a date payload falls back to Your partner and carries no badge, sound, image or date value', () => {
  const payload = buildDatePayload({ subject: 'wedding_date', action: 'added', event_label: null }, null);
  assertEquals(payload.aps.alert.title, FALLBACK_SENDER_NAME);
  assertEquals(Object.keys(payload), ['aps']);
  assertEquals(Object.keys(payload.aps).sort(), ['alert', 'thread-id']);
  assertEquals(payload.aps['thread-id'], thread);
  assertFalse(/\d/.test(payload.aps.alert.body));
});

// ---- Story 3.6 ----

Deno.test('a partner request says it was sent, titled with the asker or Someone', () => {
  assertEquals(buildPartnerRequestPayload('Riley'), {
    aps: { alert: { title: 'Riley', body: 'Sent you a partner request' }, 'thread-id': thread },
  });
  assertEquals(buildPartnerRequestPayload(null).aps.alert.title, FALLBACK_REQUESTER_NAME);
  assertEquals(buildPartnerRequestPayload('  ').aps.alert.title, 'Someone');
});

Deno.test('an acceptance says it was accepted, titled with the accepter or Your partner', () => {
  assertEquals(buildPartnerAcceptPayload('Quinn'), {
    aps: { alert: { title: 'Quinn', body: 'Accepted your partner request' }, 'thread-id': thread },
  });
  assertEquals(buildPartnerAcceptPayload(null).aps.alert.title, FALLBACK_SENDER_NAME);
});

Deno.test('the partner request payloads carry no badge, sound or image', () => {
  for (const payload of [buildPartnerRequestPayload('Riley'), buildPartnerAcceptPayload('Quinn')]) {
    assertEquals(Object.keys(payload), ['aps']);
    assertEquals(Object.keys(payload.aps).sort(), ['alert', 'thread-id']);
    assertFalse('badge' in payload.aps || 'sound' in payload.aps);
  }
});
