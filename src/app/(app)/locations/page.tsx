import { listLocations } from "@/lib/actions/locations";
import { LocationDialog } from "./location-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Pencil, MapPin } from "lucide-react";

export default async function LocationsPage() {
  const locations = await listLocations();
  const byId = new Map(locations.map((l) => [l.id, l]));

  return (
    <div>
      <PageHeader
        eyebrow="Reference Data"
        title="Locations"
        description="Physical places — buildings, floors, rooms."
        actions={<LocationDialog locations={locations} />}
      />

      <div className="rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>City</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <MapPin className="size-8 opacity-40" />
                    <p className="text-sm">No locations yet.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {locations.map((location) => (
              <TableRow key={location.id}>
                <TableCell className="font-medium">{location.name}</TableCell>
                <TableCell>
                  {location.parentLocationId
                    ? (byId.get(location.parentLocationId)?.name ?? "—")
                    : "—"}
                </TableCell>
                <TableCell>{location.city ?? "—"}</TableCell>
                <TableCell>{location.state ?? "—"}</TableCell>
                <TableCell>
                  <LocationDialog
                    locations={locations}
                    editing={location}
                    trigger={
                      <Button variant="ghost" size="icon" className="size-8">
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
    </div>
  );
}
