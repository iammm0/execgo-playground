const evidence = JSON.parse(process.env.EVIDENCE_JSON ?? "{}") as { items: Array<{ value: string }> };
const normalized = {
  items: evidence.items.map((item) => item.value),
  count: evidence.items.length,
  status: "normalized",
};

console.log(JSON.stringify(normalized));
