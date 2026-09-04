interface TimedSpan {
  spanId: string;
  parentSpanId: string | null;
  startedAt: string;
  durationMs: number;
}

/** Iterative traversal keeps malformed cycles and deep trees bounded. */
export function waterfallRows<T extends TimedSpan>(
  spans: T[],
  startedAt: string,
  durationMs: number,
) {
  const ids = new Set(spans.map((span) => span.spanId));
  const children = new Map<string, T[]>();
  for (const span of spans) {
    if (
      span.parentSpanId &&
      ids.has(span.parentSpanId) &&
      span.parentSpanId !== span.spanId
    ) {
      const list = children.get(span.parentSpanId) || [];
      list.push(span);
      children.set(span.parentSpanId, list);
    }
  }
  const rows: {
    span: T;
    depth: number;
    incomplete: boolean;
    offset: number;
    width: number;
  }[] = [];
  const seen = new Set<string>();
  const roots = spans.filter(
    (span) => !span.parentSpanId || !ids.has(span.parentSpanId),
  );
  const walk = (root: T, incomplete: boolean) => {
    const stack = [{ span: root, depth: 0, incomplete }];
    while (stack.length) {
      const entry = stack.pop()!;
      if (seen.has(entry.span.spanId)) continue;
      seen.add(entry.span.spanId);
      const offset =
        durationMs > 0
          ? Math.max(
              0,
              Math.min(
                100,
                ((Date.parse(entry.span.startedAt) - Date.parse(startedAt)) /
                  durationMs) *
                  100,
              ),
            )
          : 0;
      const width =
        durationMs > 0
          ? Math.max(
              0,
              Math.min(
                100 - offset,
                (entry.span.durationMs / durationMs) * 100,
              ),
            )
          : 0;
      rows.push({ ...entry, offset, width });
      for (const child of [
        ...(children.get(entry.span.spanId) || []),
      ].reverse())
        stack.push({ span: child, depth: entry.depth + 1, incomplete: false });
    }
  };
  for (const root of roots) walk(root, Boolean(root.parentSpanId));
  for (const span of spans) if (!seen.has(span.spanId)) walk(span, true);
  return rows;
}
