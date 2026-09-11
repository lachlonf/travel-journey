import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");

  return (
    <main className="admin admin-narrow">
      <p className="kicker">Journey</p>
      <h1>Admin</h1>
      <LoginForm />
    </main>
  );
}
