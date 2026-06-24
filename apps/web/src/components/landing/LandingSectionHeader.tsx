type LandingSectionHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
};

export function LandingSectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  className = "",
}: LandingSectionHeaderProps) {
  const alignClass =
    align === "center" ? "landing-section-header-center" : "landing-section-header-left";

  return (
    <header className={`landing-section-header ${alignClass} ${className}`}>
      <p className="landing-eyebrow">{eyebrow}</p>
      <h2 className="landing-section-title">{title}</h2>
      {description ? (
        <p className="landing-section-desc">{description}</p>
      ) : null}
    </header>
  );
}
