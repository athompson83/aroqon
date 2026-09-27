import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6">
        <div>
          <h1 className="text-lg font-semibold">Aroqon HQ</h1>
          <p className="text-sm text-muted-foreground">
            We will email you a one-time sign-in link.
          </p>
        </div>
        {error === "link" && (
          <p className="text-sm text-bad">
            That link has expired or was already used. Ask for a new one.
          </p>
        )}
        <LoginForm />
      </div>
    </div>
  );
}
