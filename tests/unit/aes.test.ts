import { describe, expect, it } from "vitest";

import { decryptSensitiveText, encryptSensitiveText } from "@/lib/crypto/aes";

describe("AES sensitive text crypto", () => {
  it("should encrypt and decrypt text correctly", () => {
    const source = "310101199901011234";
    const encrypted = encryptSensitiveText(source);

    expect(encrypted).not.toBe(source);
    expect(decryptSensitiveText(encrypted)).toBe(source);
  });
});
