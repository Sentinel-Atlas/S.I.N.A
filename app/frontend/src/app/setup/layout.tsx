// Setup wizard uses a full-screen layout without the sidebar
export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      {children}
    </div>
  );
}
