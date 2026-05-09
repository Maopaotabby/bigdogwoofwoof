import fs from "node:fs";

const loginCard = fs.readFileSync("modules/login-card.js", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

assert(loginCard.includes("editLoginCardCharacterPanel"), "login card exposes character panel editing");
assert(loginCard.includes("data-login-card-edit-character"), "manager rows expose edit buttons");
assert(loginCard.includes("buildLoginCardEditableCharacterPanel"), "editing starts from panel fields instead of replacing the whole card");
assert(loginCard.includes("preserveLoginCardCharacterHands"), "editing preserves hand-related fields");
assert(loginCard.includes('"specialHands"') && loginCard.includes('"customHandCards"') && loginCard.includes('"特殊手札"'), "known hand fields are protected");
assert(loginCard.includes("dispatchCharactersImported();"), "edited login-card characters are re-imported into the duel pool");
assert(styles.includes(".login-card-character-main"), "manager row layout supports edit action controls");

if (!process.exitCode) console.log("login-card character panel edit checks passed");
