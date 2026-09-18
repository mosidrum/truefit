import { renderToBuffer } from "@react-pdf/renderer";
import { CvDocument, type CvPdfInput } from "@/lib/cvPdf/CvDocument";
import { ensureCvFontsRegistered } from "@/lib/cvPdf/fonts";

/**
 * Dedicated CV PDF formatting service.
 *
 * Renders a tailored CV with @react-pdf/renderer into a buffer that matches
 * the attached resume template (section order, typography, spacing, links).
 */
export async function renderTailoredCvPdf(input: CvPdfInput): Promise<Buffer> {
  ensureCvFontsRegistered();
  return renderToBuffer(<CvDocument {...input} />);
}

export type { CvPdfInput };
export { CvDocument } from "@/lib/cvPdf/CvDocument";
