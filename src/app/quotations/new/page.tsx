import { redirect } from "next/navigation";

/**
 * The billing screen moved to the landing page. This route is kept so older
 * links and bookmarks still land in the right place.
 */
export default function NewQuotationPage() {
  redirect("/");
}
