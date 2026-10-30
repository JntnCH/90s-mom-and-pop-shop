import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /products was replaced by a placeholder and returned 404.
 * Redirect to /stock (working product list + stock view) until full master page is restored.
 */
export const Route = createFileRoute("/products")({
  beforeLoad: () => {
    throw redirect({ to: "/stock" });
  },
});
