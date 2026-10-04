import { safeReturnTo } from "../safeReturnTo";

describe("safeReturnTo", () => {
  it.each([
    ["/divisions/div-accra-comp-1?tab=roster", "/divisions/div-accra-comp-1?tab=roster"],
    ["https://evil.com", "/account"],
    ["//evil.com", "/account"],
    ["javascript:alert(1)", "/account"],
    ["/\\evil.com", "/account"],
    [undefined, "/account"],
    [["/a"], "/account"],
  ])("safeReturnTo(%p) -> %p", (input, expected) => {
    expect(safeReturnTo(input)).toBe(expected);
  });
});
