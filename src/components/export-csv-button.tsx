import { Button } from "@/components/ui/button";

/** A server-renderable "Export CSV" link button - just an <a download> styled as a Button, no client JS needed. */
export function ExportCsvButton({ href }: { href: string }) {
  return (
    <Button variant="outline" size="sm" nativeButton={false} render={<a href={href} download />}>
      Export CSV
    </Button>
  );
}
