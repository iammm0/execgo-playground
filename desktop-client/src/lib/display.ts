const scenarioNames: Record<string, string> = {
  codegen_exec: "代码生成执行",
  vuln_scan: "漏洞扫描",
  multi_step_agent: "多步骤代理",
  long_chain_dag: "长链路任务图",
};

const chaosNames: Record<string, string> = {
  none: "无故障",
};

const frameworkNames: Record<string, string> = {
  langgraph: "图状态编排",
  crewai: "团队协作编排",
  autogen: "多代理会话编排",
};

export function formatScenarioName(id: string): string {
  return scenarioNames[id] ?? id;
}

export function formatChaosName(id: string): string {
  return chaosNames[id] ?? id;
}

export function formatFrameworkName(id: string): string {
  return frameworkNames[id] ?? id;
}

export function formatModeName(mode: string): string {
  if (mode === "live") {
    return "实时";
  }

  if (mode === "replay") {
    return "回放";
  }

  return mode;
}
