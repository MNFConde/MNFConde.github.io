import { describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';
import { BODY_LIMITS, readJsonBody, readTextBody } from './http-body.js';

/** 把 Buffer 按给定边界切成若干片，模拟 node http 的 chunk 流 */
function chunked(buf, splits) {
  const chunks = [];
  let prev = 0;
  for (const at of splits) {
    chunks.push(buf.subarray(prev, at));
    prev = at;
  }
  chunks.push(buf.subarray(prev));
  return Readable.from(chunks.filter((c) => c.length > 0));
}

describe('readTextBody：分片边界不得损坏多字节字符（26-09-27 事故）', () => {
  it('整块发送：文本无损', async () => {
    const text = '中文测试 · 上下文窗口\n'.repeat(2000);
    const buf = Buffer.from(text, 'utf8');
    expect(await readTextBody(chunked(buf, []))).toBe(text);
  });

  it('分片边界落在多字节字符中间：仍无损（原实现逐片 += 会产出 U+FFFD）', async () => {
    const text = '推理模型的崛起。上下文窗口变得巨大，MoE 与注意力变体登场。'.repeat(500);
    const buf = Buffer.from(text, 'utf8');

    // 找出一个 3 字节字符的起始位，切在它的第 1、2 字节之后
    const splits = [];
    for (let i = 1; i < buf.length && splits.length < 40; i += 97) {
      if ((buf[i] & 0xc0) === 0x80) splits.push(i); // i 落在多字节字符的续字节上
    }
    expect(splits.length).toBeGreaterThan(0);

    const out = await readTextBody(chunked(buf, splits));
    expect(out).toBe(text);
    expect(out).not.toContain('\uFFFD');
  });

  it('每个字节一片（最恶劣分片）：仍无损', async () => {
    const text = '中文';
    const buf = Buffer.from(text, 'utf8');
    const splits = Array.from({ length: buf.length - 1 }, (_, i) => i + 1);
    expect(await readTextBody(chunked(buf, splits))).toBe(text);
  });

  it('空体 → 空字符串', async () => {
    expect(await readTextBody(Readable.from([]))).toBe('');
  });

  it('大小上限按字节计（超限抛错）', async () => {
    const buf = Buffer.from('中'.repeat(100), 'utf8'); // 300 字节
    await expect(readTextBody(chunked(buf, [150]), { limitBytes: 200 })).rejects.toThrow(/超限/);
  });
});

describe('readJsonBody', () => {
  it('大中文 JSON 往返：解析后与原文逐字相等', async () => {
    const md = '# 标题\n\n' + '上下文窗口变得巨大，MoE 与注意力变体登场。'.repeat(800);
    const buf = Buffer.from(JSON.stringify({ md }), 'utf8');
    const splits = [];
    for (let i = 1; i < buf.length && splits.length < 60; i += 1021) {
      if ((buf[i] & 0xc0) === 0x80) splits.push(i);
    }
    const parsed = await readJsonBody(chunked(buf, splits));
    expect(parsed.md).toBe(md);
    expect(parsed.md).not.toContain('\uFFFD');
  });

  it('空体 → {}', async () => {
    expect(await readJsonBody(Readable.from([]))).toEqual({});
  });

  it('默认上限：binary 大于 json（图片搬运可放行大体积）', () => {
    expect(BODY_LIMITS.binary).toBeGreaterThan(BODY_LIMITS.json);
  });
});
