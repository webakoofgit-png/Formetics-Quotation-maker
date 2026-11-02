import { FORMATIX_LOGO, LOGO_PANEL } from "./brand";

export default function BrandLogo({
  source = "",
  className = "",
}: {
  source?: string;
  className?: string;
}) {
  const custom = !!source && source !== FORMATIX_LOGO;
  return (
    <span
      className={`brand-logo ${custom ? "brand-logo-custom" : ""} ${className}`}
      style={{ aspectRatio: `${LOGO_PANEL.width}/${LOGO_PANEL.height}` }}
    >
      <img
        src={source || FORMATIX_LOGO}
        alt="Formatix Premium Detailing Studio"
        width={LOGO_PANEL.sourceWidth}
        height={LOGO_PANEL.sourceHeight}
        style={
          custom
            ? undefined
            : {
                width: `${(LOGO_PANEL.sourceWidth / LOGO_PANEL.width) * 100}%`,
                left: `${(-LOGO_PANEL.x / LOGO_PANEL.width) * 100}%`,
                top: `${(-LOGO_PANEL.y / LOGO_PANEL.height) * 100}%`,
              }
        }
      />
    </span>
  );
}
