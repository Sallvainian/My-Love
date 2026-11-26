import { assertEquals, assertFalse } from 'jsr:@std/assert@1';

import {
  buildAnniversaryPayload,
  buildDailyBothAnsweredPayload,
  buildDailyNudgePayload,
  buildDailyPartnerPickedPayload,
  buildDailyQuestionPayload,
  buildDailyReminderPayload,
  DAILY_SOUND,
  questionText,
  buildEventPayload,
  buildInteractionPayload,
  buildLoveNotePayload,
  buildMoodPayload,
  buildPartnerAcceptPayload,
  buildPartnerRequestPayload,
  buildPhotoPayload,
  FALLBACK_REQUESTER_NAME,
  FALLBACK_SENDER_NAME,
  LOVE_NOTES_THREAD_ID,
  MOOD_LABELS,
  PARTNER_ACTIVITY_THREAD_ID,
  PICTURE_ONLY_BODY,
  withBadge,
  withKind,
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

Deno.test('a love note stacks on love-notes and every other kind on partner-activity', () => {
  assertEquals(LOVE_NOTES_THREAD_ID, 'love-notes');
  assertEquals(PARTNER_ACTIVITY_THREAD_ID, 'partner-activity');
  assertEquals(buildLoveNotePayload({ content: 'Hi', image_url: null }, 'Casey').aps['thread-id'], 'love-notes');
  const others = [
    buildMoodPayload({ mood_type: 'happy', mood_types: null }, 'Casey'),
    buildPhotoPayload('Casey'),
    buildInteractionPayload('poke', 'Casey')!,
    buildInteractionPayload('kiss', 'Casey')!,
    buildPartnerRequestPayload('Casey'),
    buildPartnerAcceptPayload('Casey'),
    buildEventPayload('Paris trip', 'Casey'),
    buildAnniversaryPayload('First date', 'Casey'),
  ];
  for (const payload of others) assertEquals(payload.aps['thread-id'], 'partner-activity');
});

Deno.test('an added event or anniversary names it, titled with the partner or Your partner', () => {
  assertEquals(buildEventPayload('Paris trip', 'Casey'), {
    aps: { alert: { title: 'Casey', body: 'Added an event: Paris trip' }, 'thread-id': thread },
  });
  assertEquals(buildAnniversaryPayload('First date', 'Casey'), {
    aps: { alert: { title: 'Casey', body: 'Added an anniversary: First date' }, 'thread-id': thread },
  });
  for (const payload of [buildEventPayload('Paris trip', null), buildAnniversaryPayload('First date', ' ')]) {
    assertEquals(payload.aps.alert.title, FALLBACK_SENDER_NAME);
    assertEquals(Object.keys(payload.aps).sort(), ['alert', 'thread-id']);
  }
});

Deno.test('withBadge puts the count in aps.badge, zero included, and does not change its input', () => {
  const payload = buildPhotoPayload('Casey');
  const before = structuredClone(payload);
  assertEquals(withBadge(payload, 3).aps.badge, 3);
  assertEquals(withBadge(payload, 0).aps.badge, 0);
  assertEquals(withBadge(payload, 3).aps.alert, payload.aps.alert);
  assertEquals(withBadge(payload, 3).aps['thread-id'], payload.aps['thread-id']);
  assertEquals(payload, before);
  assertFalse('badge' in payload.aps);
});

Deno.test('withKind puts a top-level kind beside aps and does not change its input', () => {
  const payload = buildPhotoPayload('Casey');
  const before = structuredClone(payload);
  const tagged = withKind(payload, 'photo');
  assertEquals(tagged.kind, 'photo');
  assertEquals(tagged.aps, payload.aps);
  assertFalse('kind' in tagged.aps);
  assertEquals(payload, before);
  assertFalse('kind' in payload);
});

Deno.test('withBadge keeps a kind already on the payload', () => {
  const payload = withKind(buildPhotoPayload('Casey'), 'photo');
  const badged = withBadge(payload, 4);
  assertEquals(badged.kind, 'photo');
  assertEquals(badged.aps.badge, 4);
  assertEquals(withKind(badged, 'photo').aps.badge, 4);
});

// ---- Story 8.3: the five daily kinds (push-copy.md) ----

Deno.test('the question is worded as Daily words it', () => {
  assertEquals(questionText('Tea', 'Coffee'), 'Tea or Coffee?');
});

Deno.test('the morning push quotes the question and counts the day after the held streak', () => {
  assertEquals(buildDailyQuestionPayload('Tea or Coffee?', 4), {
    aps: {
      alert: { title: 'Tea or Coffee?', body: "Today's question is here. Day 5 is waiting." },
      'thread-id': PARTNER_ACTIVITY_THREAD_ID,
    },
  });
  assertEquals(buildDailyQuestionPayload('Tea or Coffee?', 0).aps.alert.body, "Today's question is here. Day 1 is waiting.");
});

Deno.test('a partner pick names the picker and has no choice, with Your partner as the fallback', () => {
  assertEquals(buildDailyPartnerPickedPayload('Casey'), {
    aps: {
      alert: { title: 'Casey made their pick', body: 'Pick yours to see what they chose.' },
      'thread-id': PARTNER_ACTIVITY_THREAD_ID,
    },
  });
  assertEquals(buildDailyPartnerPickedPayload(null).aps.alert.title, 'Your partner made their pick');
  assertEquals(buildDailyPartnerPickedPayload('  ').aps.alert.title, 'Your partner made their pick');
});

Deno.test('a nudge quotes the held streak, drops it at 0, and plays the default sound', () => {
  assertEquals(buildDailyNudgePayload('Casey', 12), {
    aps: {
      alert: { title: 'Casey nudged you', body: 'Your 12-day streak needs your pick today.' },
      'thread-id': PARTNER_ACTIVITY_THREAD_ID,
      sound: 'default',
    },
  });
  assertEquals(buildDailyNudgePayload('Casey', 1).aps.alert.body, 'Your 1-day streak needs your pick today.');
  assertEquals(buildDailyNudgePayload(null, 0).aps.alert, {
    title: 'Your partner nudged you',
    body: 'Your streak needs your pick today.',
  });
});

Deno.test('the 8 PM reminder has two variants, both with the default sound', () => {
  assertEquals(buildDailyReminderPayload('evening_self', 'Tea or Coffee?'), {
    aps: {
      alert: { title: "You haven't done your daily yet", body: 'Tea or Coffee? It takes two taps.' },
      'thread-id': PARTNER_ACTIVITY_THREAD_ID,
      sound: 'default',
    },
  });
  assertEquals(buildDailyReminderPayload('evening_partner', 'Casey'), {
    aps: {
      alert: { title: "Casey hasn't done their daily", body: 'Nudge them before midnight.' },
      'thread-id': PARTNER_ACTIVITY_THREAD_ID,
      sound: 'default',
    },
  });
  assertEquals(buildDailyReminderPayload('evening_partner', null).aps.alert.title, "Your partner hasn't done their daily");
});

Deno.test('both answered titles by the run: n days, 1 day, or none', () => {
  assertEquals(buildDailyBothAnsweredPayload(7, 'Casey', false), {
    aps: {
      alert: { title: '7 days in a row', body: "You both answered. See Casey's pick." },
      'thread-id': PARTNER_ACTIVITY_THREAD_ID,
    },
  });
  assertEquals(buildDailyBothAnsweredPayload(1, 'Casey', false).aps.alert, {
    title: '1 day in a row',
    body: "You both answered. See Casey's pick.",
  });
  assertEquals(buildDailyBothAnsweredPayload(0, 'Casey', false).aps.alert, {
    title: 'You both answered',
    body: "See Casey's pick.",
  });
  assertEquals(buildDailyBothAnsweredPayload(0, null, false).aps.alert.body, "See Your partner's pick.");
});

Deno.test('a late both answered replaces the pick sentence with That day counts.', () => {
  assertEquals(buildDailyBothAnsweredPayload(3, 'Casey', true).aps.alert, {
    title: '3 days in a row',
    body: 'You both answered. That day counts.',
  });
  assertEquals(buildDailyBothAnsweredPayload(1, 'Casey', true).aps.alert.body, 'You both answered. That day counts.');
  assertEquals(buildDailyBothAnsweredPayload(0, 'Casey', true).aps.alert, {
    title: 'You both answered',
    body: 'That day counts.',
  });
});

Deno.test('only the nudge and both 8 PM reminders carry a sound; the badge and kind are left to the handler', () => {
  const silent = [
    buildDailyQuestionPayload('Tea or Coffee?', 2),
    buildDailyPartnerPickedPayload('Casey'),
    buildDailyBothAnsweredPayload(2, 'Casey', false),
    buildDailyBothAnsweredPayload(2, 'Casey', true),
  ];
  for (const payload of silent) {
    assertFalse('sound' in payload.aps);
    assertFalse('badge' in payload.aps);
    assertFalse('kind' in payload);
  }
  for (const payload of [
    buildDailyNudgePayload('Casey', 2),
    buildDailyReminderPayload('evening_self', 'Tea or Coffee?'),
    buildDailyReminderPayload('evening_partner', 'Casey'),
  ]) {
    assertEquals(payload.aps.sound, DAILY_SOUND);
    assertEquals(DAILY_SOUND, 'default');
  }
});
