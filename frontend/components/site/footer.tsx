export function SiteFooter() {
  return (
    <footer className="flex flex-col items-center justify-between gap-2 border-t border-line bg-panel px-5 py-4 text-center text-xs text-muted-foreground sm:flex-row sm:px-8 sm:text-left lg:px-12">
      <span>Government Monitoring &amp; Decision Support System</span>
      <span>© {new Date().getFullYear()} MPLADS Intelligence</span>
    </footer>
  );
}
