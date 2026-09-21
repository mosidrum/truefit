import { readFileSync } from "node:fs";
import { join } from "node:path";

const skillsDir = join(process.cwd(), "skills");

/** Loads a skill markdown file from `/skills/<name>.md` (repo root). */
export function loadSkill(name: string): string {
  return readFileSync(join(skillsDir, `${name}.md`), "utf8").trimEnd();
}
