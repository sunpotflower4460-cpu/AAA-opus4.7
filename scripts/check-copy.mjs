import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const ledgerPath = new URL("docs/multilingual/translation-ledger.json", root);
const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
const read = (path) => readFileSync(new URL(path, root), "utf8");

function parse(source, name) {
  return ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function properties(object) {
  return new Map((object.properties ?? object.members).filter((item) => ts.isPropertyAssignment(item) || ts.isPropertySignature(item))
    .map((item) => [item.name.getText(), item]));
}

function declarations(file) {
  return new Map(file.statements.flatMap((statement) => {
    if (ts.isVariableStatement(statement)) {
      return statement.declarationList.declarations.map((item) => [item.name.getText(), item]);
    }
    if (ts.isTypeAliasDeclaration(statement)) return [[statement.name.getText(), statement]];
    return [];
  }));
}

const dictionary = declarations(parse(read("src/lib/i18n.ts"), "i18n.ts"));
const tsuzuri = declarations(parse(read("src/tsuzuri/messages.ts"), "tsuzuriMessages.ts"));
const bookCopy = (locale) => [...properties(tsuzuri.get(locale).initializer.expression)]
  .map(([key, node]) => [`tsuzuri.${key}`, node]);
const rescue = declarations(parse(read("src/i18n/rescueMessages.ts"), "rescueMessages.ts"));
const localeConstants = declarations(parse(read("src/i18n/locales.ts"), "locales.ts"));
const availableLocales = localeConstants.get("PUBLIC_UI_LOCALES").initializer.expression.elements.map((item) => item.text);
const rescueObject = rescue.get("rescueMessages").initializer.expression;
const rescueLocale = (locale) => rescueObject.properties.find((item) => item.name.getText() === locale).initializer;
const ja = new Map([...properties(dictionary.get("ja").initializer.expression), ...properties(rescueLocale("ja")), ...bookCopy("ja")]);
const en = new Map([...properties(dictionary.get("en").initializer.expression), ...properties(rescueLocale("en")), ...bookCopy("en")]);
const types = new Map([
  ...properties(dictionary.get("InterfaceMessages").type),
  ...properties(rescue.get("RescueMessages").type.types[1]),
  ...properties(rescue.get("CopyFeedback").type),
  ...bookCopy("ja").map(([key, node]) => [key, node.name]),
]);
const shared = ["NoteCount", "VersionCount", "DisplayDate", "PoeticLines", "jaCount", "enCount"]
  .map((name) => dictionary.get(name).getText());
const sourceGroups = ledger.groups;
const listed = sourceGroups.flatMap((group) => group.messages);
const covered = new Set(listed);
const problems = [];
const refresh = process.argv.includes("--refresh");
const release = process.argv.includes("--release");

if (JSON.stringify(availableLocales) !== JSON.stringify(ledger.publicLocales)) problems.push("Public language allowlist differs from the ledger.");
if (covered.size !== listed.length) problems.push("A message appears in more than one group.");
for (const key of new Set([...ja.keys(), ...en.keys(), ...types.keys(), ...covered])) {
  if (!covered.has(key) || !ja.has(key) || !en.has(key) || !types.has(key)) {
    problems.push(`Missing dictionary, type or ledger entry for ${key}.`);
  }
}

function checkTranslations(node, detail) {
  if (ts.isStringLiteralLike(node) && !node.text.trim()) problems.push(`Empty translation in ${detail}.`);
  ts.forEachChild(node, (child) => checkTranslations(child, detail));
}

for (const [locale, entries] of [["ja", ja], ["en", en]]) {
  for (const [key, node] of entries) checkTranslations(node.initializer, `${locale}.${key}`);
}

function fingerprint(group) {
  const entries = group.messages.map((key) => [key, types.get(key)?.getText(), ja.get(key)?.getText(), en.get(key)?.getText()]);
  const includedSources = (group.sources ?? []).map((path) => [path, read(path)]);
  const input = JSON.stringify([group.contract, entries, shared, includedSources]);
  return createHash("sha256").update(input).digest("hex");
}

let pending = 0;
for (const group of sourceGroups) {
  const hash = fingerprint(group);
  if (group.fingerprint !== hash) {
    if (refresh) {
      group.fingerprint = hash;
      group.review = "needs-review";
      group.evidence = null;
    } else {
      problems.push(`${group.id} changed. Refresh the ledger and review the affected surfaces.`);
    }
  }

  if (group.review === "needs-review") pending += 1;
  if (group.review !== "needs-review" && group.review !== "reviewed") problems.push(`Unknown review status in ${group.id}.`);
  if (group.review === "reviewed" && (!group.evidence?.candidate || !group.evidence?.copy || !group.evidence?.screens)) {
    problems.push(`Review evidence is incomplete in ${group.id}.`);
  }
}

if (release && pending > 0) problems.push(`${pending} groups still need wording and on-screen review.`);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
} else {
  if (refresh) writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n");
  console.log(`${listed.length} message IDs. ${pending}/${sourceGroups.length} groups need wording and on-screen review.`);
}
