type AgentCredential = {
  first_name?: string | null;
  last_name?: string | null;
  matricule?: string | null;
  qualification?: string | null;
  phone?: string | null;
};

type MairieCredential = {
  name?: string | null;
  mayor_name?: string | null;
  regions?: { name?: string | null } | null;
  communes?: { name?: string | null } | null;
};

const cp1252: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84,
  0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
  0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c,
  0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
  0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

function pdfHex(value: string): string {
  return Array.from(value, (char) => {
    const code = char.codePointAt(0) ?? 0x3f;
    const byte = code <= 0xff ? code : cp1252[code] ?? 0x3f;
    return byte.toString(16).padStart(2, "0");
  }).join("").toUpperCase();
}

function wrap(value: string, max = 74): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return ["Non renseigné"];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (word.length > max) {
      if (line) lines.push(line);
      line = "";
      for (let i = 0; i < word.length; i += max) lines.push(word.slice(i, i + max));
      continue;
    }
    if (line && (line + " " + word).length > max) {
      lines.push(line);
      line = word;
    } else {
      line = line ? line + " " + word : word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ["Non renseigné"];
}

function textCommand(value: string, x: number, y: number, size: number, font = "F1", color = "0.16 0.12 0.25"): string {
  return `BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm <${pdfHex(value)}> Tj ET\n`;
}

function buildPdf(commands: string): Blob {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${commands.length} >>\nstream\n${commands}endstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

export function downloadAgentCredentialPdf(
  agent: AgentCredential,
  mairie: MairieCredential | null,
  password: string,
): void {
  const fullName = [agent.first_name, agent.last_name].filter(Boolean).join(" ").trim() || "Agent terrain";
  let commands = "";
  commands += "0.18 0.08 0.36 rg 0 742 595 100 re f\n";
  commands += textCommand("PLATEFORME CITOYENNE DE SIGNALEMENT", 42, 802, 11, "F2", "1 1 1");
  commands += textCommand("FICHE DE COMPTE - AGENT TERRAIN", 42, 772, 19, "F2", "1 1 1");
  commands += textCommand("DOCUMENT CONFIDENTIEL A REMETTRE PERSONNELLEMENT A L'AGENT", 42, 754, 8, "F2", "0.91 0.86 1");
  commands += textCommand("IDENTITE ET AFFECTATION", 42, 708, 11, "F2", "0.30 0.18 0.48");
  commands += "0.83 0.79 0.89 RG 42 699 m 553 699 l S\n";

  const rows: Array<[string, string]> = [
    ["Nom complet", fullName],
    ["Matricule", agent.matricule || "Non renseigné"],
    ["Qualification / métier", agent.qualification || "Non renseigné"],
    ["Téléphone", agent.phone || "Non renseigné"],
    ["Mairie de rattachement", mairie?.name || "Non renseignée"],
    ["Commune", mairie?.communes?.name || "Non renseignée"],
    ["Région", mairie?.regions?.name || "Non renseignée"],
    ["Maire", mairie?.mayor_name || "Non renseigné"],
  ];
  let y = 674;
  for (const [label, value] of rows) {
    commands += textCommand(label.toUpperCase(), 44, y, 7, "F2", "0.43 0.39 0.49");
    const lines = wrap(value, 68);
    lines.forEach((line, index) => {
      commands += textCommand(line, 44, y - 17 - index * 13, 10, "F2");
    });
    y -= Math.max(47, 31 + (lines.length - 1) * 13);
  }

  y -= 2;
  commands += "0.95 0.93 0.98 rg 35 " + (y - 80) + " 525 100 re f\n";
  commands += textCommand("IDENTIFIANTS DE CONNEXION", 48, y, 11, "F2", "0.30 0.18 0.48");
  commands += textCommand("Identifiant : numéro de téléphone de l'agent", 48, y - 22, 9, "F2");
  commands += textCommand(agent.phone || "Non renseigné", 48, y - 39, 11, "F2");
  commands += textCommand("MOT DE PASSE INITIAL", 48, y - 59, 8, "F2", "0.43 0.39 0.49");
  wrap(password, 68).slice(0, 2).forEach((line, index) => {
    commands += textCommand(line, 48, y - 76 - index * 13, 10, "F2");
  });

  commands += textCommand("SECURITE : la mairie gere le compte de cet agent. L'agent ne peut pas reinitialiser", 42, 88, 7, "F1", "0.38 0.35 0.42");
  commands += textCommand("ou modifier lui-meme son mot de passe. En cas de changement, la mairie remet", 42, 77, 7, "F1", "0.38 0.35 0.42");
  commands += textCommand("une nouvelle fiche a l'agent et detruit l'ancienne.", 42, 66, 7, "F1", "0.38 0.35 0.42");
  commands += textCommand("Document genere le " + new Date().toLocaleDateString("fr-FR"), 42, 39, 7, "F1", "0.50 0.47 0.54");

  const blob = buildPdf(commands);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeName = fullName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "");
  anchor.href = url;
  anchor.download = `PCS-fiche-agent-${safeName || "terrain"}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
