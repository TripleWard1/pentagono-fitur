import { redirect } from "next/navigation";

// Compatibilidade com ligações antigas: a rota profissional passa a ser /agenda.
export default function EcranRedirect() {
  redirect("/agenda");
}
