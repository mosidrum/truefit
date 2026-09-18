import { Document, Page, Text, View, Link } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { TailoredCv } from "@/lib/openai";
import {
  formatEducationLine,
  formatExperienceHeader,
  formatExperienceMeta,
  formatProjectHeader,
  normalizeTailoredCvForDisplay,
} from "@/lib/tailoredCvCompat";
import { ensureCvFontsRegistered } from "@/lib/cvPdf/fonts";
import { styles } from "@/lib/cvPdf/styles";

export type CvPdfInput = {
  tailoredCv: TailoredCv;
  candidateName: string;
  candidateEmail: string;
  jobTitle?: string | null;
  company?: string | null;
};

function toHttpUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^mailto:/i.test(trimmed)) return trimmed;
  if (trimmed.includes("@") && !trimmed.includes("/")) return `mailto:${trimmed}`;
  return `https://${trimmed.replace(/^\/\//, "")}`;
}

function ContactLine({
  location,
  email,
  website,
  github,
}: {
  location: string;
  email: string;
  website: string;
  github: string;
}) {
  const parts: ReactNode[] = [];

  const push = (node: ReactNode) => {
    if (parts.length > 0) {
      parts.push(
        <Text key={`sep-${parts.length}`} style={styles.contactSep}>
          {" | "}
        </Text>
      );
    }
    parts.push(node);
  };

  if (location.trim()) {
    push(
      <Text key="location" style={styles.contactPlain}>
        {location.trim()}
      </Text>
    );
  }
  if (email.trim()) {
    push(
      <Link key="email" src={`mailto:${email.trim()}`} style={styles.contactLink}>
        {email.trim()}
      </Link>
    );
  }
  if (website.trim()) {
    const display = website.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
    push(
      <Link key="website" src={toHttpUrl(website)} style={styles.contactLink}>
        {display}
      </Link>
    );
  }
  if (github.trim()) {
    const display = github.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
    push(
      <Link key="github" src={toHttpUrl(github)} style={styles.contactLink}>
        {display}
      </Link>
    );
  }

  if (parts.length === 0) return null;

  return <View style={styles.contactRow}>{parts}</View>;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <>
      {items.map((bullet, index) => (
        <View key={index} style={styles.bullet}>
          <Text style={styles.bulletMark}>●</Text>
          <Text style={styles.bulletText}>{bullet}</Text>
        </View>
      ))}
    </>
  );
}

/**
 * @react-pdf Document that lays out a tailored CV in the exact section order
 * and visual format of the attached resume template.
 */
export function CvDocument({
  tailoredCv: rawTailoredCv,
  candidateName,
  candidateEmail,
  jobTitle,
  company,
}: CvPdfInput) {
  ensureCvFontsRegistered();

  const tailoredCv = normalizeTailoredCvForDisplay(rawTailoredCv);
  const documentTitle = [company, jobTitle].filter(Boolean).join(" - ") || "Tailored CV";

  return (
    <Document title={documentTitle} author={candidateName} subject="Tailored CV">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerBlock}>
          <Text style={styles.name}>{candidateName}</Text>
          {tailoredCv.headline ? <Text style={styles.headline}>{tailoredCv.headline}</Text> : null}
          <ContactLine
            location={tailoredCv.location}
            email={candidateEmail}
            website={tailoredCv.website}
            github={tailoredCv.github}
          />
        </View>

        {tailoredCv.summary ? (
          <View style={[styles.section, styles.sectionFirst]}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.summary}>{tailoredCv.summary}</Text>
          </View>
        ) : null}

        {tailoredCv.experience.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Experience</Text>
            {tailoredCv.experience.map((role, index) => {
              const meta = formatExperienceMeta(role.dates, role.context);
              return (
                <View key={`${role.company}-${role.title}-${index}`} style={styles.role}>
                  <Text style={styles.roleTitle}>
                    {formatExperienceHeader(role.company, role.title)}
                  </Text>
                  {meta ? <Text style={styles.roleMeta}>{meta}</Text> : null}
                  <Bullets items={role.bullets} />
                </View>
              );
            })}
          </View>
        ) : null}

        {tailoredCv.projects.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Projects</Text>
            {tailoredCv.projects.map((project, index) => (
              <View key={`${project.name}-${index}`} style={styles.role}>
                <Text style={styles.projectHeader}>
                  {formatProjectHeader(project.name, project.dates, project.description)}
                </Text>
                <Bullets items={project.bullets} />
              </View>
            ))}
          </View>
        ) : null}

        {tailoredCv.skills.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            {tailoredCv.skills.map((group) => (
              <Text key={group.category} style={styles.skillLine}>
                {group.category}: {group.items.join(", ")}
              </Text>
            ))}
          </View>
        ) : null}

        {tailoredCv.education.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Education</Text>
            {tailoredCv.education.map((entry, index) => (
              <Text key={`${entry.institution}-${index}`} style={styles.educationLine}>
                {formatEducationLine(entry.degree, entry.institution, entry.dates)}
              </Text>
            ))}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
