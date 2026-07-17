import { describe, it, expect } from "vitest";
import { hasPermission, requirePermission, ForbiddenError, isDirectManagerOf } from "./permissions";
import type { CurrentUser } from "./dal";

function userWith(permissions: string[]): CurrentUser {
  return {
    id: "u1",
    email: "u1@example.com",
    firstName: null,
    lastName: null,
    companyId: "c1",
    departmentId: null,
    locationId: null,
    managerId: null,
    role: { id: "r1", name: "test-role", permissions },
  };
}

describe("hasPermission", () => {
  it("grants everything to a wildcard '*' role (admin)", () => {
    const admin = userWith(["*"]);
    expect(hasPermission(admin, "assets:checkout")).toBe(true);
    expect(hasPermission(admin, "anything:at_all")).toBe(true);
  });

  it("grants an exact permission string match", () => {
    const user = userWith(["assets:checkout"]);
    expect(hasPermission(user, "assets:checkout")).toBe(true);
    expect(hasPermission(user, "assets:edit")).toBe(false);
  });

  it("grants any action under a resource wildcard (e.g. 'assets:*')", () => {
    const itManager = userWith(["assets:*"]);
    expect(hasPermission(itManager, "assets:checkout")).toBe(true);
    expect(hasPermission(itManager, "assets:edit")).toBe(true);
    expect(hasPermission(itManager, "assets:anything")).toBe(true);
  });

  it("does not leak a resource wildcard to a different resource", () => {
    const itManager = userWith(["assets:*"]);
    expect(hasPermission(itManager, "licenses:edit")).toBe(false);
  });

  it("denies permissions not present at all", () => {
    const employee = userWith(["requests:create_own"]);
    expect(hasPermission(employee, "assets:checkout")).toBe(false);
  });
});

describe("requirePermission", () => {
  it("does not throw when the user has the permission", () => {
    const user = userWith(["assets:*"]);
    expect(() => requirePermission(user, "assets:checkout")).not.toThrow();
  });

  it("throws ForbiddenError when the user lacks the permission", () => {
    const user = userWith(["requests:create_own"]);
    expect(() => requirePermission(user, "assets:checkout")).toThrow(ForbiddenError);
  });
});

describe("isDirectManagerOf", () => {
  it("is true when managerId matches", () => {
    expect(isDirectManagerOf("mgr-1", { managerId: "mgr-1" })).toBe(true);
  });

  it("is false when managerId doesn't match or is null", () => {
    expect(isDirectManagerOf("mgr-1", { managerId: "mgr-2" })).toBe(false);
    expect(isDirectManagerOf("mgr-1", { managerId: null })).toBe(false);
  });
});
