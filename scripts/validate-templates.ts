import { EXPECTED } from "./lib/expected";
import { validateTemplates } from "./lib/templates";

const partial = process.argv.includes("--partial");
const { problems, practices } = validateTemplates({ partial });

if (problems.length) {
  for (const p of problems) console.error(`✗ ${p.file}: ${p.message}`);
  console.error(`\n${problems.length} problem(s) in ${practices.length} valid template(s).`);
  process.exit(1);
}
const reviewed = practices.filter((p) => p.review.status === "reviewed").length;
console.log(
  `✓ ${practices.length}/${EXPECTED.length} templates valid (${reviewed} reviewed, ${practices.length - reviewed} pending review).`,
);
