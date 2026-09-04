const test = require('node:test');
const assert = require('node:assert/strict');

const { handleChat, normalizeConversationHistory } = require('../src/chat');

test('normalizeConversationHistory trims, filters, caps, and drops duplicate latest user turn', () => {
  const rawHistory = [
    { role: 'assistant', content: '  First reply  ' },
    { role: 'ignored', content: 'skip me' },
    { role: 'user', content: '  First question  ' },
    { role: 'model', content: ' Second reply ' },
    { role: 'user', content: '  Follow up  ' },
    { role: 'user', content: '  Final question  ' },
    { role: 'assistant', content: '' },
  ];

  const normalized = normalizeConversationHistory(rawHistory, 'Final question');

  assert.deepEqual(normalized, [
    { role: 'assistant', content: 'First reply' },
    { role: 'user', content: 'First question' },
    { role: 'assistant', content: 'Second reply' },
    { role: 'user', content: 'Follow up' },
  ]);
});

test('handleChat sends the latest user message to Gemini only once', async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;

  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_MODEL = 'gemini-test';

  /** @type {{ contents?: { role: string, parts: { text: string }[] }[] }} */
  let capturedBody = {};

  global.fetch = async (_url, options = {}) => {
    capturedBody = JSON.parse(String(options.body));
    return {
      ok: true,
      async json() {
        return {
          candidates: [
            {
              content: {
                parts: [{ text: 'ok' }],
              },
            },
          ],
        };
      },
    };
  };

  try {
    const result = await handleChat({
      message: 'Why does that matter?',
      history: [
        { role: 'user', content: 'Tell me about liquidity' },
        { role: 'assistant', content: 'Liquidity matters for exits.' },
        { role: 'user', content: 'Why does that matter?' },
      ],
    });

    assert.equal(result.status, 200);
    assert.equal(result.payload.answer, 'ok');
    assert.deepEqual(capturedBody.contents, [
      { role: 'user', parts: [{ text: 'Tell me about liquidity' }] },
      { role: 'model', parts: [{ text: 'Liquidity matters for exits.' }] },
      { role: 'user', parts: [{ text: 'Why does that matter?' }] },
    ]);
  } finally {
    global.fetch = originalFetch;

    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }

    if (originalModel === undefined) {
      delete process.env.GEMINI_MODEL;
    } else {
      process.env.GEMINI_MODEL = originalModel;
    }
  }
});
