export type ToolkitSkillFile = {
  id: string;
  path: string;
  format: 'markdown' | 'text';
  bytes: number;
};

export type ToolkitSkillSummary = {
  id: string;
  name: string;
  description: string;
  entryFileId: string;
  files: ToolkitSkillFile[];
};

export type ToolkitSkillIndex = {
  status: 'ready' | 'unavailable';
  packageName: string;
  packageVersion: string | null;
  installationId: string | null;
  skills: ToolkitSkillSummary[];
  issues: string[];
};

export type ToolkitSkillDocument = {
  installationId: string;
  skillId: string;
  fileId: string;
  path: string;
  format: 'markdown' | 'text';
  content: string;
};
