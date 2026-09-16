import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth/AuthForm";

export const Route = createFileRoute("/signup")({
  component: () => <AuthForm mode="signup" />,
  head: () => ({
    meta: [
      { title: "Create your account — RideRite" },
      { name: "description", content: "Sign up for RideRite to book sedans, SUVs and trucks across Florida — or apply to drive and earn on your terms." },
      { property: "og:title", content: "Create your account — RideRite" },
      { property: "og:description", content: "Join RideRite to book rides or drive across Florida. Fast signup, email verification, instant access." },
      { property: "og:url", content: "https://getriderite.com/signup" },
    ],
    links: [{ rel: "canonical", href: "https://getriderite.com/signup" }],
  }),
});
