/**
 * 标签/系列聚合纯函数（M7）。
 * 构建期消费：首页 chip 排（计数）、[slug] 系列上下文（序号 + 上下篇）；
 * 将来列表真需构建期分页时，过滤视图退静态路由（/tags/[tag]/ 等）复用同一批函数。
 * entries 形如 content collection 条目：{ id, data: { title, tags, series, seriesOrder, date } }。
 */

const zhCollate = (a, b) => a.localeCompare(b, 'zh');

/** 标签聚合：计数倒序，同计数中文名排序；无文章挂靠的标签天然不出场（反向聚合，无注册表） */
export function collectTags(entries) {
  const counts = new Map();
  for (const e of entries) {
    for (const t of e.data.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || zhCollate(a.tag, b.tag));
}

/** 系列聚合：按中文名排序（系列序在成员内部，不在索引层） */
export function collectSeries(entries) {
  const counts = new Map();
  for (const e of entries) {
    const s = e.data.series;
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => zhCollate(a.name, b.name));
}

/** 系列成员排序：seriesOrder 升序（缺序尾置），同位按日期升序兜底（连载先发先读） */
export function seriesMembers(entries, series) {
  return entries
    .filter((e) => e.data.series === series)
    .sort(
      (a, b) =>
        (a.data.seriesOrder ?? Infinity) - (b.data.seriesOrder ?? Infinity) ||
        (a.data.date?.getTime() ?? 0) - (b.data.date?.getTime() ?? 0)
    );
}

/** 当前文章在系列中的位置与上下篇；不在该系列内返回 null */
export function seriesContext(entries, series, currentId) {
  const members = seriesMembers(entries, series);
  const idx = members.findIndex((m) => m.id === currentId);
  if (idx === -1) return null;
  const brief = (m) => ({ id: m.id, title: m.data.title });
  return {
    index: idx + 1,
    total: members.length,
    prev: idx > 0 ? brief(members[idx - 1]) : null,
    next: idx < members.length - 1 ? brief(members[idx + 1]) : null,
  };
}
