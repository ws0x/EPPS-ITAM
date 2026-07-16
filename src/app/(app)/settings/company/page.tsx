import { notFound } from "next/navigation";
import { getCompanyLetterhead } from "@/lib/actions/company-settings";
import { LetterheadForm } from "./letterhead-form";
import { PageHeader } from "@/components/page-header";

export default async function CompanySettingsPage() {
  const company = await getCompanyLetterhead();
  if (!company) notFound();

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Company Letterhead"
        description="Controls the header and footer shown on the Purchase Order PDF. The logo mark stays a fixed image; everything else here is plain text."
      />
      <LetterheadForm company={company} />
    </div>
  );
}
