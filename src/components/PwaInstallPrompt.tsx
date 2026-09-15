import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "marca-minha-vez:pwa-install-dismissed";

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      const installPrompt = event as BeforeInstallPromptEvent;
      setInstallEvent(installPrompt);
      if (localStorage.getItem(DISMISS_KEY) !== "1") setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible || !installEvent) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-lg rounded-2xl border border-border bg-card p-4 shadow-xl sm:inset-x-auto sm:right-5 sm:w-[min(28rem,calc(100vw-2rem))]">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Instale o Marca Minha Vez</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Tenha acesso mais rápido à agenda e ao painel pelo celular.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setVisible(false);
          }}
          className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
          aria-label="Fechar aviso de instalação"
        >
          Depois
        </button>
      </div>
      <button
        type="button"
        onClick={async () => {
          await installEvent.prompt();
          const choice = await installEvent.userChoice;
          setVisible(false);
          if (choice.outcome === "dismissed") localStorage.setItem(DISMISS_KEY, "1");
        }}
        className="mt-3 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Instalar aplicativo
      </button>
    </div>
  );
}
