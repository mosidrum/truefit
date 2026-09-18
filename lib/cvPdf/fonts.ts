import path from "node:path";
import { Font } from "@react-pdf/renderer";

/** Liberation Sans is metric-compatible with Arial (Google Docs default on the template CV). */
const FONT_DIR = path.join(process.cwd(), "lib/cvPdf/fonts");

let registered = false;

/** Registers the resume template font family once per process. */
export function ensureCvFontsRegistered(): void {
  if (registered) return;

  Font.register({
    family: "LiberationSans",
    fonts: [
      { src: path.join(FONT_DIR, "LiberationSans-Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "LiberationSans-Bold.ttf"), fontWeight: 700 },
      { src: path.join(FONT_DIR, "LiberationSans-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
      {
        src: path.join(FONT_DIR, "LiberationSans-BoldItalic.ttf"),
        fontWeight: 700,
        fontStyle: "italic",
      },
    ],
  });

  registered = true;
}
