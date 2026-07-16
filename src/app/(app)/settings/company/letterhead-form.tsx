"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateCompanyLetterhead, type ActionState } from "@/lib/actions/company-settings";

type Company = {
  letterheadNameLine1: string | null;
  letterheadNameLine2: string | null;
  letterheadTagline: string | null;
  letterheadOfficePhone: string | null;
  letterheadMobilePhone: string | null;
  letterheadFax: string | null;
  letterheadEmails: string | null;
  letterheadWebsite: string | null;
  letterheadAddress: string | null;
};

export function LetterheadForm({ company }: { company: Company }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateCompanyLetterhead, undefined);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    else if (state?.success) toast.success("Letterhead updated.");
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-6 max-w-2xl">
      <Card>
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Header
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="letterheadNameLine1">Company name (line 1)</Label>
            <Input id="letterheadNameLine1" name="letterheadNameLine1" defaultValue={company.letterheadNameLine1 ?? ""} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="letterheadNameLine2">Company name (line 2)</Label>
            <Input id="letterheadNameLine2" name="letterheadNameLine2" defaultValue={company.letterheadNameLine2 ?? ""} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="letterheadTagline">Tagline</Label>
            <Input id="letterheadTagline" name="letterheadTagline" defaultValue={company.letterheadTagline ?? ""} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Footer Contact Details
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="letterheadOfficePhone">Office phone(s)</Label>
            <Input id="letterheadOfficePhone" name="letterheadOfficePhone" defaultValue={company.letterheadOfficePhone ?? ""} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="letterheadMobilePhone">Mobile phone</Label>
            <Input id="letterheadMobilePhone" name="letterheadMobilePhone" defaultValue={company.letterheadMobilePhone ?? ""} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="letterheadFax">Fax</Label>
            <Input id="letterheadFax" name="letterheadFax" defaultValue={company.letterheadFax ?? ""} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="letterheadWebsite">Website</Label>
            <Input id="letterheadWebsite" name="letterheadWebsite" defaultValue={company.letterheadWebsite ?? ""} />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="letterheadEmails">Email(s)</Label>
            <Input id="letterheadEmails" name="letterheadEmails" defaultValue={company.letterheadEmails ?? ""} />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="letterheadAddress">Address</Label>
            <Input id="letterheadAddress" name="letterheadAddress" defaultValue={company.letterheadAddress ?? ""} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
