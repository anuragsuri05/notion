// Moving AI: calls Claude straight from the browser with the user's own API key
// (stored locally in Settings → Moving AI).
import Anthropic from '@anthropic-ai/sdk';
import { useStore, pageTitle } from '../store/store';
import { blocksToMarkdown, markdownToBlocks } from './markdown';
import { fuzzy, blocksText } from './util';

export const AI_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', desc: 'Most capable for everyday work (default)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', desc: 'Fast and capable' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', desc: 'Fastest, lowest cost' },
  { id: 'claude-fable-5-1', label: 'Claude Fable 5.1', desc: 'Anthropic’s most capable model' },
];

export class AIKeyMissing extends Error {
  constructor() { super('Add your Anthropic API key in Settings → Moving AI to use AI features.'); }
}

function client() {
  const key = useStore.getState().settings.aiKey;
  if (!key) throw new AIKeyMissing();
  return new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
}

function model() {
  return useStore.getState().settings.aiModel || 'claude-opus-5-5';
}

/** Server-side refusal fallback is supported on these models. */
function fallbackParams(m: string) {
  return m === 'claude-haiku-5-5' ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const };
}

const SYSTEM = `You are Moving AI, the writing and knowledge assistant built into Moving, a connected workspace for notes, docs, wikis and databases.
Write in clean Markdown that maps to blocks: # / ## / ### headings, - bullets, 1. numbered lists, - [ ] to-dos, > quotes, \`\`\`lang code fences, | tables |, and **bold** / *italic* / \`code\` inline.
Do not wrap the whole answer in a code fence. Do not add preambles like "Sure, here is" — output only the content requested.`;

export interface StreamOpts {
  prompt: string;
  context?: string;
  onText: (full: string) => void;
  signal?: AbortSignal;
  maxTokens?: number;
}

/** Stream a single completion. Returns the full text. */
export async function streamText({ prompt, context, onText, signal, maxTokens = 8000 }: StreamOpts): Promise<string> {
  const c = client();
  const m = model();
  const content = context ? `<context>\n${context}\n</context>\n\n${prompt}` : prompt;
  const stream = c.beta.messages.stream({
    model: m,
    max_tokens: maxTokens,
    system: SYSTEM,
    messages: [{ role: 'user', content }],
    ...fallbackParams(m),
  } as any, { signal });
  let full = '';
  for await (const event of stream as any) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      full += event.delta.text;
      onText(full);
    }
  }
  const final = await (stream as any).finalMessage();
  if (final.stop_reason === 'refusal') throw new Error('Moving AI declined this request.');
  return full;
}

// ---------- Agent with workspace tools ----------

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_pages',
    description: 'Search the user\'s workspace pages by title and content. Returns up to 10 matches with id, title and a snippet.',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'], additionalProperties: false },
  },
  {
    name: 'read_page',
    description: 'Read the full content of a page as Markdown, by page id.',
    input_schema: { type: 'object', properties: { page_id: { type: 'string' } }, required: ['page_id'], additionalProperties: false },
  },
  {
    name: 'create_page',
    description: 'Create a new page in the workspace with Markdown content. Optionally nest it under a parent page id. Returns the new page id.',
    input_schema: {
      type: 'object',
      properties: { title: { type: 'string' }, markdown: { type: 'string' }, icon: { type: 'string', description: 'A single emoji' }, parent_id: { type: 'string' } },
      required: ['title', 'markdown'],
      additionalProperties: false,
    },
  },
  {
    name: 'append_to_page',
    description: 'Append Markdown content to the end of an existing page.',
    input_schema: { type: 'object', properties: { page_id: { type: 'string' }, markdown: { type: 'string' } }, required: ['page_id', 'markdown'], additionalProperties: false },
  },
];

function runTool(name: string, input: any): string {
  const s = useStore.getState();
  const title = (id: string) => pageTitle(s.pages[id]);
  switch (name) {
    case 'search_pages': {
      const q = String(input.query ?? '');
      const words = q.toLowerCase().split(/\s+/).filter(Boolean);
      const hits = Object.values(s.pages)
        .filter((p) => p.wsId === s.wsId && !p.trashedAt && !p.isTemplate)
        .map((p) => {
          const text = (p.title + '\n' + blocksText(p.content)).toLowerCase();
          const score = words.reduce((a, w) => a + (p.title.toLowerCase().includes(w) ? 3 : 0) + (text.includes(w) ? 1 : 0), 0);
          return { p, score, text };
        })
        .filter((x) => x.score > 0 || fuzzy(q, x.p.title))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((x) => ({ id: x.p.id, title: pageTitle(x.p), snippet: x.text.slice(0, 200) }));
      return JSON.stringify(hits);
    }
    case 'read_page': {
      const p = s.pages[input.page_id];
      if (!p) return 'Error: page not found';
      return `# ${pageTitle(p)}\n\n${blocksToMarkdown(p.content, title)}`;
    }
    case 'create_page': {
      const id = s.createPage({ title: input.title, icon: input.icon, parentId: input.parent_id && s.pages[input.parent_id] ? input.parent_id : null, content: markdownToBlocks(input.markdown ?? '') });
      return JSON.stringify({ id, url: `#/page/${id}` });
    }
    case 'append_to_page': {
      const p = s.pages[input.page_id];
      if (!p) return 'Error: page not found';
      const blocks = markdownToBlocks(input.markdown ?? '');
      s.mutateContent(p.id, (d) => { d.push(...blocks); });
      return 'Appended.';
    }
  }
  return 'Unknown tool';
}

export interface ChatMsg { role: 'user' | 'assistant'; content: string }
export interface AgentEvent { kind: 'text' | 'tool'; text: string }

/** Multi-turn chat with workspace tools. Streams assistant text; reports tool calls. */
export async function runAgent(history: ChatMsg[], opts: { pageContext?: string; onEvent: (e: AgentEvent) => void; signal?: AbortSignal }): Promise<string> {
  const c = client();
  const m = model();
  const s = useStore.getState();
  const system = `${SYSTEM}

You can search, read, and create pages in the user's workspace "${s.workspaces[s.wsId]?.name}" with the provided tools. Use them when the user asks about their content or asks you to create or update pages. Today is ${new Date().toDateString()}.${opts.pageContext ? `\n\nThe user currently has this page open:\n<page>\n${opts.pageContext}\n</page>` : ''}`;
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((h) => ({ role: h.role, content: h.content }));
  let transcript = '';
  for (let turn = 0; turn < 8; turn++) {
    const stream = c.beta.messages.stream({
      model: m,
      max_tokens: 16000,
      system,
      tools: TOOLS,
      messages,
      ...fallbackParams(m),
    } as any, { signal: opts.signal });
    for await (const event of stream as any) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        transcript += event.delta.text;
        opts.onEvent({ kind: 'text', text: transcript });
      }
    }
    const final: Anthropic.Beta.BetaMessage = await (stream as any).finalMessage();
    if (final.stop_reason === 'refusal') { transcript += '\n\n_Moving AI declined this request._'; opts.onEvent({ kind: 'text', text: transcript }); break; }
    messages.push({ role: 'assistant', content: final.content as any });
    if (final.stop_reason !== 'tool_use') break;
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const block of final.content) {
      if (block.type !== 'tool_use') continue;
      let out: string;
      let isError = false;
      try { out = runTool(block.name, block.input); } catch (e) { out = String(e); isError = true; }
      opts.onEvent({ kind: 'tool', text: describeTool(block.name, block.input as any) });
      results.push({ type: 'tool_result', tool_use_id: block.id, content: out, is_error: isError });
    }
    messages.push({ role: 'user', content: results });
    if (transcript && !transcript.endsWith('\n')) transcript += '\n\n';
  }
  return transcript;
}

function describeTool(name: string, input: any) {
  switch (name) {
    case 'search_pages': return `Searched workspace for “${input.query}”`;
    case 'read_page': return `Read “${pageTitle(useStore.getState().pages[input.page_id])}”`;
    case 'create_page': return `Created page “${input.title}”`;
    case 'append_to_page': return `Added content to “${pageTitle(useStore.getState().pages[input.page_id])}”`;
  }
  return name;
}

export const AI_PROMPTS: Record<string, string> = {
  ai_continue: 'Continue writing from where the context ends. Match the tone and style. Write 1-3 paragraphs.',
  ai_summary: 'Summarize the page in a short paragraph followed by 3-6 key bullet points.',
  ai_actions: 'Extract all action items from the page as a Markdown to-do list (- [ ] item). Include owners and dates if mentioned.',
  improve: 'Improve the writing of the following text. Keep the meaning, fix flow and clarity. Output only the improved text.',
  fix: 'Fix spelling and grammar in the following text. Output only the corrected text.',
  shorter: 'Make the following text shorter while keeping the key points. Output only the result.',
  longer: 'Make the following text longer and more detailed. Output only the result.',
  simplify: 'Simplify the language of the following text. Output only the result.',
  professional: 'Rewrite the following text in a professional tone. Output only the result.',
  casual: 'Rewrite the following text in a casual, friendly tone. Output only the result.',
  explain: 'Explain the following text clearly and concisely.',
  translate: 'Translate the following text to {lang}. Output only the translation.',
};
