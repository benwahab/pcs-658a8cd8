type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  confirmation?: boolean;
  visible: boolean;
  onToggle: () => void;
};

export default function PasswordField({
  label,
  value,
  onChange,
  confirmation = false,
  visible,
  onToggle,
}: PasswordFieldProps) {
  return (
    <label>
      {label}
      <span className="passwordField">
        <input
          required
          minLength={8}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={confirmation ? "new-password" : "current-password"}
        />
        <button
          className="passwordToggle"
          type="button"
          onClick={onToggle}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        >
          {visible ? "◉" : "◎"}
        </button>
      </span>
    </label>
  );
}
