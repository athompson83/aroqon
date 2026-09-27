import { Mail } from "@/components/mail/mail";
import { loadDashboard } from "@/lib/hq";
import { organize } from "@/lib/mail-organize";
import { fetchMail } from "@/lib/resend";

export const dynamic = "force-dynamic";

export default async function MailPage() {
  const [data, mail] = await Promise.all([loadDashboard(), fetchMail()]);
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {mail.error && (
        <p className="border-b bg-card px-4 py-2 text-sm text-bad">Resend: {mail.error}</p>
      )}
      <div className="min-h-0 flex-1">
        <Mail mails={organize(mail.mails, data.triage)} navCollapsedSize={4} />
      </div>
    </div>
  );
}
