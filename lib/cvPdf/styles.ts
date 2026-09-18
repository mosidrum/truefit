import { StyleSheet } from "@react-pdf/renderer";

/**
 * Styles measured from the attached Google Docs resume (Letter 612×792):
 * 72pt margins, Arial/Liberation Sans, centered name/title, left body,
 * 16pt section headers with underline, 13pt role titles, 12pt body,
 * italic role meta, hanging bullets, blue contact links.
 */
export const LINK_BLUE = "#1155cc";

export const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 72,
    fontSize: 12,
    fontFamily: "LiberationSans",
    color: "#000000",
    lineHeight: 1.45,
  },
  headerBlock: {
    alignItems: "center",
    marginBottom: 18,
  },
  name: {
    fontSize: 18,
    fontWeight: 700,
    textAlign: "center",
    marginBottom: 10,
  },
  headline: {
    fontSize: 12,
    fontWeight: 700,
    textAlign: "center",
    marginBottom: 8,
  },
  contactRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    fontSize: 12,
  },
  contactPlain: {
    fontSize: 12,
    color: "#000000",
  },
  contactLink: {
    fontSize: 12,
    color: LINK_BLUE,
    textDecoration: "underline",
  },
  contactSep: {
    fontSize: 12,
    color: "#000000",
  },
  section: {
    marginTop: 18,
  },
  sectionFirst: {
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    textTransform: "uppercase",
    marginBottom: 8,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    borderBottomStyle: "solid",
  },
  summary: {
    fontSize: 12,
    lineHeight: 1.55,
  },
  role: {
    marginBottom: 14,
  },
  roleTitle: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 6,
  },
  roleMeta: {
    fontSize: 12,
    fontStyle: "italic",
    marginBottom: 8,
    lineHeight: 1.5,
  },
  projectHeader: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
    lineHeight: 1.5,
  },
  skillLine: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 4,
    lineHeight: 1.45,
  },
  educationLine: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 4,
    lineHeight: 1.45,
  },
  bullet: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 18,
  },
  bulletMark: {
    width: 18,
    fontSize: 12,
  },
  bulletText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 1.5,
  },
});
