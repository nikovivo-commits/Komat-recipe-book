/* Reads a photo of the kitchen's whiteboard (or a paper list) with Claude and returns the lines to order.
   Used by send.mjs for photos taken with "Photo of the board" in the app. Needs the secret ANTHROPIC_API_KEY. */
import Anthropic from '@anthropic-ai/sdk';

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, qty: { type: 'string' }, section: { type: 'string' } },
        required: ['name', 'qty', 'section'],
        additionalProperties: false,
      },
    },
    note: { type: 'string' },
  },
  required: ['items', 'note'],
  additionalProperties: false,
};

const PROMPT = `This is a photo taken in a restaurant kitchen (Komat, Sofia). It shows the whiteboard, or a piece of paper, where the cooks write what the kitchen needs to order from suppliers.

List every product written on it that still needs ordering, one entry per product:
- name: the product as written, in its original language and spelling (usually Bulgarian), lower case unless it is a brand. Fix only obvious slips of the pen.
- qty: the amount exactly as written (e.g. "2 кг", "3 бр", "1 каса"), or "" if no amount is written.
- section: the heading of the column or block it is written under (the board is often split by supplier, e.g. "Зеленчук", "Месо", "Риба"), as written, or "" if none.
Leave out anything crossed out, wiped or ticked off as already ordered, and anything that is not a product to order (dates, names, prep tasks, notes, drawings, the board's frame).
If the photo shows no such list, return no items.
note: one short sentence in English about anything you could not read with confidence, or "" if everything was clear.`;

const client = new Anthropic();

/* bytes: a Buffer with the JPEG photo */
export async function readBoardPhoto(bytes, mediaType) {
  const res = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    /* if the model declines, the API retries on a fallback model inside the same call */
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: bytes.toString('base64') } },
        { type: 'text', text: PROMPT },
      ],
    }],
  });
  if (res.stop_reason === 'refusal') throw new Error('the photo was declined' + (res.stop_details && res.stop_details.category ? ' (' + res.stop_details.category + ')' : ''));
  if (res.stop_reason === 'max_tokens') throw new Error('the answer was cut off');
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const out = JSON.parse(text);
  const items = (out.items || []).map((i) => ({ name: String(i.name || '').trim(), qty: String(i.qty || '').trim(), section: String(i.section || '').trim() })).filter((i) => i.name);
  return { items, note: String(out.note || '').trim() };
}
