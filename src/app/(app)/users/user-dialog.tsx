"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createUserAccount, updateUserAccount, type ActionState } from "@/lib/actions/users";
import { Plus } from "lucide-react";

export type UserRow = {
  id: string;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  phone: string | null;
  employeeNumber: string | null;
  loginEnabled: boolean;
  roleId: string;
  departmentId: string | null;
  locationId: string | null;
  managerId: string | null;
};

export function UserDialog({
  roles,
  departments,
  locations,
  managers,
  editing,
  trigger,
}: {
  roles: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  managers: { id: string; email: string; firstName: string | null; lastName: string | null }[];
  editing?: UserRow;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const action = editing ? updateUserAccount : createUserAccount;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      setOpen(false);
    }
    wasPending.current = pending;
  }, [pending, state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm">
              <Plus /> Add User
            </Button>
          )
        }
      />
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit User" : "Add User"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update this user's profile and access." : "Creates a login account for this person."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}

            {!editing && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Temporary password</Label>
                  <Input id="password" name="password" type="text" minLength={8} required />
                  <p className="text-xs text-muted-foreground">Share this with the user; they can change it after signing in.</p>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" name="firstName" defaultValue={editing?.firstName ?? ""} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" name="lastName" defaultValue={editing?.lastName ?? ""} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="roleId">Role</Label>
              <Select name="roleId" defaultValue={editing?.roleId} required>
                <SelectTrigger id="roleId">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="departmentId">Department</Label>
                <Select name="departmentId" defaultValue={editing?.departmentId ?? undefined}>
                  <SelectTrigger id="departmentId">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="locationId">Location</Label>
                <Select name="locationId" defaultValue={editing?.locationId ?? undefined}>
                  <SelectTrigger id="locationId">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="managerId">Manager</Label>
              <Select name="managerId" defaultValue={editing?.managerId ?? undefined}>
                <SelectTrigger id="managerId">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {managers
                    .filter((m) => m.id !== editing?.id)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.firstName ? `${m.firstName} ${m.lastName ?? ""}`.trim() : m.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="jobTitle">Job title</Label>
                <Input id="jobTitle" name="jobTitle" defaultValue={editing?.jobTitle ?? ""} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" defaultValue={editing?.phone ?? ""} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="employeeNumber">Employee number</Label>
              <Input id="employeeNumber" name="employeeNumber" defaultValue={editing?.employeeNumber ?? ""} />
            </div>

            {editing && (
              <div className="flex items-center gap-2">
                <Checkbox id="loginEnabled" name="loginEnabled" defaultChecked={editing.loginEnabled} />
                <Label htmlFor="loginEnabled" className="font-normal">Login enabled</Label>
              </div>
            )}

            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : editing ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
