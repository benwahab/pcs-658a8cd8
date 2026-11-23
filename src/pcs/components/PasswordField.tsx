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
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {visible ? (
              <path d="M3 3l18 18M10.6 5.2A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.5 6.6C3.6 8.4 2 12 2 12s3.6 7 10 7c1.5 0 2.8-.3 4-.9M9.9 9.9a3 3 0 0 0 4.2 4.2" />
            ) : (
              <>
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </span>
    </label>
  );
}
