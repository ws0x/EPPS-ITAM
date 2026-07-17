import { listUsersFull, listRoles, listUsers } from "@/lib/actions/users";
import { listDepartments } from "@/lib/actions/departments";
import { listLocations } from "@/lib/actions/locations";
import { UserDialog } from "./user-dialog";
import { UsersTable } from "./users-table";
import { ListFilterBar } from "@/components/list-filter-bar";
import { ExportCsvButton } from "@/components/export-csv-button";
import { ListPagination } from "@/components/list-pagination";
import { PageHeader } from "@/components/page-header";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    page?: string;
    roleId?: string;
    departmentId?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const { search, page, roleId, departmentId, sort, dir } = await searchParams;
  const roleIds = roleId ? roleId.split(",").filter(Boolean) : [];
  const departmentIds = departmentId ? departmentId.split(",").filter(Boolean) : [];

  const [userResult, roles, departments, locations, managers] = await Promise.all([
    listUsersFull(search, {
      page: Number(page || "1"),
      roleIds,
      departmentIds,
      sort,
      dir: dir === "desc" ? "desc" : "asc",
    }),
    listRoles(),
    listDepartments(),
    listLocations(),
    listUsers(),
  ]);
  const userList = userResult.data;

  const exportParams = new URLSearchParams();
  if (search) exportParams.set("search", search);
  if (roleId) exportParams.set("roleId", roleId);
  if (departmentId) exportParams.set("departmentId", departmentId);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="People"
        title="Users"
        description={`${userResult.totalCount} total`}
        actions={
          <div className="flex items-center gap-3">
            <ExportCsvButton href={`/api/export/users?${exportParams.toString()}`} />
            <UserDialog roles={roles} departments={departments} locations={locations} managers={managers} />
          </div>
        }
      />

      <ListFilterBar
        placeholder="Search users..."
        persistKey="itam_users_filters"
        multiFilters={[
          { key: "roleId", label: "Role", options: roles.map((r) => ({ id: r.id, name: r.name.replace(/_/g, " ") })) },
          { key: "departmentId", label: "Department", options: departments },
        ]}
      />

      <UsersTable users={userList} roles={roles} departments={departments} locations={locations} managers={managers} />

      <ListPagination
        basePath="/users"
        page={userResult.page}
        totalPages={userResult.totalPages}
        totalCount={userResult.totalCount}
        limit={userResult.limit}
        itemLabel="users"
      />
    </div>
  );
}
