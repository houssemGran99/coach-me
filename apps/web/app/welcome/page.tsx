import { redirect } from "next/navigation";

/** The landing page now lives at the home page. Keep old /welcome links working. */
export default function Welcome(): never {
  redirect("/");
}
