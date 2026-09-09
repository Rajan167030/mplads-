export function SiteFooter() {
  return (
    <footer className="border-t border-dashboard-line bg-white px-5 py-5 text-center text-xs text-dashboard-muted sm:px-8 lg:px-12">
      MPLADS Intelligence · Government Monitoring &amp; Decision Support System · © {new Date().getFullYear()}
    </footer>
  );
}
