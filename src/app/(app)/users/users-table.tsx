"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SortableTableHead } from "@/components/sortable-table-head";
import { useListFilters } from "@/hooks/use-list-filters";
import { UserDialog, type UserRow } from "./user-dialog";
import { Pencil, Users as UsersIcon } from "lucide-react";

type Option = { id: string; name: string };
type ManagerOption = { id: string; email: string; firstName: string | null; lastName: string | null };
type UserListRow = UserRow & { roleName: string; departmentName: string | null; locationName: string | null };

export function UsersTable({
  users,
  roles,
  departments,
  locations,
  managers,
}: {
  users: UserListRow[];
  roles: Option[];
  departments: Option[];
  locations: Option[];
  managers: ManagerOption[];
}) {
  const { getSort, toggleSort } = useListFilters({ persistKey: "itam_users_filters" });
  const { sort, dir } = getSort();

  return (
    <div className="rounded-lg border shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <SortableTableHead column="name" label="Name" sort={sort} dir={dir} onSort={toggleSort} />
            <TableHead>Email</TableHead>
            <SortableTableHead column="role" label="Role" sort={sort} dir={dir} onSort={toggleSort} />
            <SortableTableHead column="department" label="Department" sort={sort} dir={dir} onSort={toggleSort} />
            <TableHead>Location</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-12">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <UsersIcon className="size-8 opacity-40" />
                  <p className="text-sm">No users yet.</p>
                </div>
              </TableCell>
            </TableRow>
          )}
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">
                <Link href={`/users/${u.id}`} className="hover:text-primary hover:underline">
                  {u.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : u.username}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{u.email}</TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {u.roleName.replace(/_/g, " ")}
                </Badge>
              </TableCell>
              <TableCell>{u.departmentName ?? "-"}</TableCell>
              <TableCell>{u.locationName ?? "-"}</TableCell>
              <TableCell>
                {u.loginEnabled ? (
                  <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-500/10">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-destructive text-destructive bg-destructive/10">
                    Disabled
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <UserDialog
                  roles={roles}
                  departments={departments}
                  locations={locations}
                  managers={managers}
                  editing={u}
                  trigger={
                    <Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${u.firstName ?? u.email}`}>
                      <Pencil className="size-4" />
                    </Button>
                  }
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
