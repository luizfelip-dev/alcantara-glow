type StudioBrandProps = {
  compact?: boolean;
  inverted?: boolean;
};

export function StudioBrand({ compact = false, inverted = false }: StudioBrandProps) {
  return (
    <div className={`studio-brand${compact ? " studio-brand--compact" : ""}${inverted ? " studio-brand--inverted" : ""}`}>
      <img className="studio-brand__mark" src="./studio-em-dia-mark.png" alt="" aria-hidden="true" />
      <div className="studio-brand__wordmark">
        <strong>Studio em Dia</strong>
        <span>Gestão financeira para maquiadoras</span>
      </div>
    </div>
  );
}
