/**
 * HTTP 请求体读取（dev 中间件共用）。
 *
 * 坑（26-09-27 实测，教训沉淀于 cairn/note-editor.md）：
 *   `for await (const chunk of req) data += chunk` —— chunk 是 Buffer，`+=` 触发隐式
 *   `toString('utf8')` 逐片解码。分片边界一旦落在多字节字符中间，两半各自解码各得一个
 *   U+FFFD，字符永久损坏。实测 73KB 中文文档经 /api/dev/render 往返即产生 2 个 U+FFFD，
 *   用原始 socket 强制在字符中间切分后升到 5 个；落盘的 lecture-notes.md 里同样残留 2 个。
 *   修复 = 收集 Buffer，整体 Buffer.concat 后一次性解码（TextDecoder 的流式语义）。
 *
 * 上限按「字节」计（原实现按 JS 字符数，中文实际可放行三倍字节量）。
 */
const JSON_LIMIT = 16_000_000; // md 全文（含大文档）
const BINARY_LIMIT = 64_000_000; // 图片搬运（base64 膨胀 ~1.33x）

export const BODY_LIMITS = { json: JSON_LIMIT, binary: BINARY_LIMIT };

/** 分片序列 → 完整 UTF-8 文本；跨片多字节字符由 Buffer.concat 保证完整 */
export async function readTextBody(stream, { limitBytes = JSON_LIMIT } = {}) {
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > limitBytes) {
      throw new Error(`请求体超限（${Math.round(limitBytes / 1024 / 1024)}MB）`);
    }
    chunks.push(buf);
  }
  return chunks.length === 0 ? '' : Buffer.concat(chunks).toString('utf8');
}

export async function readJsonBody(stream, options = {}) {
  const text = await readTextBody(stream, options);
  return text ? JSON.parse(text) : {};
}
