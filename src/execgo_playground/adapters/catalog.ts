import { AutoGenAdapter } from "./autogen_adapter.js";
import { BaseAdapter } from "./base.js";
import { CrewAIAdapter } from "./crewai_adapter.js";
import { LangGraphAdapter } from "./langgraph_adapter.js";

export function listAdapters(): Record<string, new () => BaseAdapter> {
  return {
    langgraph: LangGraphAdapter,
    crewai: CrewAIAdapter,
    autogen: AutoGenAdapter,
  };
}

export function getAdapter(name: string): BaseAdapter {
  const Adapter = listAdapters()[name.toLowerCase()];
  if (!Adapter) {
    throw new Error(`unknown adapter ${name}`);
  }
  return new Adapter();
}
