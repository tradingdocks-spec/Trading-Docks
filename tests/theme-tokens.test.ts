import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const css = readFileSync("src/app/theme.css", "utf8");
function luminance(hex: string) {
  const channels = hex
    .replace("#", "")
    .match(/../g)!
    .map((c) => parseInt(c, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
for (const mode of ["dark", "light"])
  test(`${mode} theme text and action pairs meet 4.5:1 contrast`, () => {
    const block = css.match(
      new RegExp(`\\[data-theme="${mode}"\\]\\s*\\{([^}]+)`),
    )![1];
    const vars = Object.fromEntries(
      [...block.matchAll(/(--[\w-]+):\s*(#[a-f\d]{6})\b/gi)].map((m) => [
        m[1],
        m[2],
      ]),
    );
    const pairs = [
      ...["primary", "secondary", "muted"].flatMap((role) =>
        [
          "--td-background-primary",
          "--td-surface-default",
          "--td-surface-elevated",
        ].map((bg) => [`--td-text-${role}`, bg]),
      ),
      ["--td-on-accent", "--td-action-primary"],
      ...["success", "warning", "danger", "accent-text"].map((tone) => [
        `--td-${tone}`,
        "--td-surface-default",
      ]),
    ];
    for (const [fg, bg] of pairs) {
      assert.ok(vars[fg] && vars[bg], `missing ${fg}/${bg}`);
      const a = luminance(vars[fg]),
        b = luminance(vars[bg]);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      assert.ok(ratio >= 4.5, `${mode} ${fg} on ${bg}: ${ratio.toFixed(2)}:1`);
    }
  });
test("theme tokens do not directly reference themselves", () => {
  for (const match of css.matchAll(/(--[\w-]+):\s*var\((--[\w-]+)\)/g))
    assert.notEqual(match[1], match[2]);
});
