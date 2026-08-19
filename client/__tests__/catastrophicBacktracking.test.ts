import { describe, it } from "vitest";
import { preprocessMath } from "@/components/formatted-markdown";

describe("preprocessMath performance test", () => {
  it("tests catastrophic backtracking with unclosed parens or long text", () => {
    // 500 chars with an unclosed '('
    const testText = "Here is some text (and then some more text without a closing paren " + "word ".repeat(200);

    console.time("preprocessMath execution");
    preprocessMath(testText);
    console.timeEnd("preprocessMath execution");
  });
});
