import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import footerLinks from '@/data/footerLinks';

export function Footer() {
  return (
    <footer
      className="container bg-primary"
      data-testid="footer"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3">
        {/* Customer Services Column */}
        <div
          className="rounded-sm border p-6"
          data-testid="footer-customer-services"
        >
          <h2 className="heading-sm mb-3 uppercase text-primary">Customer services</h2>
          <nav
            className="space-y-3"
            aria-label="Customer services navigation"
          >
            {footerLinks.customerServices.map(({ label, path }) => (
              <LocalizedClientLink
                key={label}
                href={path}
                className="label-md block"
                data-testid={`footer-link-${label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {label}
              </LocalizedClientLink>
            ))}
          </nav>
        </div>

        {/* About Column */}
        <div
          className="rounded-sm border p-6"
          data-testid="footer-about"
        >
          <h2 className="heading-sm mb-3 uppercase text-primary">About</h2>
          <nav
            className="space-y-3"
            aria-label="About navigation"
          >
            {footerLinks.about.map(({ label, path }) => (
              <LocalizedClientLink
                key={label}
                href={path}
                className="label-md block"
                data-testid={`footer-link-${label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {label}
              </LocalizedClientLink>
            ))}
          </nav>
        </div>

        {/* Connect Column */}
        <div
          className="rounded-sm border p-6"
          data-testid="footer-connect"
        >
          <h2 className="heading-sm mb-3 uppercase text-primary">connect</h2>
          <nav
            className="space-y-3"
            aria-label="Social media navigation"
          >
            {footerLinks.connect.map(({ label, path }) => (
              <a
                aria-label={`Go to ${label} page`}
                title={`Go to ${label} page`}
                key={label}
                href={path}
                className="label-md block"
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`footer-link-${label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </div>

      <div
        className="rounded-sm border py-6"
        data-testid="footer-copyright"
      >
        <p className="text-md text-center text-secondary">© 2024 Fleek</p>
      </div>
    </footer>
  );
}
