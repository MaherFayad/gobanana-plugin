import { Button } from "@/components/ui/button"

const steps = [
  {
    title: "Install your system",
    body: "Run the install command from your next steps page. It adds your theme, fonts and direction files.",
  },
  {
    title: "Open Claude Code here",
    body: "Run claude in this folder and paste the prompt from your next steps page.",
  },
  {
    title: "Build, then check",
    body: "Ask for a check against the kept draft when the page is built.",
  },
]

export default function Page() {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-8 px-4 py-16">
      <div className="flex flex-col gap-3">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Ready for your direction
        </h1>
        <p className="text-base text-muted-foreground">
          This project is a Next.js app with Tailwind CSS and shadcn/ui. Your
          design system and direction files go in it next.
        </p>
      </div>
      <ol className="flex flex-col gap-4">
        {steps.map((step, i) => (
          <li
            key={step.title}
            className="flex gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground"
          >
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-medium"
            >
              {i + 1}
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-medium">{step.title}</h2>
              <p className="text-base text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div>
        <Button
          size="lg"
          className="min-h-11"
          nativeButton={false}
          render={<a href="https://code.claude.com/docs/en/quickstart" />}
        >
          Get Claude Code
        </Button>
      </div>
    </main>
  )
}
