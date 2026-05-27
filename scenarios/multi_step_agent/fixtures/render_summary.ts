const normalized = JSON.parse(process.env.NORMALIZED_JSON ?? "{}") as { count: number; items: string[] };

console.log(
  JSON.stringify({
    summary: {
      status: "success",
      items: normalized.count,
    },
    evidence_count: normalized.count,
    evidence: normalized.items,
  }),
);
