import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth/AuthForm";

export const Route = createFileRoute("/login")({
  component: () => <AuthForm mode="login" />,
  head: () => ({
    meta: [
      { title: "Sign in — RideRite" },
      { name: "description", content: "Sign in to your RideRite account to book rides, manage trips, or access your driver hub across Florida." },
      { property: "og:title", content: "Sign in — RideRite" },
      { property: "og:description", content: "Sign in to your RideRite account to book rides, manage trips, or access your driver hub." },
      { property: "og:url", content: "https://getriderite.com/login" },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: "https://getriderite.com/login" }],
  }),
});
