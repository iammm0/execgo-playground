console.log(
  JSON.stringify({
    items: [
      { kind: "observation", value: "runtime health is green" },
      { kind: "artifact", value: "fixture scan emitted 2 findings" },
      { kind: "diagnostic", value: "timeline captured every stage" },
    ],
  }),
);
